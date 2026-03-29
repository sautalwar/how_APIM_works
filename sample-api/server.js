const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory product store
let products = [
  { id: '1', name: 'Azure API Management', category: 'Cloud Services', price: 0.035, currency: 'USD', description: 'Full lifecycle API management', createdAt: new Date().toISOString() },
  { id: '2', name: 'Azure Functions', category: 'Cloud Services', price: 0.000016, currency: 'USD', description: 'Serverless compute service', createdAt: new Date().toISOString() },
  { id: '3', name: 'Azure App Service', category: 'Cloud Services', price: 0.018, currency: 'USD', description: 'Fully managed web hosting', createdAt: new Date().toISOString() },
];

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// GET /api/products — List all products
app.get('/api/products', (req, res) => {
  const { category, limit = 50, offset = 0 } = req.query;
  let filtered = products;
  if (category) {
    filtered = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
  const paginated = filtered.slice(Number(offset), Number(offset) + Number(limit));
  res.json({
    data: paginated,
    total: filtered.length,
    limit: Number(limit),
    offset: Number(offset),
  });
});

// GET /api/products/:id — Get single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found', requestId: req.headers['x-request-id'] || 'unknown' });
  }
  res.json({ data: product });
});

// POST /api/products — Create product
app.post('/api/products', (req, res) => {
  const { name, category, price, currency, description } = req.body;
  if (!name || !category || price === undefined) {
    return res.status(400).json({ error: 'Missing required fields: name, category, price' });
  }
  const product = {
    id: uuidv4(),
    name, category, price: Number(price),
    currency: currency || 'USD',
    description: description || '',
    createdAt: new Date().toISOString(),
  };
  products.push(product);
  res.status(201).json({ data: product });
});

// PUT /api/products/:id — Update product
app.put('/api/products/:id', (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  const { name, category, price, currency, description } = req.body;
  products[index] = {
    ...products[index],
    ...(name && { name }),
    ...(category && { category }),
    ...(price !== undefined && { price: Number(price) }),
    ...(currency && { currency }),
    ...(description !== undefined && { description }),
    updatedAt: new Date().toISOString(),
  };
  res.json({ data: products[index] });
});

// DELETE /api/products/:id — Delete product
app.delete('/api/products/:id', (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  products.splice(index, 1);
  res.status(204).send();
});

// ─── Scanner API Endpoints (for offline demo) ───

const POLICIES_DIR = path.join(__dirname, '..', 'policies');
const SCANNER_PATH = path.join(__dirname, '..', 'security-scanner', 'scanner.py');

// List all policy files with content
app.get('/api/scanner/policies', (req, res) => {
  try {
    const files = fs.readdirSync(POLICIES_DIR, { recursive: true })
      .filter(f => f.endsWith('.xml'));
    const policies = files.map(f => {
      const filePath = path.join(POLICIES_DIR, f);
      return {
        name: f.replace(/\\/g, '/'),
        content: fs.readFileSync(filePath, 'utf8'),
        size: fs.statSync(filePath).size,
      };
    });
    res.json({ data: policies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list policies', details: error.message });
  }
});

// Scan a specific policy file
app.get('/api/scanner/scan/:filename', (req, res) => {
  const filePath = path.join(POLICIES_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Policy file not found' });
  }
  try {
    const result = execSync(
      `python "${SCANNER_PATH}" "${filePath}" --format json`,
      { encoding: 'utf8', timeout: 30000 }
    );
    res.json({ data: JSON.parse(result), file: req.params.filename });
  } catch (error) {
    const stdout = error.stdout || '';
    try {
      res.json({ data: JSON.parse(stdout), file: req.params.filename });
    } catch {
      res.status(500).json({ error: 'Scanner failed', details: error.message });
    }
  }
});

// Scan all policies
app.get('/api/scanner/scan', (req, res) => {
  try {
    const result = execSync(
      `python "${SCANNER_PATH}" "${POLICIES_DIR}" --format json`,
      { encoding: 'utf8', timeout: 60000 }
    );
    res.json({ data: JSON.parse(result) });
  } catch (error) {
    const stdout = error.stdout || '';
    try {
      res.json({ data: JSON.parse(stdout) });
    } catch {
      res.status(500).json({ error: 'Scanner failed', details: error.message });
    }
  }
});

// Scan inline XML content (for PR simulation)
app.post('/api/scanner/scan-content', (req, res) => {
  const { content, filename = 'inline-policy.xml' } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const tmpPath = path.join(__dirname, '.tmp-scan-policy.xml');
  fs.writeFileSync(tmpPath, content, 'utf8');
  try {
    const result = execSync(
      `python "${SCANNER_PATH}" "${tmpPath}" --format json`,
      { encoding: 'utf8', timeout: 30000 }
    );
    res.json({ data: JSON.parse(result), file: filename });
  } catch (error) {
    const stdout = error.stdout || '';
    try {
      res.json({ data: JSON.parse(stdout), file: filename });
    } catch {
      res.status(500).json({ error: 'Scanner failed', details: error.message });
    }
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

// Intentionally verbose error for demo — shows why APIM on-error policies matter
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message,
    stack: err.stack,     // ⚠️ This leaks internals — APIM on-error policy should mask this
    server: process.env.HOSTNAME || 'unknown',
  });
});

app.listen(PORT, () => {
  console.log(`Products API running on port ${PORT}`);
});
