import { useState, useEffect, useCallback } from 'react';
import './App.css';
import LiveScanner from './LiveScanner';
import PRSimulation from './PRSimulation';

/* ─── API helpers ─── */
const api = {
  async getProducts(category = '') {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    params.set('limit', '100');
    const res = await fetch(`/api/products?${params}`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },
  async createProduct(product) {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) throw new Error('Failed to create product');
    return res.json();
  },
  async updateProduct(id, product) {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },
  async deleteProduct(id) {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete product');
  },
  async checkHealth() {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('API unhealthy');
    return res.json();
  },
};

/* ─── Toast Notification Component ─── */
function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.type === 'success' ? '✓' : '✕'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ─── Product Card ─── */
function ProductCard({ product, onEdit, onDelete }) {
  const price = Number(product.price).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="product-card">
      <div className="card-header">
        <h3>{product.name}</h3>
        {product.category && (
          <span className="category-badge">{product.category}</span>
        )}
      </div>
      <div className="card-price">
        ${price}
        <span className="currency">{product.currency || 'USD'}</span>
      </div>
      {product.description && (
        <p className="card-description">{product.description}</p>
      )}
      <div className="card-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(product)}>
          ✎ Edit
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(product)}>
          ✕ Delete
        </button>
      </div>
    </div>
  );
}

/* ─── Product Form Modal ─── */
function ProductModal({ product, onClose, onSave }) {
  const isEdit = Boolean(product?.id);
  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || '',
    price: product?.price ?? '',
    currency: product?.currency || 'USD',
    description: product?.description || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price) };
      await onSave(payload, product?.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Product' : 'Add Product'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="name">Product Name *</label>
              <input
                id="name" name="name" required
                value={form.name} onChange={handleChange}
                placeholder="e.g. Azure Functions Pro"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <input
                  id="category" name="category"
                  value={form.category} onChange={handleChange}
                  placeholder="e.g. Cloud Services"
                />
              </div>
              <div className="form-group">
                <label htmlFor="currency">Currency</label>
                <select id="currency" name="currency" value={form.currency} onChange={handleChange}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="price">Price *</label>
              <input
                id="price" name="price" type="number" step="0.01" min="0" required
                value={form.price} onChange={handleChange}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description" name="description"
                value={form.description} onChange={handleChange}
                placeholder="Describe your product..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Delete Confirmation Modal ─── */
function ConfirmDeleteModal({ product, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm(product.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-body">
          <div className="confirm-icon">⚠️</div>
          <h3>Delete "{product.name}"?</h3>
          <p>This action cannot be undone. The product will be permanently removed.</p>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-danger" onClick={handleConfirm} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Demo Overview Tab ─── */
function DemoOverview() {
  const services = [
    {
      icon: '🛡️',
      name: 'Azure API Management',
      color: '#0078d4',
      description:
        'The API gateway enforcing security policies — JWT validation, rate limiting (60/min global, 100/min per subscription), CORS, security headers, request validation, and IP filtering via declarative XML policies.',
    },
    {
      icon: '📦',
      name: 'Backend Products API',
      color: '#0078d4',
      description:
        'Node.js Express REST API on Azure Container Apps. Provides CRUD operations for products. Intentionally exposes stack traces on errors to demonstrate why APIM\'s on-error policy masking matters.',
    },
    {
      icon: '🐳',
      name: 'Azure Container Apps',
      color: '#0078d4',
      description:
        'Serverless container hosting for the backend API. Auto-scales with zero infrastructure management. Uses images from Azure Container Registry.',
    },
    {
      icon: '🗄️',
      name: 'Azure Container Registry',
      color: '#0078d4',
      description:
        'Private Docker image registry storing the products-api container image, securely integrated with Container Apps.',
    },
    {
      icon: '⚙️',
      name: 'GitHub Actions CI/CD',
      color: '#24292e',
      description:
        'Two workflows: (a) Security scan on every PR touching policies/ — runs XML linting, Python scanner, uploads SARIF findings. (b) Deployment pipeline with pre-deploy scans, dev deployment, and production promotion with approval gates.',
    },
    {
      icon: '🤖',
      name: 'GitHub Copilot Agentic Workflow',
      color: '#24292e',
      description:
        'AI-powered PR reviewer that understands OWASP API Top 10 and APIM policy best practices. Automatically reviews policy changes, flags vulnerabilities, and suggests XML fixes.',
    },
    {
      icon: '🔍',
      name: 'Python Security Scanner',
      color: '#24292e',
      description:
        'Custom scanner with 18 rules mapped to OWASP categories. Checks for missing JWT auth, wildcard CORS, no rate limiting, missing security headers, and more. Outputs SARIF for GitHub integration.',
    },
    {
      icon: '📊',
      name: 'Application Insights',
      color: '#0078d4',
      description:
        'Monitoring and telemetry for APIM. Tracks API calls, latency, errors, and policy execution metrics for full observability.',
    },
  ];

  return (
    <div className="demo-overview">
      <section className="hero-section">
        <div className="hero-badge">End-to-End Security Demo</div>
        <h1 className="hero-title">Azure API Management Security with GitHub Agentic Workflows</h1>
        <p className="hero-subtitle">
          Proving Microsoft's superiority in API security automation — from policy authoring to production deployment, fully protected by AI-powered code review and automated OWASP compliance scanning.
        </p>
        <div className="hero-highlights">
          <div className="highlight-item">
            <span className="highlight-number">10</span>
            <span className="highlight-label">OWASP API Threats Mitigated</span>
          </div>
          <div className="highlight-item">
            <span className="highlight-number">18</span>
            <span className="highlight-label">Automated Security Rules</span>
          </div>
          <div className="highlight-item">
            <span className="highlight-number">100%</span>
            <span className="highlight-label">Declarative — No Custom Code</span>
          </div>
        </div>
      </section>

      <section className="key-pillars">
        <h2 className="section-title">Four Pillars of This Demo</h2>
        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-number">1</div>
            <h3>APIM Gateway</h3>
            <p>Azure API Management sits in front of backend APIs, applying security policies at the gateway level — before requests reach the backend.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-number">2</div>
            <h3>OWASP Coverage</h3>
            <p>All 10 OWASP API Security 2023 vulnerabilities are mitigated through declarative XML policies, not custom code.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-number">3</div>
            <h3>Automated Scanning</h3>
            <p>A custom Python scanner (18 rules) analyzes APIM policies for security gaps, outputs SARIF for GitHub Security tab integration.</p>
          </div>
          <div className="pillar-card">
            <div className="pillar-number">4</div>
            <h3>CI/CD Pipeline</h3>
            <p>GitHub Actions runs security scans on every PR, blocks merges with critical findings, and auto-deploys approved changes.</p>
          </div>
        </div>
      </section>

      <div className="agentic-banner">
        <div className="agentic-banner-icon">🤖</div>
        <div className="agentic-banner-content">
          <h3 className="agentic-banner-title">Powered by GitHub Copilot Agentic Workflow</h3>
          <p className="agentic-banner-text">
            The Agentic Workflow is the AI harness that powers all four pillars. It automatically reviews policy PRs for OWASP compliance, suggests XML fixes, and blocks insecure changes — acting as an intelligent layer across the entire demo pipeline.
          </p>
        </div>
      </div>

      <section className="services-section">
        <h2 className="section-title">Architecture Components</h2>
        <div className="services-grid">
          {services.map((svc) => (
            <div className="service-card" key={svc.name}>
              <div className="service-icon-wrapper" style={{ background: svc.color }}>
                <span className="service-icon">{svc.icon}</span>
              </div>
              <div className="service-info">
                <h3>{svc.name}</h3>
                <p>{svc.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── Architecture Diagram Tab ─── */
function ArchitectureDiagram() {
  return (
    <div className="arch2-container">
      <h2 className="section-title">End-to-End Architecture</h2>
      <p className="arch2-subtitle">
        Request flow from developer commit to production API call, fully secured by automated policy enforcement.
      </p>

      {/* Legend */}
      <div className="arch2-legend">
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-azure"></span>Azure Services</div>
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-github"></span>GitHub Services</div>
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-backend"></span>Backend / Compute</div>
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-choke"></span>Choking Point (request blocked)</div>
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-agentic"></span>Agentic Workflow</div>
      </div>

      {/* ── SECTION 1: CI/CD & Security Pipeline ── */}
      <div className="arch2-section">
        <div className="arch2-section-header">
          <span className="arch2-section-title">CI/CD &amp; Security Pipeline</span>
          <span className="arch2-pillar-badge arch2-pillar-purple">Pillar 3: Automated Scanning</span>
          <span className="arch2-pillar-badge arch2-pillar-gray">Pillar 4: Agentic Review</span>
        </div>

        {/* Row 1: Developer → GitHub Repo → GitHub Actions */}
        <div className="arch2-flow-row">
          <div className="arch2-box arch2-bdr-github">
            <div className="arch2-box-icon">👨‍💻</div>
            <div className="arch2-box-title">Developer</div>
            <div className="arch2-box-desc">Local dev environment</div>
          </div>
          <div className="arch2-arrow-group">
            <div className="arch2-flow-label">git push / PR</div>
            <div className="arch2-arrow-line">→</div>
          </div>
          <div className="arch2-box arch2-bdr-github">
            <div className="arch2-box-icon">🔀</div>
            <div className="arch2-box-title">GitHub Repository</div>
            <div className="arch2-box-desc">Source code &amp; policy XML files</div>
          </div>
          <div className="arch2-arrow-group">
            <div className="arch2-flow-label">webhook trigger</div>
            <div className="arch2-arrow-line">→</div>
          </div>
          <div className="arch2-box arch2-bdr-github">
            <div className="arch2-box-icon">⚙️</div>
            <div className="arch2-box-title">GitHub Actions CI</div>
            <div className="arch2-box-desc">Automated pipeline</div>
          </div>
        </div>

        {/* Pipeline Gates detail */}
        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
        </div>

        <div className="arch2-detail-card arch2-bdr-github">
          <div className="arch2-detail-header">🔒 Pipeline Gates (run in GitHub Actions)</div>
          <div className="arch2-detail-grid">
            <div className="arch2-detail-step"><strong>1.</strong> XML Lint — validate policy syntax</div>
            <div className="arch2-detail-step"><strong>2.</strong> Security Scan — Python scanner, 18 OWASP rules</div>
            <div className="arch2-detail-step"><strong>3.</strong> Bicep What-If — preview infra changes</div>
          </div>
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">SARIF findings uploaded</div>
        </div>

        {/* Scanner Detail */}
        <div className="arch2-detail-card arch2-bdr-github">
          <div className="arch2-detail-header">🔍 Python Security Scanner</div>
          <div className="arch2-detail-grid">
            <div className="arch2-detail-step">18 OWASP Rules checked</div>
            <div className="arch2-detail-step">XML Policy Analysis</div>
            <div className="arch2-detail-step">SARIF → GitHub Security Tab</div>
            <div className="arch2-detail-step">Runs on every PR automatically</div>
          </div>
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">Agentic Workflow triggers</div>
        </div>

        {/* Copilot Agentic Review */}
        <div className="arch2-box arch2-box-wide arch2-bdr-agentic">
          <div className="arch2-box-icon">🤖</div>
          <div className="arch2-box-title">Copilot Agentic Review</div>
          <div className="arch2-box-desc">AI OWASP Analysis — reviews SARIF output + policy XML, posts PR comments</div>
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">approves / blocks PR</div>
        </div>

        {/* CHOKE POINT 1 */}
        <div className="arch2-choke">
          <span className="arch2-choke-icon">❌</span>
          <div className="arch2-choke-body">
            <div className="arch2-choke-title">CHOKE POINT 1</div>
            <div className="arch2-choke-desc">PR blocked if security scan fails or AI finds OWASP violations</div>
          </div>
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">merge approved</div>
        </div>

        <div className="arch2-box arch2-box-wide arch2-bdr-azure">
          <div className="arch2-box-icon">🚀</div>
          <div className="arch2-box-title">Deploy Pipeline</div>
          <div className="arch2-box-desc">azd deploy / Bicep — provisions APIM, Container Apps, App Insights</div>
        </div>
      </div>

      {/* ── SECTION 2: API Client Request Flow ── */}
      <div className="arch2-section">
        <div className="arch2-section-header">
          <span className="arch2-section-title">API Client Request Flow</span>
          <span className="arch2-pillar-badge arch2-pillar-blue">Pillar 1: APIM Gateway</span>
        </div>

        <div className="arch2-flow-row">
          <div className="arch2-box arch2-bdr-backend">
            <div className="arch2-box-icon">🌐</div>
            <div className="arch2-box-title">API Client / Browser</div>
            <div className="arch2-box-desc">External consumer</div>
          </div>
          <div className="arch2-arrow-group">
            <div className="arch2-flow-label">HTTPS request + subscription key</div>
            <div className="arch2-arrow-line">→</div>
          </div>
          <div className="arch2-box arch2-bdr-azure arch2-box-accent">
            <div className="arch2-box-icon">🛡️</div>
            <div className="arch2-box-title">Azure API Management Gateway</div>
            <div className="arch2-box-desc">apim-security-demo-dev-xxx.azure-api.net</div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: APIM Policy Pipeline ── */}
      <div className="arch2-section">
        <div className="arch2-section-header">
          <span className="arch2-section-title">APIM Policy Pipeline</span>
          <span className="arch2-pillar-badge arch2-pillar-blue">Pillar 1: APIM Gateway</span>
          <span className="arch2-pillar-badge arch2-pillar-green">Pillar 2: Policy Enforcement</span>
        </div>

        <div className="arch2-apim-gateway">
          <div className="arch2-apim-header">
            <span className="arch2-apim-header-icon">🛡️</span>
            Azure API Management
            <span className="arch2-tier-badge">Developer Tier</span>
          </div>

          {/* Subscription Key Check */}
          <div className="arch2-choke arch2-choke-inline">
            <span className="arch2-choke-icon">❌</span>
            <div className="arch2-choke-body">
              <div className="arch2-choke-title">CHOKE POINT 2: Subscription Key Check</div>
              <div className="arch2-choke-desc">401 Unauthorized if no valid subscription key in header</div>
            </div>
          </div>

          <div className="arch2-apim-vert-arrow">▼</div>

          {/* Inbound Policies */}
          <div className="arch2-apim-stage arch2-apim-inbound">
            <div className="arch2-apim-stage-label">INBOUND POLICIES</div>
            <div className="arch2-apim-policy-list">
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">🔑</span>
                <div>
                  <strong>JWT / OAuth Validation</strong> (validate-jwt)
                  <div className="arch2-policy-detail">Checks Azure AD token, expiry, audience</div>
                </div>
              </div>
              <div className="arch2-choke arch2-choke-sm">
                <span className="arch2-choke-icon">❌</span>
                <div className="arch2-choke-body">
                  <div className="arch2-choke-title">CHOKE POINT 3</div>
                  <div className="arch2-choke-desc">401 if invalid / missing JWT</div>
                </div>
              </div>
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">⏱️</span>
                <div>
                  <strong>Rate Limiting</strong>
                  <div className="arch2-policy-detail">60/min per IP (global) · 100/min per subscription (API-level)</div>
                </div>
              </div>
              <div className="arch2-choke arch2-choke-sm">
                <span className="arch2-choke-icon">❌</span>
                <div className="arch2-choke-body">
                  <div className="arch2-choke-title">CHOKE POINT 4</div>
                  <div className="arch2-choke-desc">429 Too Many Requests</div>
                </div>
              </div>
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">🌐</span>
                <div>
                  <strong>CORS Enforcement</strong>
                  <div className="arch2-policy-detail">Only allowed origins (no wildcards)</div>
                </div>
              </div>
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">🚫</span>
                <div>
                  <strong>IP Filtering</strong>
                  <div className="arch2-policy-detail">Allowlisted IPs only</div>
                </div>
              </div>
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">✅</span>
                <div>
                  <strong>Request Validation</strong>
                  <div className="arch2-policy-detail">Size, content-type, SQLi/XSS pattern detection</div>
                </div>
              </div>
            </div>
          </div>

          <div className="arch2-apim-vert-arrow">
            <span>▼</span>
            <span className="arch2-apim-arrow-label">request passes all checks</span>
          </div>

          {/* Backend */}
          <div className="arch2-apim-stage arch2-apim-backend">
            <div className="arch2-apim-stage-label">BACKEND</div>
            <div className="arch2-apim-policy-list">
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">➡️</span>
                <div>
                  <strong>Forward to Container App</strong>
                  <div className="arch2-policy-detail">Backend URL + timeout (30s)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="arch2-apim-vert-arrow">
            <span>▼</span>
            <span className="arch2-apim-arrow-label">response received from backend</span>
          </div>

          {/* Outbound Policies */}
          <div className="arch2-apim-stage arch2-apim-outbound">
            <div className="arch2-apim-stage-label">OUTBOUND POLICIES</div>
            <div className="arch2-apim-policy-list">
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">🔐</span>
                <div>
                  <strong>Add Security Headers</strong>
                  <div className="arch2-policy-detail">HSTS, CSP, X-Frame-Options, nosniff</div>
                </div>
              </div>
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">🧹</span>
                <div>
                  <strong>Strip Server Fingerprinting</strong>
                  <div className="arch2-policy-detail">Remove X-Powered-By, Server headers</div>
                </div>
              </div>
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">🏷️</span>
                <div>
                  <strong>Add X-Correlation-ID</strong>
                  <div className="arch2-policy-detail">Request tracing across services</div>
                </div>
              </div>
            </div>
          </div>

          <div className="arch2-apim-vert-arrow">
            <span>▼</span>
            <span className="arch2-apim-arrow-label">if any error occurs in pipeline</span>
          </div>

          {/* On-Error */}
          <div className="arch2-apim-stage arch2-apim-onerror">
            <div className="arch2-apim-stage-label">ON-ERROR</div>
            <div className="arch2-apim-policy-list">
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">🛑</span>
                <div>
                  <strong>Mask Internal Error Details</strong>
                  <div className="arch2-policy-detail">Never expose stack traces to clients</div>
                </div>
              </div>
              <div className="arch2-apim-policy-item">
                <span className="arch2-policy-icon">🔄</span>
                <div>
                  <strong>Return Safe Generic 500 Response</strong>
                  <div className="arch2-policy-detail">Controlled error output only</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Backend & Monitoring ── */}
      <div className="arch2-section">
        <div className="arch2-section-header">
          <span className="arch2-section-title">Backend &amp; Monitoring</span>
          <span className="arch2-pillar-badge arch2-pillar-green">Pillar 2: Policy Enforcement</span>
        </div>

        <div className="arch2-flow-row arch2-flow-row-wrap">
          <div className="arch2-box arch2-bdr-backend">
            <div className="arch2-box-icon">📦</div>
            <div className="arch2-box-title">Container Apps</div>
            <div className="arch2-box-desc">Node.js Express CRUD API</div>
          </div>
          <div className="arch2-arrow-group">
            <div className="arch2-flow-label">telemetry</div>
            <div className="arch2-arrow-line">→</div>
          </div>
          <div className="arch2-box arch2-bdr-azure">
            <div className="arch2-box-icon">📊</div>
            <div className="arch2-box-title">Application Insights</div>
            <div className="arch2-box-desc">Metrics, logs, request traces</div>
          </div>
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">CRUD responses</div>
        </div>

        <div className="arch2-flow-row">
          <div className="arch2-box arch2-bdr-azure">
            <div className="arch2-box-icon">🗄️</div>
            <div className="arch2-box-title">ACR (Container Registry)</div>
            <div className="arch2-box-desc">Docker images for deployment</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Demo Guide Tab ─── */
function DemoGuide() {
  const [expandedPillars, setExpandedPillars] = useState(new Set());

  const togglePillar = (id) => {
    setExpandedPillars(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const isPillarOpen = (id) => expandedPillars.has(id);

  const ScreenIndicator = ({ type, label }) => {
    const cls = `dg2-screen-pill dg2-screen-${type}`;
    return <div className={cls}><span className="dg2-screen-icon">🖥️</span><span className="dg2-screen-label">{label}</span></div>;
  };

  const TimeMarker = ({ time }) => (
    <div className="dg2-time-marker"><span className="dg2-time-icon">⏱️</span><span>{time}</span></div>
  );

  const CopilotCallout = ({ children }) => (
    <div className="dg2-copilot-callout">
      <div className="dg2-copilot-header"><span className="dg2-copilot-icon">🤖</span><span className="dg2-copilot-label">GitHub Copilot</span></div>
      <div className="dg2-copilot-body">{children}</div>
    </div>
  );

  const WorkflowBox = ({ children }) => (
    <div className="dg2-workflow-box">
      <div className="dg2-workflow-title">⚙️ Workflow Execution Details</div>
      <div className="dg2-workflow-body">{children}</div>
    </div>
  );

  const TalkTrack = ({ children }) => (
    <div className="guide-talking-point"><span className="guide-tp-icon">💬</span><p>{children}</p></div>
  );

  return (
    <div className="demo-guide">
      {/* ── Intro Section ── */}
      <div className="demo-guide-intro">
        <h2 className="section-title">End-to-End Demo Flow</h2>
        <p className="demo-guide-subtitle">
          Screen-by-screen guide showing how GitHub Copilot Agentic Workflow powers automated API security across all four pillars.
        </p>

        <CopilotCallout>
          <p>
            <strong>GitHub Copilot Agentic Workflow</strong> is the AI engine that powers this entire demo.
            It runs as a GitHub-hosted workflow that automatically triggers on every Pull Request touching
            APIM policy files (<code>policies/**</code>) or infrastructure code (<code>infra/**</code>).
            The agentic workflow uses Copilot's AI capabilities to analyze XML policies against the OWASP API Top 10,
            providing human-quality security review at machine speed.
          </p>
        </CopilotCallout>

        <WorkflowBox>
          <ul className="dg2-workflow-list">
            <li><strong>Trigger:</strong> <code>on: pull_request</code> when files in <code>policies/**</code>, <code>infra/**</code>, or <code>security-scanner/**</code> change</li>
            <li><strong>Runner:</strong> <code>ubuntu-latest</code> (GitHub-hosted). Can also run on self-hosted runners for enterprise environments with network restrictions</li>
            <li><strong>Execution:</strong> Runs automatically — no manual trigger needed. Each PR gets its own workflow run</li>
            <li><strong>Timing:</strong> Lint job: ~30 seconds → Security scan: ~1-2 minutes → Results appear on PR within 2-3 minutes total</li>
            <li><strong>Real-time capture:</strong> SARIF findings uploaded to GitHub Security tab via <code>github/codeql-action/upload-sarif@v3</code>. PR comments auto-generated with finding details. Agentic review comments appear as PR review</li>
            <li><strong>Permissions:</strong> <code>contents: read</code>, <code>security-events: write</code>, <code>pull-requests: write</code></li>
          </ul>
        </WorkflowBox>
      </div>

      {/* ── PILLAR 1 ── */}
      <div className="guide-accordion">
        <button className={`guide-accordion-header${isPillarOpen(1) ? ' guide-accordion-active' : ''}`} onClick={() => togglePillar(1)}>
          <div className="guide-accordion-title">
            <span className="guide-pillar-number">1</span>
            <span>APIM Gateway Demo</span>
            <span className="guide-time-badge">15 min</span>
          </div>
          <span className="guide-accordion-arrow">{isPillarOpen(1) ? '▼' : '▶'}</span>
        </button>
        {isPillarOpen(1) && (
          <div className="guide-accordion-body">
            {/* Screen 1 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="terminal" label="Terminal" />
                <TimeMarker time="0:00 – 2:00" />
              </div>
              <h4>Show the Problem</h4>
              <pre className="guide-code-block"><code>curl http://localhost:4000/api/products</code></pre>
              <p>Point out: No auth required, all data exposed, no security headers.</p>
              <TalkTrack>"This is your backend API running naked. No authentication, no rate limiting, no security headers. Anyone on the internet can call this. Let me show you how dangerous this is."</TalkTrack>
            </div>

            {/* Screen 2 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="terminal" label="Terminal" />
                <TimeMarker time="2:00 – 3:00" />
              </div>
              <h4>Exploit the Vulnerability</h4>
              <pre className="guide-code-block"><code>{`curl -X POST http://localhost:4000/api/products \\
  -H "Content-Type: application/json" \\
  -d '{"name":"HACKED","category":"Injected","price":0}'`}</code></pre>
              <div className="guide-expected-output">
                <span className="guide-expected-label">Expected:</span> Product created with price $0
              </div>
              <TalkTrack>"An attacker just injected a fake product at price $0. OWASP API3 — Broken Object Property Level Authorization. No validation, no audit trail, no way to know this happened."</TalkTrack>
            </div>

            {/* Screen 3 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="azure" label="Azure Portal" />
                <TimeMarker time="3:00 – 6:00" />
              </div>
              <h4>Show APIM</h4>
              <ul className="guide-bullet-list">
                <li>Open: <code>portal.azure.com</code> → Resource Group <code>rg-apim-security-demo</code> → Click APIM instance</li>
                <li>Show: Overview page with gateway URL, Developer Portal link</li>
                <li>Navigate to: Settings → Protocols + Ciphers → Show TLS 1.2 enforced</li>
                <li>Navigate to: Security → Managed Identity → Show it's enabled</li>
                <li>Navigate to: Monitoring → Application Insights → Show it's connected</li>
              </ul>
              <TalkTrack>"This is Azure API Management — your API security control plane. TLS 1.2 enforced, managed identity enabled, Application Insights connected. Every request flows through 4 policy stages."</TalkTrack>
            </div>

            {/* Screen 4 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="terminal" label="Terminal" />
                <TimeMarker time="6:00 – 8:00" />
              </div>
              <h4>APIM Blocks Without Key</h4>
              <pre className="guide-code-block"><code>{`curl -s -w "\\nHTTP Status: %{http_code}\\n" \\
  https://apim-security-demo-dev-exxlcmfwvdwzi.azure-api.net/products-api/products`}</code></pre>
              <div className="guide-expected-output">
                <span className="guide-expected-label">Expected:</span> HTTP 401 — "Access denied due to missing subscription key"
              </div>
              <TalkTrack>"Same API, but now through APIM. Immediate 401 — no subscription key, no access. This is the first choke point."</TalkTrack>
            </div>

            {/* Screen 5 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="terminal" label="Terminal" />
                <TimeMarker time="8:00 – 10:00" />
              </div>
              <h4>APIM Blocks Without JWT</h4>
              <pre className="guide-code-block"><code>{`curl -s -w "\\nHTTP Status: %{http_code}\\n" \\
  -H "Ocp-Apim-Subscription-Key: 4ebbfcbaef1c4e07a512339b62d108ca" \\
  https://apim-security-demo-dev-exxlcmfwvdwzi.azure-api.net/products-api/products`}</code></pre>
              <div className="guide-expected-output">
                <span className="guide-expected-label">Expected:</span> HTTP 401 — "Access denied. Valid JWT token required."
              </div>
              <TalkTrack>"Added the subscription key, but still 401. Now APIM wants a JWT token from Azure AD. Subscription key identifies the app, JWT identifies the user. Zero-trust."</TalkTrack>
            </div>

            {/* Screen 6 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="terminal" label="Terminal" />
                <TimeMarker time="10:00 – 12:00" />
              </div>
              <h4>Show Security Headers</h4>
              <pre className="guide-code-block"><code>{`curl -s -D- \\
  -H "Ocp-Apim-Subscription-Key: 4ebbfcbaef1c4e07a512339b62d108ca" \\
  https://apim-security-demo-dev-exxlcmfwvdwzi.azure-api.net/products-api/products \\
  2>&1 | head -20`}</code></pre>
              <ul className="guide-bullet-list">
                <li>Point out headers: <code>X-Content-Type-Options</code>, <code>Strict-Transport-Security</code>, <code>X-Frame-Options</code></li>
                <li>Point out MISSING: <code>X-Powered-By</code>, <code>Server</code> (stripped by APIM)</li>
              </ul>
              <TalkTrack>"Look at these response headers. HSTS enforced, clickjacking protection, MIME sniffing blocked. And notice what's NOT there — no Server header, no X-Powered-By. APIM strips fingerprinting headers so attackers can't identify your tech stack."</TalkTrack>
            </div>

            <CopilotCallout>
              <p>
                <strong>Where does Copilot fit in Pillar 1?</strong> Copilot doesn't operate at runtime — it operates at <em>CHANGE TIME</em>.
                When a developer tries to modify these APIM policies (e.g., remove JWT validation, weaken rate limits),
                the Agentic Workflow catches it BEFORE it reaches production. See Pillars 3 &amp; 4 for that flow.
              </p>
            </CopilotCallout>
          </div>
        )}
      </div>

      {/* ── PILLAR 2 ── */}
      <div className="guide-accordion">
        <button className={`guide-accordion-header${isPillarOpen(2) ? ' guide-accordion-active' : ''}`} onClick={() => togglePillar(2)}>
          <div className="guide-accordion-title">
            <span className="guide-pillar-number">2</span>
            <span>OWASP API Top 10 Coverage</span>
            <span className="guide-time-badge">10 min</span>
          </div>
          <span className="guide-accordion-arrow">{isPillarOpen(2) ? '▼' : '▶'}</span>
        </button>
        {isPillarOpen(2) && (
          <div className="guide-accordion-body">
            {/* Screen 1 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub Repository" />
                <TimeMarker time="0:00 – 3:00" />
              </div>
              <h4>Show Policy Files</h4>
              <ul className="guide-bullet-list">
                <li>Open: <code>https://github.com/sautalwar/how_APIM_works</code> → <code>policies/</code> folder</li>
                <li>Show 3 policy levels: <code>global-policy.xml</code>, <code>api-level-policy.xml</code>, <code>operation-level-policy.xml</code></li>
              </ul>
              <TalkTrack>"All security policies are code — version controlled in Git. Three levels of defense: Global applies to ALL APIs. API-level applies to Products API specifically. Operation-level applies to DELETE endpoint only."</TalkTrack>
            </div>

            {/* Screen 2 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub Repository" />
                <TimeMarker time="3:00 – 5:00" />
              </div>
              <h4>Walk Through Global Policy</h4>
              <p>Click: <code>policies/global-policy.xml</code></p>
              <p>Walk through XML showing: rate-limit-by-key (60/min), security headers, correlation ID, server header stripping.</p>
              <TalkTrack>"This global policy is the baseline. Every API in this APIM instance gets rate limiting at 60 requests per minute per IP, security headers injected on every response, and fingerprinting headers stripped. Declarative XML — zero code."</TalkTrack>
            </div>

            {/* Screen 3 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="browser" label="Docs / Slide" />
                <TimeMarker time="5:00 – 8:00" />
              </div>
              <h4>Show OWASP Mapping Table</h4>
              <p>Show the OWASP mapping (can use the Architecture Guide tab or <code>docs/03-owasp-api-top10.md</code>):</p>
              <div className="guide-table-wrapper">
                <table className="guide-table">
                  <thead>
                    <tr><th>OWASP</th><th>Vulnerability</th><th>APIM Policy</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>API1</td><td>Broken Object Auth</td><td>validate-jwt with required-claims</td></tr>
                    <tr><td>API2</td><td>Broken Auth</td><td>validate-jwt + subscription keys</td></tr>
                    <tr><td>API3</td><td>Broken Property Auth</td><td>validate-content JSON schema</td></tr>
                    <tr><td>API4</td><td>Resource Consumption</td><td>rate-limit-by-key + quota</td></tr>
                    <tr><td>API5</td><td>Function Auth</td><td>validate-jwt with role claims</td></tr>
                    <tr><td>API6</td><td>Business Flow</td><td>rate-limit-by-key custom counters</td></tr>
                    <tr><td>API7</td><td>SSRF</td><td>set-backend-service + IP filtering</td></tr>
                    <tr><td>API8</td><td>Misconfig</td><td>set-header + on-error</td></tr>
                    <tr><td>API9</td><td>Inventory</td><td>API versioning in Bicep</td></tr>
                    <tr><td>API10</td><td>3rd Party</td><td>validate-content + send-request</td></tr>
                  </tbody>
                </table>
              </div>
              <TalkTrack>"All 10 OWASP API vulnerabilities — addressed through declarative policies. No custom code. Every one is auditable, scannable, and version controlled."</TalkTrack>
            </div>

            <CopilotCallout>
              <p>
                Copilot's Agentic Workflow <strong>knows all 10 of these OWASP categories</strong>. When it reviews a policy PR,
                it checks every single one. It doesn't just say "missing auth" — it says
                "<em>OWASP API2: Broken Authentication — your policy lacks validate-jwt, which means any caller can
                access this endpoint without proving their identity. Here's the exact XML to fix it.</em>"
                That's AI-powered security review.
              </p>
            </CopilotCallout>

            {/* Screen 4 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub Repository" />
                <TimeMarker time="8:00 – 10:00" />
              </div>
              <h4>Show Scanner Rules</h4>
              <p>Open: <code>security-scanner/rules/rules.yaml</code></p>
              <p>Show how rules map to OWASP: AUTH001→API2, RATE001→API4, CORS001→API8, etc.</p>
              <TalkTrack>"18 rules, each mapped to OWASP. The scanner uses XPath queries and regex patterns to analyze policy XML. It outputs SARIF — the same format GitHub uses for CodeQL. One security dashboard."</TalkTrack>
            </div>
          </div>
        )}
      </div>

      {/* ── PILLAR 3 ── */}
      <div className="guide-accordion">
        <button className={`guide-accordion-header${isPillarOpen(3) ? ' guide-accordion-active' : ''}`} onClick={() => togglePillar(3)}>
          <div className="guide-accordion-title">
            <span className="guide-pillar-number">3</span>
            <span>Automated Security Scanning</span>
            <span className="guide-time-badge">15 min</span>
          </div>
          <span className="guide-accordion-arrow">{isPillarOpen(3) ? '▼' : '▶'}</span>
        </button>
        {isPillarOpen(3) && (
          <div className="guide-accordion-body">
            {/* Screen 1 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="terminal" label="Terminal" />
                <TimeMarker time="0:00 – 3:00" />
              </div>
              <h4>Run Scanner Locally</h4>
              <pre className="guide-code-block"><code>{`cd security-scanner && python scanner.py --policy-dir ../policies --format text`}</code></pre>
              <div className="guide-expected-output">
                <span className="guide-expected-label">Expected:</span> Scanner analyzes all policy files, shows findings by severity
              </div>
              <TalkTrack>"Let's run the scanner locally first. 18 rules, checking every policy file. This is the same scanner that runs in CI — but we can run it locally for quick feedback."</TalkTrack>
            </div>

            {/* Screen 2 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="terminal" label="Terminal" />
                <TimeMarker time="3:00 – 6:00" />
              </div>
              <h4>Show the Insecure Policy</h4>
              <pre className="guide-code-block"><code>cat ../policies/public-api-policy.xml</code></pre>
              <p>Point out: No validate-jwt, wildcard CORS <code>*</code>, no rate limiting.</p>
              <pre className="guide-code-block"><code>{`python scanner.py --policy-dir ../policies --format text`}</code></pre>
              <div className="guide-expected-output">
                <span className="guide-expected-label">Expected:</span> Multiple CRITICAL and HIGH findings:
                <ul>
                  <li><strong>AUTH001</strong> (CRITICAL): No validate-jwt — API completely unauthenticated</li>
                  <li><strong>CORS001</strong> (CRITICAL): Wildcard * in CORS — any website can call</li>
                  <li><strong>CORS002</strong> (CRITICAL): allow-credentials=true with wildcard — worst CORS config</li>
                  <li><strong>RATE001</strong> (HIGH): No rate limiting — DDoS vulnerable</li>
                  <li><strong>ERR001</strong> (HIGH): No on-error — stack traces leak</li>
                  <li><strong>DATA001</strong> (HIGH): No request size limit — resource exhaustion</li>
                </ul>
              </div>
              <TalkTrack>"Look at this — 3 critical, 4 high findings. The scanner tells you exactly what's wrong and exactly how to fix it. AUTH001 says no JWT validation, references OWASP API2, and tells you to add validate-jwt. This is actionable, not just informational."</TalkTrack>
            </div>

            {/* Screen 3 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="terminal" label="Terminal" />
                <TimeMarker time="6:00 – 7:00" />
              </div>
              <h4>SARIF Output</h4>
              <pre className="guide-code-block"><code>{`python scanner.py --policy-dir ../policies --format sarif --output results.sarif
cat results.sarif | python -m json.tool | head -40`}</code></pre>
              <p>Show SARIF structure: runs, tool info, rules with OWASP tags, results with locations.</p>
              <TalkTrack>"SARIF is the industry standard for static analysis results. The same format CodeQL uses. When we upload this to GitHub, it appears in the Security tab alongside your code scanning findings."</TalkTrack>
            </div>

            {/* Screen 4 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="terminal" label="Terminal" />
                <TimeMarker time="7:00 – 8:00" />
              </div>
              <h4>Run Tests</h4>
              <pre className="guide-code-block"><code>python -m pytest tests/ -v</code></pre>
              <div className="guide-expected-output">
                <span className="guide-expected-label">Expected:</span> 5 tests pass
              </div>
              <TalkTrack>"The scanner itself is tested. secure-policy.xml should pass clean. insecure-policy.xml should trigger critical findings. We test the security tool that tests your security."</TalkTrack>
            </div>

            {/* Copilot key moment */}
            <CopilotCallout>
              <p>
                <strong>This is the key moment.</strong> The scanner gives you deterministic rules — 18 checks, pass/fail.
                But Copilot's Agentic Workflow adds <em>INTELLIGENCE</em> on top. Let me show you.
              </p>
            </CopilotCallout>

            {/* Screen 5 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub" />
                <TimeMarker time="8:00 – 10:00" />
              </div>
              <h4>Create Insecure PR</h4>
              <pre className="guide-code-block"><code>{`git checkout -b demo/weaken-security
# Edit policies/api-level-policy.xml — remove validate-jwt, add wildcard CORS
git add -A && git commit -m "Quick fix for partner testing"
git push origin demo/weaken-security
# Create PR via GitHub UI`}</code></pre>
              <TalkTrack>"A developer removes JWT validation and adds wildcard CORS — 'just for testing.' This happens all the time. Let's push it and watch what happens."</TalkTrack>
            </div>

            {/* Screen 6 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub PR Page" />
                <TimeMarker time="10:00 – 11:00" />
              </div>
              <h4>Watch CI Trigger</h4>
              <p>Open the new PR on GitHub. Point out: "Checks" section shows ⏳ yellow spinner — CI pipeline triggered.</p>
              <TalkTrack>"The moment the PR is created, the workflow triggers. It runs on a GitHub-hosted ubuntu-latest runner. No setup needed — it just works."</TalkTrack>
            </div>

            {/* Screen 7 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub Actions" />
                <TimeMarker time="11:00 – 12:00" />
              </div>
              <h4>Watch Pipeline Execute</h4>
              <ul className="guide-bullet-list">
                <li>Show: Job 1 "Lint &amp; Validate" running → passes ✅</li>
                <li>Show: Job 2 "Security Scan" starts → scanner runs → FAILS ❌</li>
              </ul>
              <TalkTrack>"Gate 1 passes — the XML is valid. Gate 2 runs the scanner... and it fails. 3 critical, 4 high OWASP violations found. The PR is now blocked."</TalkTrack>
            </div>

            <WorkflowBox>
              <ul className="dg2-workflow-list">
                <li><strong>Runner:</strong> <code>ubuntu-latest</code> — GitHub-hosted, 2-core Linux VM</li>
                <li><strong>Self-hosted option:</strong> For enterprise, add <code>runs-on: self-hosted</code> with labels for specific runner groups</li>
                <li><strong>Trigger:</strong> <code>on: pull_request: paths: ['policies/**', 'infra/**', 'security-scanner/**']</code></li>
                <li>The workflow ONLY runs when policy-related files change — not on every PR</li>
                <li><strong>Timing:</strong> Lint ~30s → Scanner ~60s → SARIF upload ~10s → PR comment ~10s = <strong>~2 minutes total</strong></li>
              </ul>
            </WorkflowBox>

            {/* Screen 8 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub Security Tab" />
                <TimeMarker time="12:00 – 13:00" />
              </div>
              <h4>SARIF Results</h4>
              <p>Navigate: Repository → Security tab → Code scanning alerts. Show findings from "apim-policy-security" category.</p>
              <TalkTrack>"SARIF findings are now in the GitHub Security tab. Same place as CodeQL findings. One dashboard for code AND configuration security."</TalkTrack>
            </div>

            {/* Screen 9 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub PR" />
                <TimeMarker time="13:00 – 15:00" />
              </div>
              <h4>Copilot Agentic Review</h4>
              <p>Go back to PR → Show Copilot's review comment. Copilot explains WHY each issue is dangerous, references OWASP category, provides exact XML fix.</p>
              <TalkTrack>"Look at this review. Copilot didn't just say 'CORS is wrong.' It explained the attack vector — 'Wildcard CORS allows any website to make authenticated requests to your API, enabling cross-site data theft.' It references OWASP API8. And it provides the exact XML fix. This is AI security review at machine speed with human-quality explanations."</TalkTrack>
            </div>

            {/* Comparison table */}
            <div className="dg2-comparison-wrapper">
              <h4 className="dg2-comparison-title">🤖 Copilot vs Scanner</h4>
              <table className="dg2-comparison-table">
                <thead>
                  <tr><th></th><th>Python Scanner</th><th>Copilot Agentic</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong>Type</strong></td><td>Deterministic rules</td><td>AI-powered analysis</td></tr>
                  <tr><td><strong>Speed</strong></td><td>~60 seconds</td><td>~2-3 minutes</td></tr>
                  <tr><td><strong>Output</strong></td><td>SARIF findings (pass/fail)</td><td>PR review comments with explanations</td></tr>
                  <tr><td><strong>Depth</strong></td><td>18 predefined rules</td><td>Understands context, intent, OWASP theory</td></tr>
                  <tr><td><strong>Fix suggestions</strong></td><td>Generic recommendations</td><td>Exact XML code suggestions</td></tr>
                  <tr><td><strong>When</strong></td><td>Every PR (CI pipeline)</td><td>Every PR (Agentic Workflow)</td></tr>
                </tbody>
              </table>
              <p className="dg2-comparison-note">They're complementary — scanner catches known patterns, Copilot catches nuanced issues.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── PILLAR 4 ── */}
      <div className="guide-accordion">
        <button className={`guide-accordion-header${isPillarOpen(4) ? ' guide-accordion-active' : ''}`} onClick={() => togglePillar(4)}>
          <div className="guide-accordion-title">
            <span className="guide-pillar-number">4</span>
            <span>CI/CD Pipeline</span>
            <span className="guide-time-badge">10 min</span>
          </div>
          <span className="guide-accordion-arrow">{isPillarOpen(4) ? '▼' : '▶'}</span>
        </button>
        {isPillarOpen(4) && (
          <div className="guide-accordion-body">
            {/* Screen 1 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub Repository" />
                <TimeMarker time="0:00 – 3:00" />
              </div>
              <h4>Show Workflow Files</h4>
              <p>Open: <code>.github/workflows/apim-security-scan.yml</code></p>
              <p>Walk through the YAML showing 3 jobs: lint → security-scan → whatif</p>
              <TalkTrack>"Two workflow files. apim-security-scan.yml runs on every PR — it's the security gate. deploy-apim.yml runs on merge to main — it deploys to Azure. Both run on GitHub-hosted ubuntu-latest runners."</TalkTrack>
            </div>

            <WorkflowBox>
              <pre className="dg2-yaml-snippet">{`on:
  pull_request:                    # Triggers on every PR
    paths:
      - 'policies/**'             # Only when policy files change
      - 'infra/**'                # Or infrastructure changes
      - 'security-scanner/**'     # Or scanner rule changes`}</pre>
              <ul className="dg2-workflow-list">
                <li><strong>Runner:</strong> <code>ubuntu-latest</code> — GitHub-hosted, free for public repos, $0.008/min for private</li>
                <li><strong>Self-hosted option:</strong> For enterprise, add <code>runs-on: self-hosted</code> with labels for specific runner groups</li>
                <li><strong>Concurrency:</strong> Each PR gets its own workflow run. Multiple PRs run in parallel</li>
                <li><strong>Caching:</strong> Python dependencies can be cached with <code>actions/setup-python</code> cache: pip</li>
              </ul>
            </WorkflowBox>

            {/* Screen 2 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub PR #1" />
                <TimeMarker time="3:00 – 5:00" />
              </div>
              <h4>Show the Blocked PR</h4>
              <p>Open: <code>https://github.com/sautalwar/how_APIM_works/pull/1</code></p>
              <ul className="guide-bullet-list">
                <li>Show: Failed checks, blocked merge, PR comment with findings table</li>
              </ul>
              <TalkTrack>"PR #1 tried to add a public API with no auth and wildcard CORS. The pipeline caught it in under 2 minutes. The merge button is blocked. The PR comment tells the developer exactly what to fix."</TalkTrack>
            </div>

            {/* Screen 3 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub Actions" />
                <TimeMarker time="5:00 – 7:00" />
              </div>
              <h4>Show Job Details</h4>
              <p>Click into the failed workflow run. Show each job step with timing:</p>
              <ul className="guide-bullet-list">
                <li>Checkout: 2s</li>
                <li>Setup Python 3.12: 5s</li>
                <li>Install dependencies: 3s</li>
                <li>Security scan (text): 2s</li>
                <li>Security scan (SARIF): 2s</li>
                <li>Upload SARIF: 5s</li>
                <li>Check for critical: <strong>FAIL</strong></li>
                <li>Comment PR: 3s</li>
              </ul>
              <TalkTrack>"Under 30 seconds of actual computation. The workflow ran 3 scans — text for human readability, SARIF for GitHub Security tab, and JSON for the PR comment. All from the same scanner."</TalkTrack>
            </div>

            {/* Screen 4 */}
            <div className="dg2-screen-block">
              <div className="dg2-screen-meta">
                <ScreenIndicator type="github" label="GitHub" />
                <TimeMarker time="7:00 – 10:00" />
              </div>
              <h4>Fix → Pass → Merge Flow</h4>
              <ol className="guide-ordered-list">
                <li>Developer reads findings — exact rule ID, OWASP reference</li>
                <li>Fixes policy: adds validate-jwt, restricts CORS origins, adds rate limiting</li>
                <li>Pushes fix → CI re-triggers automatically</li>
                <li>Scanner passes ✅ → Copilot approves ✅</li>
                <li>Merge to main → Deploy workflow triggers</li>
                <li>Bicep deploys updated policies to APIM in Azure</li>
                <li>API is now secure — zero downtime, full Git audit trail</li>
              </ol>
              <TalkTrack>"The entire loop — from insecure PR to secure production deployment — is automated. No manual security reviews, no deployment delays. Every policy change is scanned, AI-reviewed, and deployed through CI/CD."</TalkTrack>
            </div>

            <CopilotCallout>
              <p>
                In the CI/CD pipeline, Copilot operates at two levels: <strong>(1)</strong> The Agentic Workflow
                reviews the PR alongside the automated scanner — it adds context the scanner can't provide.
                <strong> (2)</strong> When the developer pushes a fix, Copilot verifies the fix is correct and
                approves the PR. The scanner gives you deterministic pass/fail. Copilot gives you <em>understanding</em>.
              </p>
            </CopilotCallout>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Architecture Guide Tab ─── */
function ArchitectureGuide() {
  const [openNotes, setOpenNotes] = useState({});

  const toggleNote = (id) => {
    setOpenNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const NoteButton = ({ id }) => (
    <button
      className={`ag-note-btn${openNotes[id] ? ' ag-note-btn-active' : ''}`}
      onClick={() => toggleNote(id)}
      title="Toggle talk track notes"
    >
      📝
    </button>
  );

  const NotePanel = ({ id, borderClass, whatThisIs, talkTrack, technicalDetails, demoAction, expectedOutput }) => {
    if (!openNotes[id]) return null;
    return (
      <div className={`ag-notes-panel ${borderClass}`}>
        <div className="ag-notes-section">
          <h4 className="ag-notes-heading">What This Is</h4>
          <p>{whatThisIs}</p>
        </div>
        <div className="ag-notes-section">
          <h4 className="ag-notes-heading">Talk Track</h4>
          <blockquote className="ag-talk-track">
            <span className="ag-talk-icon">💬</span>
            <p>{talkTrack}</p>
          </blockquote>
        </div>
        {technicalDetails && (
          <div className="ag-notes-section">
            <h4 className="ag-notes-heading">Technical Details</h4>
            <ul className="ag-tech-list">
              {technicalDetails.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {demoAction && (
          <div className="ag-notes-section">
            <h4 className="ag-notes-heading">Demo Action</h4>
            <pre className="ag-code-block"><code>{demoAction}</code></pre>
          </div>
        )}
        {expectedOutput && (
          <div className="ag-notes-section">
            <h4 className="ag-notes-heading">Expected Output</h4>
            <div className="ag-expected-output">{expectedOutput}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="arch2-container">
      <h2 className="section-title">Architecture Guide</h2>
      <p className="arch2-subtitle">
        Interactive architecture walkthrough — click 📝 on any component to expand the talk track, technical details, and demo commands.
      </p>

      {/* Legend */}
      <div className="arch2-legend">
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-azure"></span>Azure Services</div>
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-github"></span>GitHub Services</div>
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-backend"></span>Backend / Compute</div>
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-choke"></span>Choking Point (request blocked)</div>
        <div className="arch2-legend-item"><span className="arch2-swatch arch2-sw-agentic"></span>Agentic Workflow</div>
      </div>

      {/* ── SECTION 1: CI/CD & Security Pipeline ── */}
      <div className="arch2-section">
        <div className="arch2-section-header">
          <span className="arch2-section-title">CI/CD &amp; Security Pipeline</span>
          <span className="arch2-pillar-badge arch2-pillar-purple">Pillar 3: Automated Scanning</span>
          <span className="arch2-pillar-badge arch2-pillar-gray">Pillar 4: Agentic Review</span>
        </div>

        {/* Row 1: Developer → GitHub Repo → GitHub Actions */}
        <div className="arch2-flow-row">
          <div className="ag-box-wrapper">
            <div className="arch2-box arch2-bdr-github ag-box-interactive">
              <NoteButton id="developer" />
              <div className="arch2-box-icon">👨‍💻</div>
              <div className="arch2-box-title">Developer</div>
              <div className="arch2-box-desc">Local dev environment</div>
            </div>
            <NotePanel
              id="developer"
              borderClass="ag-border-github"
              whatThisIs="The starting point — a developer working locally, making changes to APIM security policies (XML files) or infrastructure (Bicep)."
              talkTrack={`"Every change to your API security starts here — a developer modifies a policy XML file in their IDE. These aren't code changes; they're security configuration changes. And that's exactly what makes them dangerous — one wrong line and your API is exposed. Let me show you what happens when this developer pushes their change."`}
              demoAction="git diff policies/"
              expectedOutput="Shows modified XML policy file"
            />
          </div>
          <div className="arch2-arrow-group">
            <div className="arch2-flow-label">git push / PR</div>
            <div className="arch2-arrow-line">→</div>
          </div>
          <div className="ag-box-wrapper">
            <div className="arch2-box arch2-bdr-github ag-box-interactive">
              <NoteButton id="github-repo" />
              <div className="arch2-box-icon">🔀</div>
              <div className="arch2-box-title">GitHub Repository</div>
              <div className="arch2-box-desc">Source code &amp; policy XML files</div>
            </div>
            <NotePanel
              id="github-repo"
              borderClass="ag-border-github"
              whatThisIs="GitHub repository (sautalwar/how_APIM_works) stores all policy XML files, Bicep infrastructure, scanner rules, and CI/CD workflows as version-controlled code."
              talkTrack={`"Everything is code. Your security policies aren't configured in a portal and forgotten — they live in Git. Every change is tracked, every version is recoverable, and every modification goes through a PR review. This is GitOps for API security. Let me show you the policy files."`}
              technicalDetails={[
                'policies/ — 4 policy files + 6 reusable fragments',
                'infra/ — Bicep IaC (APIM instance, API definitions, policy assignments)',
                'security-scanner/ — Python scanner + 18 OWASP rules',
                '.github/workflows/ — 2 CI/CD pipelines',
                '.github/copilot/ — Agentic Workflow AI reviewer instructions',
              ]}
              demoAction="Open https://github.com/sautalwar/how_APIM_works"
              expectedOutput="Repository with organized folder structure"
            />
          </div>
          <div className="arch2-arrow-group">
            <div className="arch2-flow-label">webhook trigger</div>
            <div className="arch2-arrow-line">→</div>
          </div>
          <div className="ag-box-wrapper">
            <div className="arch2-box arch2-bdr-github ag-box-interactive">
              <NoteButton id="github-actions" />
              <div className="arch2-box-icon">⚙️</div>
              <div className="arch2-box-title">GitHub Actions CI</div>
              <div className="arch2-box-desc">Automated pipeline</div>
            </div>
            <NotePanel
              id="github-actions"
              borderClass="ag-border-github"
              whatThisIs="Automated CI pipeline that triggers on every PR that touches policies/ or infra/ files. Runs 3 sequential gates before any merge is allowed."
              talkTrack={`"The moment a PR is created, GitHub Actions kicks in automatically. It runs three gates in sequence: first XML syntax validation, then our custom security scanner with 18 OWASP rules, then a Bicep what-if to preview infrastructure changes. If ANY gate fails, the PR is blocked. Nothing reaches production without passing all three."`}
              technicalDetails={[
                'Gate 1: XML Lint — Validates all policy XML is syntactically correct using Python ElementTree',
                'Gate 2: Security Scan — Runs scanner.py with --fail-on high — blocks on High or Critical findings',
                'Gate 3: Bicep What-If — Previews Azure infrastructure changes before deployment',
                'SARIF results uploaded to GitHub Security tab (appears alongside CodeQL findings)',
                'PR comment auto-generated with finding count and blocking issues table',
              ]}
              demoAction="Open https://github.com/sautalwar/how_APIM_works/pull/1 → Show failed CI checks"
              expectedOutput={'Failed check "Policy Security Scan" — click to see 3 critical + 4 high findings'}
            />
          </div>
        </div>

        {/* Pipeline Gates detail */}
        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
        </div>

        <div className="ag-box-wrapper">
          <div className="arch2-detail-card arch2-bdr-github ag-box-interactive" style={{ position: 'relative' }}>
            <NoteButton id="pipeline-gates" />
            <div className="arch2-detail-header">🔒 Pipeline Gates (run in GitHub Actions)</div>
            <div className="arch2-detail-grid">
              <div className="arch2-detail-step"><strong>1.</strong> XML Lint — validate policy syntax</div>
              <div className="arch2-detail-step"><strong>2.</strong> Security Scan — Python scanner, 18 OWASP rules</div>
              <div className="arch2-detail-step"><strong>3.</strong> Bicep What-If — preview infra changes</div>
            </div>
          </div>
          <NotePanel
            id="pipeline-gates"
            borderClass="ag-border-github"
            whatThisIs="The three sequential validation steps that run inside GitHub Actions."
            talkTrack={`"Let me break down what each gate does. Gate 1 is XML Lint — it validates syntax. A malformed XML policy would crash the APIM gateway, so we catch that first. Gate 2 is the security scanner — this is where the 18 OWASP rules run. It checks for missing JWT auth, wildcard CORS, no rate limiting, exposed server headers — all the things that create real vulnerabilities. Gate 3 is Bicep What-If — it shows you exactly what infrastructure would change before you deploy, like a terraform plan."`}
            technicalDetails={[
              'Gate 1: python -c "import xml.etree.ElementTree; xml.etree.ElementTree.parse(\'file.xml\')"',
              'Gate 2: python scanner.py policies/ --format sarif --fail-on high',
              'Gate 3: az deployment group what-if --template-file infra/main.bicep',
              'Each gate must pass before the next runs (sequential dependency)',
            ]}
            demoAction="Click on the failed check in PR #1 → Show job log details"
            expectedOutput="Gate 1 passes ✅, Gate 2 FAILS ❌ (OWASP violations), Gate 3 SKIPPED ⏭️"
          />
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">SARIF findings uploaded</div>
        </div>

        {/* Scanner Detail */}
        <div className="ag-box-wrapper">
          <div className="arch2-detail-card arch2-bdr-github ag-box-interactive" style={{ position: 'relative' }}>
            <NoteButton id="security-scanner" />
            <div className="arch2-detail-header">🔍 Python Security Scanner</div>
            <div className="arch2-detail-grid">
              <div className="arch2-detail-step">18 OWASP Rules checked</div>
              <div className="arch2-detail-step">XML Policy Analysis</div>
              <div className="arch2-detail-step">SARIF → GitHub Security Tab</div>
              <div className="arch2-detail-step">Runs on every PR automatically</div>
            </div>
          </div>
          <NotePanel
            id="security-scanner"
            borderClass="ag-border-github"
            whatThisIs="Custom Python scanner (scanner.py) with 18 security rules defined in YAML, each mapped to an OWASP API Top 10 category. Parses XML policies and checks for security gaps."
            talkTrack={`"This is the heart of the automated scanning. 18 rules, each mapped to a specific OWASP API vulnerability. The scanner parses every XML policy file, runs XPath queries and regex patterns against them, and outputs findings in SARIF format — the same format GitHub uses for CodeQL. So your API security findings appear right alongside your code security findings. One dashboard, one workflow."`}
            technicalDetails={[
              'AUTH001 (CRITICAL, API2): Missing validate-jwt — API is unauthenticated',
              'AUTH002 (CRITICAL, API2): JWT missing require-signed-tokens — token forgery possible',
              'AUTH003 (HIGH, API2): JWT missing expiration — replay attacks possible',
              'RATE001 (HIGH, API4): Missing rate limiting — DDoS/scraping vulnerable',
              'RATE002 (MEDIUM, API4): Excessive rate limit (>1000/min) — too permissive',
              'CORS001 (CRITICAL, API8): Wildcard CORS origin * — any website can call API',
              'CORS002 (CRITICAL, API8): allow-credentials=true + wildcard — worst CORS config',
              'HDR001 (MEDIUM, API8): Server header not removed — tech fingerprinting',
              'HDR002 (MEDIUM, API8): Missing X-Content-Type-Options — MIME sniffing',
              'HDR003 (HIGH, API8): Missing Strict-Transport-Security — no HSTS',
              'HDR004 (MEDIUM, API8): X-Powered-By not removed — framework disclosure',
              'ERR001 (HIGH, API8): Missing on-error section — stack trace leaks',
              'NET001 (CRITICAL, API8): Backend URL uses HTTP — unencrypted traffic',
              'NET002 (HIGH, API7): References to internal IPs — SSRF risk',
              'HTTP001 (MEDIUM, API8): TRACE method not blocked — XST attacks',
              'DATA001 (HIGH, API4): No request size limit — resource exhaustion',
              'Scanner uses 8 detection strategies: required XPath, required attribute, forbidden content, forbidden pattern, required pattern, attribute threshold, compound, compound custom',
            ]}
            demoAction={`cd security-scanner\npython scanner.py --policy-dir ../policies --format text`}
            expectedOutput="Scanner analyzes all XML files, reports by severity. Secure policies pass clean; insecure ones trigger critical/high findings."
          />
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">Agentic Workflow triggers</div>
        </div>

        {/* Copilot Agentic Review */}
        <div className="ag-box-wrapper">
          <div className="arch2-box arch2-box-wide arch2-bdr-agentic ag-box-interactive" style={{ position: 'relative' }}>
            <NoteButton id="copilot-agentic" />
            <div className="arch2-box-icon">🤖</div>
            <div className="arch2-box-title">Copilot Agentic Review</div>
            <div className="arch2-box-desc">AI OWASP Analysis — reviews SARIF output + policy XML, posts PR comments</div>
          </div>
          <NotePanel
            id="copilot-agentic"
            borderClass="ag-border-agentic"
            whatThisIs="GitHub Copilot AI agent configured via .github/copilot/agentic-security-review.md. Automatically reviews every PR touching policies/ or infra/ for OWASP compliance."
            talkTrack={`"This is the future of security review. Instead of waiting days for a human security expert, an AI agent reviews the policy in minutes. It doesn't just check syntax — it understands OWASP. It explains WHY a wildcard CORS is dangerous, references the specific OWASP category, and provides the exact XML fix. And it does this consistently on every single PR, 24/7. No other cloud vendor offers this — AWS doesn't have agentic workflows, GCP doesn't have native policy scanning. Only Microsoft gives you APIM + GitHub + Copilot as a unified security platform."`}
            technicalDetails={[
              'Reviews 9 security categories: Authentication, Authorization, Rate Limiting, CORS, Headers, Data Protection, Network Security, Error Handling, Infrastructure',
              'On failure: Creates review with per-issue comments (severity emoji, OWASP ID, vulnerability explanation, corrected XML code suggestion)',
              'On success: Approves with "✅ APIM Security Review Passed"',
              'Critical auto-fail rules: No JWT = fail, Wildcard CORS = fail, HTTP backend = fail, No rate limiting = fail',
            ]}
            demoAction="Open PR #1 → Look for Copilot review comments (if Copilot Enterprise is enabled)"
            expectedOutput="AI review comment explaining OWASP violations with code fix suggestions"
          />
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">approves / blocks PR</div>
        </div>

        {/* CHOKE POINT 1 */}
        <div className="ag-box-wrapper">
          <div className="arch2-choke ag-box-interactive" style={{ position: 'relative' }}>
            <NoteButton id="choke1" />
            <span className="arch2-choke-icon">❌</span>
            <div className="arch2-choke-body">
              <div className="arch2-choke-title">CHOKE POINT 1</div>
              <div className="arch2-choke-desc">PR blocked if security scan fails or AI finds OWASP violations</div>
            </div>
          </div>
          <NotePanel
            id="choke1"
            borderClass="ag-border-choke"
            whatThisIs="The merge block — PR cannot be merged if security scan fails or AI review finds OWASP violations."
            talkTrack={`"This is the first choking point. The PR is blocked right here. Look — the merge button is grayed out. Even if the developer has admin access, the branch protection rules prevent the merge until the security scan passes. This is shift-left security at its finest — we catch the vulnerability at the PR level, not in production at 2 AM."`}
            demoAction="Show PR #1 merge button — it's blocked ❌"
            expectedOutput={'Grayed out merge button with "Required status check failed" message'}
          />
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">merge approved</div>
        </div>

        <div className="arch2-box arch2-box-wide arch2-bdr-azure">
          <div className="arch2-box-icon">🚀</div>
          <div className="arch2-box-title">Deploy Pipeline</div>
          <div className="arch2-box-desc">azd deploy / Bicep — provisions APIM, Container Apps, App Insights</div>
        </div>
      </div>

      {/* ── SECTION 2: API Client Request Flow ── */}
      <div className="arch2-section">
        <div className="arch2-section-header">
          <span className="arch2-section-title">API Client Request Flow</span>
          <span className="arch2-pillar-badge arch2-pillar-blue">Pillar 1: APIM Gateway</span>
        </div>

        <div className="arch2-flow-row">
          <div className="ag-box-wrapper">
            <div className="arch2-box arch2-bdr-backend ag-box-interactive">
              <NoteButton id="api-client" />
              <div className="arch2-box-icon">🌐</div>
              <div className="arch2-box-title">API Client / Browser</div>
              <div className="arch2-box-desc">External consumer</div>
            </div>
            <NotePanel
              id="api-client"
              borderClass="ag-border-backend"
              whatThisIs="Any external consumer making API calls — browser, mobile app, third-party integration, Postman, curl."
              talkTrack={`"Now let's switch to the runtime flow. An API client sends a request. Without APIM, this goes directly to your backend — no security, no monitoring, no control. With APIM, every request passes through the gateway first. Let me show you what happens."`}
              demoAction="curl http://localhost:4000/api/products"
              expectedOutput="Unprotected backend returns all data — no auth, no rate limits, no security headers"
            />
          </div>
          <div className="arch2-arrow-group">
            <div className="arch2-flow-label">HTTPS request + subscription key</div>
            <div className="arch2-arrow-line">→</div>
          </div>
          <div className="ag-box-wrapper">
            <div className="arch2-box arch2-bdr-azure arch2-box-accent ag-box-interactive">
              <NoteButton id="apim-gateway" />
              <div className="arch2-box-icon">🛡️</div>
              <div className="arch2-box-title">Azure API Management Gateway</div>
              <div className="arch2-box-desc">apim-security-demo-dev-xxx.azure-api.net</div>
            </div>
            <NotePanel
              id="apim-gateway"
              borderClass="ag-border-azure"
              whatThisIs="The API gateway (Developer Tier) at apim-security-demo-dev-xxx.azure-api.net. All API traffic passes through here. Enforces security policies declaratively via XML — no custom code needed."
              talkTrack={`"Azure API Management is the core of this architecture. It sits in front of your backend API and acts as a programmable security checkpoint. Every single request passes through four policy stages — Inbound, Backend, Outbound, and On-Error. Security is enforced declaratively through XML policies, not custom code. This means your security configuration is auditable, version-controlled, and scannable. Let's walk through each stage."`}
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: APIM Policy Pipeline ── */}
      <div className="arch2-section">
        <div className="arch2-section-header">
          <span className="arch2-section-title">APIM Policy Pipeline</span>
          <span className="arch2-pillar-badge arch2-pillar-blue">Pillar 1: APIM Gateway</span>
          <span className="arch2-pillar-badge arch2-pillar-green">Pillar 2: Policy Enforcement</span>
        </div>

        <div className="arch2-apim-gateway">
          <div className="arch2-apim-header">
            <span className="arch2-apim-header-icon">🛡️</span>
            Azure API Management
            <span className="arch2-tier-badge">Developer Tier</span>
          </div>

          {/* Subscription Key Check — Choke Point 2 */}
          <div className="ag-box-wrapper">
            <div className="arch2-choke arch2-choke-inline ag-box-interactive" style={{ position: 'relative' }}>
              <NoteButton id="choke2" />
              <span className="arch2-choke-icon">❌</span>
              <div className="arch2-choke-body">
                <div className="arch2-choke-title">CHOKE POINT 2: Subscription Key Check</div>
                <div className="arch2-choke-desc">401 Unauthorized if no valid subscription key in header</div>
              </div>
            </div>
            <NotePanel
              id="choke2"
              borderClass="ag-border-choke"
              whatThisIs="First runtime security check — APIM validates the Ocp-Apim-Subscription-Key header before any policy even runs."
              talkTrack={`"Choke point two — the subscription key check. Before any policy runs, APIM checks if the caller has a valid subscription key. This identifies WHICH application is calling your API. You can revoke access instantly by disabling their subscription. No key? 401 Unauthorized. The request dies right here."`}
              demoAction={`curl -s -w "\\nHTTP Status: %{http_code}\\n" https://apim-security-demo-dev-exxlcmfwvdwzi.azure-api.net/products-api/products`}
              expectedOutput={'HTTP 401 — "Access denied due to missing subscription key"'}
            />
          </div>

          <div className="arch2-apim-vert-arrow">▼</div>

          {/* Inbound Policies */}
          <div className="ag-box-wrapper">
            <div className="arch2-apim-stage arch2-apim-inbound ag-box-interactive" style={{ position: 'relative' }}>
              <NoteButton id="inbound" />
              <div className="arch2-apim-stage-label">INBOUND POLICIES</div>
              <div className="arch2-apim-policy-list">
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">🔑</span>
                  <div>
                    <strong>JWT / OAuth Validation</strong> (validate-jwt)
                    <div className="arch2-policy-detail">Checks Azure AD token, expiry, audience</div>
                  </div>
                </div>
                <div className="ag-box-wrapper">
                  <div className="arch2-choke arch2-choke-sm ag-box-interactive" style={{ position: 'relative' }}>
                    <NoteButton id="choke3" />
                    <span className="arch2-choke-icon">❌</span>
                    <div className="arch2-choke-body">
                      <div className="arch2-choke-title">CHOKE POINT 3</div>
                      <div className="arch2-choke-desc">401 if invalid / missing JWT</div>
                    </div>
                  </div>
                  <NotePanel
                    id="choke3"
                    borderClass="ag-border-choke"
                    whatThisIs="Blocks requests without a valid JWT token issued by Azure Active Directory."
                    talkTrack={`"Choke point three — JWT validation. Even with a valid subscription key, you still need a JWT token from Azure AD. The token must be signed, not expired, issued by our tenant, and scoped to our API audience. Subscription keys identify the APPLICATION. JWT tokens identify the USER. Together, that's zero-trust API security."`}
                    demoAction={`curl -s -w "\\nHTTP Status: %{http_code}\\n" -H "Ocp-Apim-Subscription-Key: 4ebbfcbaef1c4e07a512339b62d108ca" https://apim-security-demo-dev-exxlcmfwvdwzi.azure-api.net/products-api/products`}
                    expectedOutput={'HTTP 401 — "Access denied. Valid JWT token required."'}
                  />
                </div>
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">⏱️</span>
                  <div>
                    <strong>Rate Limiting</strong>
                    <div className="arch2-policy-detail">60/min per IP (global) · 100/min per subscription (API-level)</div>
                  </div>
                </div>
                <div className="ag-box-wrapper">
                  <div className="arch2-choke arch2-choke-sm ag-box-interactive" style={{ position: 'relative' }}>
                    <NoteButton id="choke4" />
                    <span className="arch2-choke-icon">❌</span>
                    <div className="arch2-choke-body">
                      <div className="arch2-choke-title">CHOKE POINT 4</div>
                      <div className="arch2-choke-desc">429 Too Many Requests</div>
                    </div>
                  </div>
                  <NotePanel
                    id="choke4"
                    borderClass="ag-border-choke"
                    whatThisIs="Blocks requests that exceed the rate limit threshold."
                    talkTrack={`"Choke point four — rate limiting. This is your defense against OWASP API4, Unrestricted Resource Consumption. 60 requests per minute per IP at the global level. 100 per minute per subscription at the API level. And for destructive operations like DELETE, just 10 per minute. When you hit the limit, APIM returns HTTP 429 Too Many Requests with a Retry-After header. Your backend never sees the excess traffic — APIM absorbs it."`}
                    technicalDetails={[
                      'Global: rate-limit-by-key counter-key="@(context.Request.IpAddress)" calls="60"',
                      'API: rate-limit-by-key counter-key="@(context.Subscription.Id)" calls="100"',
                      'Operation: rate-limit-by-key counter-key="@(context.Subscription.Id + \'-delete\')" calls="10"',
                      'Response headers: X-RateLimit-Remaining, X-RateLimit-Limit',
                    ]}
                  />
                </div>
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">🌐</span>
                  <div>
                    <strong>CORS Enforcement</strong>
                    <div className="arch2-policy-detail">Only allowed origins (no wildcards)</div>
                  </div>
                </div>
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">🚫</span>
                  <div>
                    <strong>IP Filtering</strong>
                    <div className="arch2-policy-detail">Allowlisted IPs only</div>
                  </div>
                </div>
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">✅</span>
                  <div>
                    <strong>Request Validation</strong>
                    <div className="arch2-policy-detail">Size, content-type, SQLi/XSS pattern detection</div>
                  </div>
                </div>
              </div>
            </div>
            <NotePanel
              id="inbound"
              borderClass="ag-border-azure"
              whatThisIs="The main security enforcement layer. Six policy checks run in sequence on every inbound request."
              talkTrack={`"The inbound stage is where the heavy security lifting happens. Six checks in sequence: JWT validation confirms the user's identity via Azure AD tokens. Rate limiting caps requests at 60/min per IP and 100/min per subscription. CORS enforcement blocks cross-origin requests from unauthorized domains. IP filtering restricts access to known networks. Request validation checks content-type, body size, and blocks SQL injection and XSS patterns. And the subscription key check we already saw. All declarative XML — your backend doesn't need to implement any of this."`}
              technicalDetails={[
                'JWT/OAuth: validate-jwt checks Azure AD token, expiry, audience, issuer',
                'Rate Limiting: 60/min per IP (global), 100/min per subscription (API-level), 10/min for DELETE (operation-level)',
                'CORS: Explicit allowed origins only (portal.contoso.com, app.contoso.com) — never wildcards',
                'IP Filtering: Allowlisted IPs only via ip-filter policy',
                'Request Validation: validate-content with max-size, content-type checks, SQLi/XSS regex',
                'Subscription Key: Platform-level check, configured in API definition (subscriptionRequired: true)',
              ]}
            />
          </div>

          <div className="arch2-apim-vert-arrow">
            <span>▼</span>
            <span className="arch2-apim-arrow-label">request passes all checks</span>
          </div>

          {/* Backend */}
          <div className="ag-box-wrapper">
            <div className="arch2-apim-stage arch2-apim-backend ag-box-interactive" style={{ position: 'relative' }}>
              <NoteButton id="backend" />
              <div className="arch2-apim-stage-label">BACKEND</div>
              <div className="arch2-apim-policy-list">
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">➡️</span>
                  <div>
                    <strong>Forward to Container App</strong>
                    <div className="arch2-policy-detail">Backend URL + timeout (30s)</div>
                  </div>
                </div>
              </div>
            </div>
            <NotePanel
              id="backend"
              borderClass="ag-border-backend"
              whatThisIs="Forwards the validated request to the Container App backend with a 30-second timeout."
              talkTrack={`"Only requests that pass ALL inbound checks reach the backend. APIM forwards the request to our Container App with a 30-second timeout. The backend is a simple Node.js Express API — it doesn't need to know about authentication, rate limiting, or CORS. All of that is handled at the gateway. This is separation of concerns — your developers focus on business logic, APIM handles security."`}
            />
          </div>

          <div className="arch2-apim-vert-arrow">
            <span>▼</span>
            <span className="arch2-apim-arrow-label">response received from backend</span>
          </div>

          {/* Outbound Policies */}
          <div className="ag-box-wrapper">
            <div className="arch2-apim-stage arch2-apim-outbound ag-box-interactive" style={{ position: 'relative' }}>
              <NoteButton id="outbound" />
              <div className="arch2-apim-stage-label">OUTBOUND POLICIES</div>
              <div className="arch2-apim-policy-list">
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">🔐</span>
                  <div>
                    <strong>Add Security Headers</strong>
                    <div className="arch2-policy-detail">HSTS, CSP, X-Frame-Options, nosniff</div>
                  </div>
                </div>
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">🧹</span>
                  <div>
                    <strong>Strip Server Fingerprinting</strong>
                    <div className="arch2-policy-detail">Remove X-Powered-By, Server headers</div>
                  </div>
                </div>
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">🏷️</span>
                  <div>
                    <strong>Add X-Correlation-ID</strong>
                    <div className="arch2-policy-detail">Request tracing across services</div>
                  </div>
                </div>
              </div>
            </div>
            <NotePanel
              id="outbound"
              borderClass="ag-border-azure"
              whatThisIs="Modifies responses before they reach the client — adds security headers, strips fingerprinting headers, adds correlation IDs."
              talkTrack={`"On the way back, the outbound policies modify the response. We add HSTS to enforce HTTPS in browsers, CSP to prevent content injection, X-Frame-Options to block clickjacking, and X-Content-Type-Options to prevent MIME sniffing. We STRIP the Server and X-Powered-By headers — these tell attackers what technology stack you're running. And we add a correlation ID so you can trace any request across your entire system."`}
              technicalDetails={[
                'Add: Strict-Transport-Security (1 year), Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, X-Correlation-Id',
                'Remove: Server, X-Powered-By, X-AspNet-Version',
                'API-level adds: X-API-Version: 1.0, Cache-Control: no-store',
              ]}
            />
          </div>

          <div className="arch2-apim-vert-arrow">
            <span>▼</span>
            <span className="arch2-apim-arrow-label">if any error occurs in pipeline</span>
          </div>

          {/* On-Error */}
          <div className="ag-box-wrapper">
            <div className="arch2-apim-stage arch2-apim-onerror ag-box-interactive" style={{ position: 'relative' }}>
              <NoteButton id="onerror" />
              <div className="arch2-apim-stage-label">ON-ERROR</div>
              <div className="arch2-apim-policy-list">
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">🛑</span>
                  <div>
                    <strong>Mask Internal Error Details</strong>
                    <div className="arch2-policy-detail">Never expose stack traces to clients</div>
                  </div>
                </div>
                <div className="arch2-apim-policy-item">
                  <span className="arch2-policy-icon">🔄</span>
                  <div>
                    <strong>Return Safe Generic 500 Response</strong>
                    <div className="arch2-policy-detail">Controlled error output only</div>
                  </div>
                </div>
              </div>
            </div>
            <NotePanel
              id="onerror"
              borderClass="ag-border-choke"
              whatThisIs="Catches any error in the pipeline and returns a safe, generic error response — never exposes stack traces or internal details."
              talkTrack={`"And if anything goes wrong anywhere in the pipeline, the on-error handler catches it. This is critical for OWASP API8 — Security Misconfiguration. Our backend Express API intentionally leaks stack traces and server info on errors — that's common in development. But APIM's on-error policy masks all of that. The client gets a safe, generic 500 response. The actual error details go to Application Insights for your team to investigate — never to the attacker."`}
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Backend & Monitoring ── */}
      <div className="arch2-section">
        <div className="arch2-section-header">
          <span className="arch2-section-title">Backend &amp; Monitoring</span>
          <span className="arch2-pillar-badge arch2-pillar-green">Pillar 2: Policy Enforcement</span>
        </div>

        <div className="arch2-flow-row arch2-flow-row-wrap">
          <div className="ag-box-wrapper">
            <div className="arch2-box arch2-bdr-backend ag-box-interactive">
              <NoteButton id="container-apps" />
              <div className="arch2-box-icon">📦</div>
              <div className="arch2-box-title">Container Apps</div>
              <div className="arch2-box-desc">Node.js Express CRUD API</div>
            </div>
            <NotePanel
              id="container-apps"
              borderClass="ag-border-backend"
              whatThisIs="Azure Container Apps running the Node.js Express Products API. Serverless, auto-scaling, managed infrastructure."
              talkTrack={`"The backend is a Node.js Express API running on Azure Container Apps. It's serverless — auto-scales based on demand, no infrastructure management. The container image is stored in Azure Container Registry. The API provides standard CRUD operations for products. Notice it intentionally exposes stack traces on errors — that's to demonstrate why the APIM on-error policy matters."`}
              technicalDetails={[
                'Express.js with CRUD: GET /api/products, GET /api/products/:id, POST, PUT, DELETE',
                'Intentionally leaks err.stack and process.env.HOSTNAME on 500 errors',
                'Container image: ca9da16795a5acr.azurecr.io/products-api:latest',
              ]}
            />
          </div>
          <div className="arch2-arrow-group">
            <div className="arch2-flow-label">telemetry</div>
            <div className="arch2-arrow-line">→</div>
          </div>
          <div className="ag-box-wrapper">
            <div className="arch2-box arch2-bdr-azure ag-box-interactive">
              <NoteButton id="app-insights" />
              <div className="arch2-box-icon">📊</div>
              <div className="arch2-box-title">Application Insights</div>
              <div className="arch2-box-desc">Metrics, logs, request traces</div>
            </div>
            <NotePanel
              id="app-insights"
              borderClass="ag-border-azure"
              whatThisIs="Azure Application Insights collects telemetry from APIM — every API call, latency, errors, policy execution metrics."
              talkTrack={`"Application Insights captures everything — every API call, response time, error rate, and which policies triggered. You can correlate issues using the X-Correlation-ID header we add in the outbound policy. This gives your operations team full visibility into API health and security events."`}
            />
          </div>
        </div>

        <div className="arch2-vert-connector">
          <div className="arch2-vert-line"></div>
          <div className="arch2-vert-label">CRUD responses</div>
        </div>

        <div className="arch2-flow-row">
          <div className="arch2-box arch2-bdr-azure">
            <div className="arch2-box-icon">🗄️</div>
            <div className="arch2-box-title">ACR (Container Registry)</div>
            <div className="arch2-box-desc">Docker images for deployment</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Workflow Deep Dive ─── */
function WorkflowDeepDive() {
  const [openSections, setOpenSections] = useState({});

  const toggle = (id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const Accordion = ({ id, title, subtitle, children }) => (
    <div className="wd-accordion">
      <button className={`wd-accordion-header${openSections[id] ? ' wd-accordion-open' : ''}`} onClick={() => toggle(id)}>
        <div className="wd-accordion-title-group">
          <span className="wd-accordion-title">{title}</span>
          {subtitle && <span className="wd-accordion-subtitle">{subtitle}</span>}
        </div>
        <span className="wd-accordion-chevron">{openSections[id] ? '▼' : '▶'}</span>
      </button>
      {openSections[id] && <div className="wd-accordion-body">{children}</div>}
    </div>
  );

  const CustomerValue = ({ children }) => (
    <div className="wd-customer-value">
      <span className="wd-cv-icon">💎</span>
      <div className="wd-cv-text">{children}</div>
    </div>
  );

  const YamlBlock = ({ children }) => (
    <pre className="wd-yaml-block"><code>{children}</code></pre>
  );

  const Pipeline = ({ steps }) => (
    <div className="wd-pipeline">
      {steps.map((step, i) => (
        <span key={i} className="wd-pipeline-segment">
          <span className={`wd-pipeline-box ${step.color || 'wd-pipe-blue'}`}>{step.label}</span>
          {i < steps.length - 1 && <span className="wd-pipeline-arrow">→</span>}
        </span>
      ))}
    </div>
  );

  const RuleCard = ({ name, description, example, logic }) => (
    <div className="wd-rule-card">
      <h4 className="wd-rule-card-name">{name}</h4>
      <p className="wd-rule-card-desc">{description}</p>
      {example && <p className="wd-rule-card-example"><strong>Example:</strong> {example}</p>}
      {logic && <p className="wd-rule-card-logic"><strong>Logic:</strong> <code>{logic}</code></p>}
    </div>
  );

  const SecurityCategory = ({ number, title, owasp, items }) => (
    <div className="wd-sec-category">
      <div className="wd-sec-cat-header">
        <span className="wd-sec-cat-num">{number}</span>
        <div>
          <strong>{title}</strong>
          {owasp && <span className="wd-owasp-badge">{owasp}</span>}
        </div>
      </div>
      <ul className="wd-sec-cat-list">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );

  return (
    <div className="wd-container">
      <h2 className="section-title">🔬 Workflow Deep Dive</h2>
      <p className="wd-intro">
        A detailed technical walkthrough of the CI/CD pipeline, Python security scanner internals, and Copilot agentic review — everything that powers automated API security in this demo.
      </p>

      {/* ── SECTION 1: CI/CD Workflow Anatomy ── */}
      <Accordion id="cicd" title="CI/CD Workflow Anatomy" subtitle="apim-security-scan.yml — GitHub Actions pipeline breakdown">

        <h3 className="wd-section-heading">Pipeline Overview</h3>
        <Pipeline steps={[
          { label: 'PR Created', color: 'wd-pipe-gray' },
          { label: 'Job 1: Lint & Validate', color: 'wd-pipe-blue' },
          { label: 'Job 2: Security Scan', color: 'wd-pipe-orange' },
          { label: 'Job 3: Bicep What-If', color: 'wd-pipe-purple' },
          { label: '✅ Merge / ❌ Block', color: 'wd-pipe-green' },
        ]} />

        <h3 className="wd-section-heading">Trigger Configuration</h3>
        <YamlBlock>{`on:
  pull_request:
    paths: ['policies/**', 'infra/**', 'security-scanner/**']
  push:
    branches: [main]
    paths: ['policies/**', 'infra/**']`}</YamlBlock>
        <ul className="wd-detail-list">
          <li>Only triggers when policy/infra files change — not on every PR</li>
          <li>Runs on: PR events (for scanning) and push to main (for deployment preview)</li>
          <li>Does NOT run on schedule — it's event-driven</li>
        </ul>

        <h3 className="wd-section-heading">Permissions</h3>
        <YamlBlock>{`permissions:
  contents: read          # Read repo files
  security-events: write  # Upload SARIF to Security tab
  pull-requests: write    # Comment on PR with findings`}</YamlBlock>
        <CustomerValue>Principle of least privilege — workflow only gets the permissions it needs.</CustomerValue>

        <h3 className="wd-section-heading">Job 1: Lint &amp; Validate</h3>
        <div className="wd-job-detail">
          <p className="wd-runner-info">🖥️ <strong>Runner:</strong> <code>ubuntu-latest</code> — GitHub-hosted, 2-core Linux VM, ~$0.008/min for private repos, free for public</p>
          <div className="wd-step">
            <span className="wd-step-num">Step 1</span>
            <strong>Checkout code</strong> — <code>actions/checkout@v4</code>
          </div>
          <div className="wd-step">
            <span className="wd-step-num">Step 2</span>
            <strong>XML Syntax Validation</strong>
            <YamlBlock>{`python3 -c "import xml.etree.ElementTree as ET; ET.parse('file.xml')"`}</YamlBlock>
            <ul className="wd-detail-list">
              <li>Loops over all <code>policies/**/*.xml</code> files</li>
              <li>If ANY file has invalid XML → job fails → pipeline stops</li>
            </ul>
            <CustomerValue>Catches broken XML before it wastes time on security scanning. A malformed policy would crash the APIM gateway.</CustomerValue>
          </div>
          <div className="wd-step">
            <span className="wd-step-num">Step 3</span>
            <strong>Bicep Lint (conditional)</strong>
            <YamlBlock>{`az bicep build --file infra/main.bicep --stdout`}</YamlBlock>
            <ul className="wd-detail-list">
              <li>Only runs if .bicep files exist in the repo</li>
            </ul>
            <CustomerValue>Validates infrastructure-as-code syntax before deployment preview.</CustomerValue>
          </div>
        </div>

        <h3 className="wd-section-heading">Job 2: Security Scan <span className="wd-dep-badge">depends on Job 1</span></h3>
        <div className="wd-job-detail">
          <p className="wd-runner-info">🖥️ <strong>Runner:</strong> <code>ubuntu-latest</code></p>
          <div className="wd-step">
            <span className="wd-step-num">Step 1</span>
            <strong>Setup Python 3.12</strong> — <code>actions/setup-python@v5</code>
          </div>
          <div className="wd-step">
            <span className="wd-step-num">Step 2</span>
            <strong>Install scanner deps</strong> — <code>pip install -r security-scanner/requirements.txt</code> (just pyyaml)
          </div>
          <div className="wd-step">
            <span className="wd-step-num">Step 3</span>
            <strong>Text Report</strong>
            <YamlBlock>{`python scanner.py policies/ --format text || true`}</YamlBlock>
            <ul className="wd-detail-list">
              <li><code>|| true</code> means this step always passes — it's for human-readable logs only</li>
              <li>Parameters captured: rule_id, rule_name, severity, owasp, file, description, recommendation</li>
            </ul>
          </div>
          <div className="wd-step">
            <span className="wd-step-num">Step 4</span>
            <strong>SARIF Report</strong>
            <YamlBlock>{`python scanner.py policies/ --format sarif \\
  --output policy-scan-results.sarif \\
  --fail-on critical`}</YamlBlock>
            <ul className="wd-detail-list">
              <li><code>continue-on-error: true</code> — allows next steps even if critical findings</li>
              <li>Outputs structured SARIF 2.1.0 file with security-severity scores</li>
              <li>SARIF captures per finding: ruleId, severity level (error/warning/note), message, file location, line number</li>
            </ul>
          </div>
          <div className="wd-step">
            <span className="wd-step-num">Step 5</span>
            <strong>Upload SARIF</strong> — <code>github/codeql-action/upload-sarif@v3</code>
            <ul className="wd-detail-list">
              <li><code>if: always()</code> — uploads even when scanner finds issues</li>
              <li>Category: <code>apim-policy-security</code> — appears in GitHub Security tab alongside CodeQL</li>
            </ul>
            <CustomerValue>Your API security findings live alongside your code security findings. One dashboard.</CustomerValue>
          </div>
          <div className="wd-step">
            <span className="wd-step-num">Step 6</span>
            <strong>Check Critical</strong>
            <YamlBlock>{`python scanner.py policies/ --format json --fail-on high`}</YamlBlock>
            <ul className="wd-detail-list">
              <li>THIS is the gate — exits with code 1 if any HIGH or CRITICAL finding</li>
              <li>This step failing blocks the PR merge</li>
            </ul>
          </div>
          <div className="wd-step">
            <span className="wd-step-num">Step 7</span>
            <strong>PR Comment</strong> — <code>actions/github-script@v7</code> (only on PR + failure)
            <ul className="wd-detail-list">
              <li>Parses JSON output, counts critical/high findings</li>
              <li>Creates markdown table with severity counts</li>
              <li>Lists each blocking issue with rule ID, name, file, recommendation</li>
              <li>Posts as PR comment so developer sees findings without clicking into Actions</li>
            </ul>
          </div>
        </div>

        <h3 className="wd-section-heading">Job 3: Bicep What-If <span className="wd-dep-badge">main branch only, depends on Job 2</span></h3>
        <div className="wd-job-detail">
          <ul className="wd-detail-list">
            <li>Only runs after merge to main (not on PRs)</li>
            <li>Uses <code>azure/login@v2</code> with AZURE_CREDENTIALS secret</li>
            <li>Runs <code>az deployment group what-if</code> to preview infrastructure changes</li>
          </ul>
          <CustomerValue>See exactly what would change in Azure before it happens.</CustomerValue>
        </div>

        <h3 className="wd-section-heading">Self-hosted Runner Option</h3>
        <div className="wd-job-detail">
          <YamlBlock>{`# Change:
runs-on: ubuntu-latest
# To:
runs-on: [self-hosted, linux, security-scanner]`}</YamlBlock>
          <ul className="wd-detail-list">
            <li><strong>Why:</strong> Enterprise networks with private APIM instances, compliance requirements, custom scanning tools</li>
            <li><strong>Cost:</strong> GitHub-hosted = $0.008/min. Self-hosted = your infrastructure cost</li>
            <li><strong>Setup:</strong> Install GitHub Actions runner on your VM/container, add labels</li>
          </ul>
        </div>
      </Accordion>

      {/* ── SECTION 2: Python Security Scanner Internals ── */}
      <Accordion id="scanner" title="Python Security Scanner Internals" subtitle="scanner.py — Architecture, rule engine, and SARIF output">

        <h3 className="wd-section-heading">Architecture</h3>
        <Pipeline steps={[
          { label: 'Input (XML file/dir)', color: 'wd-pipe-gray' },
          { label: 'XML Parser (ElementTree)', color: 'wd-pipe-blue' },
          { label: 'Rule Engine (8 strategies)', color: 'wd-pipe-orange' },
          { label: 'Finding Objects', color: 'wd-pipe-purple' },
          { label: 'Output Formatter (Text/JSON/SARIF)', color: 'wd-pipe-green' },
        ]} />

        <h3 className="wd-section-heading">Data Model — What the scanner captures per finding</h3>
        <div className="wd-data-card">
          <div className="wd-data-card-title">Finding</div>
          <div className="wd-data-card-row"><span className="wd-dc-field">rule_id:</span> <span className="wd-dc-val">"AUTH001"</span> <span className="wd-dc-comment">{"// Unique rule identifier"}</span></div>
          <div className="wd-data-card-row"><span className="wd-dc-field">rule_name:</span> <span className="wd-dc-val">"Missing JWT..."</span> <span className="wd-dc-comment">{"// Human-readable name"}</span></div>
          <div className="wd-data-card-row"><span className="wd-dc-field">severity:</span> <span className="wd-dc-val">"critical"</span> <span className="wd-dc-comment">{"// critical|high|medium|low"}</span></div>
          <div className="wd-data-card-row"><span className="wd-dc-field">category:</span> <span className="wd-dc-val">"authentication"</span> <span className="wd-dc-comment">{"// Security domain"}</span></div>
          <div className="wd-data-card-row"><span className="wd-dc-field">owasp:</span> <span className="wd-dc-val">"API2"</span> <span className="wd-dc-comment">{"// OWASP API Top 10 reference"}</span></div>
          <div className="wd-data-card-row"><span className="wd-dc-field">description:</span> <span className="wd-dc-val">"..."</span> <span className="wd-dc-comment">{"// What's wrong"}</span></div>
          <div className="wd-data-card-row"><span className="wd-dc-field">recommendation:</span> <span className="wd-dc-val">"..."</span> <span className="wd-dc-comment">{"// How to fix it"}</span></div>
          <div className="wd-data-card-row"><span className="wd-dc-field">file:</span> <span className="wd-dc-val">"policies/api.xml"</span> <span className="wd-dc-comment">{"// Which file"}</span></div>
          <div className="wd-data-card-row"><span className="wd-dc-field">line:</span> <span className="wd-dc-val">1</span> <span className="wd-dc-comment">{"// Line number (for SARIF)"}</span></div>
        </div>

        <h3 className="wd-section-heading">8 Rule Detection Strategies</h3>
        <div className="wd-rule-grid">
          <RuleCard name="1. required" description="XPath search; finding if NO elements match" example="AUTH001 checks .//validate-jwt exists in inbound section" logic="root.findall(xpath) → empty = finding" />
          <RuleCard name="2. required_attribute" description="Element exists but attribute has wrong value" example="AUTH002 checks require-signed-tokens=&quot;true&quot; on validate-jwt" logic="Find element, compare attribute value" />
          <RuleCard name="3. forbidden_content" description="Element has a forbidden text value" example='CORS001 checks <origin>*</origin> — wildcard is forbidden' logic="Find element, check if text == forbidden_value" />
          <RuleCard name="4. forbidden_pattern" description="Regex finds something that shouldn't be there" example='NET001 checks base-url="http://" (non-HTTPS backend)' logic="re.search(pattern, content) → match = finding" />
          <RuleCard name="5. required_pattern" description="Regex doesn't find something that should be there" example="HDR001 checks for Server.*exists-action.*delete in outbound" logic="re.search(pattern, content) → no match = finding" />
          <RuleCard name="6. attribute_threshold" description="Numeric attribute exceeds a maximum" example="RATE002 checks if rate-limit calls > 1000/min" logic="Parse integer attribute, compare to max_value" />
          <RuleCard name="7. compound" description="Multiple XPath conditions must ALL match" example="" logic="All conditions true → finding" />
          <RuleCard name="8. compound_custom" description="Custom logic handlers for complex checks" example='CORS002 checks allow-credentials="true" WITH wildcard origin *' logic="Custom function checks CORS element + child origins" />
        </div>

        <h3 className="wd-section-heading">XPath Union Support</h3>
        <div className="wd-info-box">
          <p>Python ElementTree doesn't support <code>|</code> in XPath. The scanner's <code>_findall_union()</code> splits on <code>|</code>, runs each part separately, and merges results.</p>
          <p><strong>Example:</strong> <code>.//rate-limit-by-key|.//rate-limit</code> → searches for either element</p>
        </div>

        <h3 className="wd-section-heading">All 18 Rules — Complete Reference</h3>
        <div className="wd-table-wrapper">
          <table className="wd-rules-table">
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Severity</th><th>OWASP</th><th>Strategy</th><th>What It Checks</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>AUTH001</td><td>Missing JWT Validation</td><td><span className="wd-sev wd-sev-critical">CRITICAL</span></td><td>API2</td><td>required</td><td>validate-jwt exists in inbound</td></tr>
              <tr><td>AUTH002</td><td>JWT Missing Signed Tokens</td><td><span className="wd-sev wd-sev-critical">CRITICAL</span></td><td>API2</td><td>required_attribute</td><td>require-signed-tokens="true"</td></tr>
              <tr><td>AUTH003</td><td>JWT Missing Expiration</td><td><span className="wd-sev wd-sev-high">HIGH</span></td><td>API2</td><td>required_attribute</td><td>require-expiration-time="true"</td></tr>
              <tr><td>RATE001</td><td>Missing Rate Limiting</td><td><span className="wd-sev wd-sev-high">HIGH</span></td><td>API4</td><td>required</td><td>rate-limit-by-key or rate-limit exists</td></tr>
              <tr><td>RATE002</td><td>Excessive Rate Limit</td><td><span className="wd-sev wd-sev-medium">MEDIUM</span></td><td>API4</td><td>attribute_threshold</td><td>calls attribute ≤ 1000</td></tr>
              <tr><td>CORS001</td><td>Wildcard CORS Origin</td><td><span className="wd-sev wd-sev-critical">CRITICAL</span></td><td>API8</td><td>forbidden_content</td><td>origin text is not *</td></tr>
              <tr><td>CORS002</td><td>CORS Credentials + Wildcard</td><td><span className="wd-sev wd-sev-critical">CRITICAL</span></td><td>API8</td><td>compound_custom</td><td>allow-credentials + wildcard origin</td></tr>
              <tr><td>HDR001</td><td>Server Header Not Removed</td><td><span className="wd-sev wd-sev-medium">MEDIUM</span></td><td>API8</td><td>required_pattern</td><td>Server header delete in outbound</td></tr>
              <tr><td>HDR002</td><td>Missing X-Content-Type-Options</td><td><span className="wd-sev wd-sev-medium">MEDIUM</span></td><td>API8</td><td>required_pattern</td><td>nosniff header in outbound</td></tr>
              <tr><td>HDR003</td><td>Missing HSTS</td><td><span className="wd-sev wd-sev-high">HIGH</span></td><td>API8</td><td>required_pattern</td><td>Strict-Transport-Security in outbound</td></tr>
              <tr><td>HDR004</td><td>X-Powered-By Not Removed</td><td><span className="wd-sev wd-sev-medium">MEDIUM</span></td><td>API8</td><td>required_pattern</td><td>X-Powered-By delete in outbound</td></tr>
              <tr><td>ERR001</td><td>Missing On-Error</td><td><span className="wd-sev wd-sev-high">HIGH</span></td><td>API8</td><td>required</td><td>on-error/return-response exists</td></tr>
              <tr><td>NET001</td><td>HTTP Backend URL</td><td><span className="wd-sev wd-sev-critical">CRITICAL</span></td><td>API8</td><td>forbidden_pattern</td><td>base-url="http://" (non-localhost)</td></tr>
              <tr><td>NET002</td><td>Internal IP References</td><td><span className="wd-sev wd-sev-high">HIGH</span></td><td>API7</td><td>forbidden_pattern</td><td>169.254.x, 127.0.0.1, metadata.google</td></tr>
              <tr><td>HTTP001</td><td>TRACE Not Blocked</td><td><span className="wd-sev wd-sev-medium">MEDIUM</span></td><td>API8</td><td>required_pattern</td><td>TRACE method blocking</td></tr>
              <tr><td>DATA001</td><td>No Request Size Limit</td><td><span className="wd-sev wd-sev-high">HIGH</span></td><td>API4</td><td>required</td><td>validate-content with max-size</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className="wd-section-heading">SARIF Output Format</h3>
        <div className="wd-info-box">
          <ul className="wd-detail-list">
            <li><code>$.version</code>: "2.1.0"</li>
            <li><code>$.runs[0].tool.driver.name</code>: "apim-policy-scanner"</li>
            <li><code>$.runs[0].tool.driver.rules[]</code>: Rule definitions with security-severity scores (9.5=critical, 8.0=high, 5.5=medium, 3.0=low)</li>
            <li><code>$.runs[0].results[]</code>: Findings with ruleId, level, message, file location</li>
          </ul>
          <CustomerValue>SARIF is the industry standard. CodeQL, ESLint, Semgrep all use it. Your API security findings integrate seamlessly into GitHub's security dashboard.</CustomerValue>
        </div>

        <h3 className="wd-section-heading">Exit Code Logic</h3>
        <div className="wd-info-box">
          <ul className="wd-detail-list">
            <li><code>--fail-on</code> flag (default: <code>high</code>)</li>
            <li>Severity order: low(0) &lt; medium(1) &lt; high(2) &lt; critical(3)</li>
            <li>Any finding at threshold or above → exit code 1 → CI pipeline fails → PR blocked</li>
          </ul>
          <CustomerValue>You control the sensitivity. Block on critical only for less friction, or block on medium for maximum security.</CustomerValue>
        </div>
      </Accordion>

      {/* ── SECTION 3: Copilot Agentic Workflow ── */}
      <Accordion id="copilot" title="Copilot Agentic Workflow" subtitle="agentic-security-review.md — AI-powered PR review">

        <h3 className="wd-section-heading">How It Works</h3>
        <Pipeline steps={[
          { label: 'PR Created', color: 'wd-pipe-gray' },
          { label: 'GitHub detects review MD', color: 'wd-pipe-blue' },
          { label: 'Copilot reads PR diff', color: 'wd-pipe-orange' },
          { label: 'Analyzes 9 categories', color: 'wd-pipe-purple' },
          { label: 'Posts PR review', color: 'wd-pipe-green' },
        ]} />

        <h3 className="wd-section-heading">Trigger &amp; Execution</h3>
        <div className="wd-info-box">
          <ul className="wd-detail-list">
            <li><strong>Trigger:</strong> Automatically on PR that modifies <code>policies/**</code> or <code>infra/**</code></li>
            <li><strong>Runner:</strong> NOT a GitHub Actions runner — runs on GitHub's Copilot infrastructure</li>
            <li><strong>Permissions:</strong> <code>contents: read</code>, <code>pull-requests: write</code>, <code>issues: write</code></li>
            <li><strong>Tools available:</strong> <code>pull_requests</code>, <code>issues</code>, <code>security</code> (GitHub API access)</li>
            <li><strong>Timing:</strong> Runs within 2-5 minutes of PR creation</li>
            <li><strong>Requires:</strong> GitHub Copilot Enterprise license on the repository</li>
          </ul>
        </div>

        <h3 className="wd-section-heading">9 Security Categories Reviewed</h3>
        <div className="wd-sec-grid">
          <SecurityCategory number="1" title="Authentication" owasp="OWASP API2" items={['validate-jwt present?', 'signed tokens required?', 'expiration enforced?', 'audiences/issuers configured?']} />
          <SecurityCategory number="2" title="Authorization" owasp="OWASP API1, API5" items={['destructive ops need elevated roles?', 'object-level authz?', 'admin endpoints protected?']} />
          <SecurityCategory number="3" title="Rate Limiting" owasp="OWASP API4" items={['rate-limit policies present?', 'thresholds reasonable?', 'daily quota?']} />
          <SecurityCategory number="4" title="CORS Security" owasp="OWASP API8" items={['wildcard origins?', 'credentials + wildcard?', 'only known domains?']} />
          <SecurityCategory number="5" title="Header Security" owasp="OWASP API8" items={['fingerprinting headers removed?', 'security headers added?', 'internal headers stripped?']} />
          <SecurityCategory number="6" title="Data Protection" owasp="OWASP API3, API4" items={['request size limits?', 'sensitive field filtering?', 'PII masking?']} />
          <SecurityCategory number="7" title="Network Security" owasp="OWASP API7, API8" items={['HTTPS backends?', 'no internal IPs?', 'SSRF prevention?']} />
          <SecurityCategory number="8" title="Error Handling" owasp="OWASP API8" items={['on-error section?', 'safe messages?', 'error logging?']} />
          <SecurityCategory number="9" title="Infrastructure (Bicep)" owasp="" items={['TLS 1.2?', 'weak ciphers disabled?', 'managed identity?', 'App Insights?']} />
        </div>

        <h3 className="wd-section-heading">Output Behavior</h3>
        <div className="wd-info-box">
          <p><strong>Issues found →</strong> Creates PR review with per-line comments:</p>
          <ul className="wd-detail-list">
            <li><span className="wd-sev wd-sev-critical">🔴 CRITICAL</span> / <span className="wd-sev wd-sev-high">🟠 HIGH</span> / <span className="wd-sev wd-sev-medium">🟡 MEDIUM</span> severity badge</li>
            <li>OWASP API Top 10 ID reference</li>
            <li>Natural language explanation of WHY it's dangerous</li>
            <li>XML code suggestion with the fix</li>
            <li>Requests changes: "🚫 Security Review Failed — Found N critical issues"</li>
          </ul>
          <p><strong>No issues →</strong> Approves: "✅ APIM Security Review Passed"</p>
        </div>

        <h3 className="wd-section-heading">Critical Auto-Fail Rules</h3>
        <div className="wd-autofail-box">
          <div className="wd-autofail-item">❌ Never approve policy without JWT validation (unless documented as public)</div>
          <div className="wd-autofail-item">❌ Always flag wildcard CORS as critical</div>
          <div className="wd-autofail-item">❌ Always flag HTTP backend URLs as critical</div>
          <div className="wd-autofail-item">❌ Always ensure rate limiting exists</div>
        </div>

        <h3 className="wd-section-heading">Scanner vs Copilot Comparison</h3>
        <div className="wd-table-wrapper">
          <table className="wd-comparison-table">
            <thead>
              <tr><th>Aspect</th><th>Python Scanner</th><th>Copilot Agentic</th></tr>
            </thead>
            <tbody>
              <tr><td>Type</td><td>Deterministic rules</td><td>AI-powered analysis</td></tr>
              <tr><td>Rules</td><td>18 predefined</td><td>Understands OWASP theory</td></tr>
              <tr><td>Speed</td><td>~60 seconds</td><td>~2-5 minutes</td></tr>
              <tr><td>Output</td><td>SARIF (Security tab)</td><td>PR review comments</td></tr>
              <tr><td>Depth</td><td>Pattern matching</td><td>Contextual understanding</td></tr>
              <tr><td>Fixes</td><td>Generic recommendations</td><td>Exact XML code suggestions</td></tr>
              <tr><td>Nuance</td><td>Pass/fail per rule</td><td>Explains WHY it matters</td></tr>
              <tr><td>Coverage</td><td>Known patterns only</td><td>Can catch novel issues</td></tr>
              <tr className="wd-highlight-row"><td>Together</td><td colSpan="2">Complementary — scanner catches known patterns at speed, Copilot catches nuanced issues with context</td></tr>
            </tbody>
          </table>
        </div>

        <CustomerValue>Two layers of automated security review on every PR. The scanner gives you speed and deterministic coverage — 18 rules in 60 seconds. Copilot gives you depth and context — it explains the attack vector, references the OWASP category, and writes the fix for you. No other cloud vendor offers both deterministic scanning AND AI-powered review in a single integrated workflow. This is the Microsoft advantage.</CustomerValue>
      </Accordion>

      {/* ── SECTION 4: Finding Flow Pipeline ── */}
      <Accordion id="finding-flow" title="Finding Flow Pipeline" subtitle="How security findings move from XML to GitHub Security tab">

        <h3 className="wd-section-heading">End-to-End Data Flow</h3>
        <div className="wd-flow-pipeline">
          <div className="wd-flow-main-row">
            <div className="wd-flow-box wd-flow-input">Policy XML File</div>
            <span className="wd-flow-arrow">→</span>
            <div className="wd-flow-box wd-flow-scanner">scanner.py</div>
            <span className="wd-flow-arrow">→</span>
            <div className="wd-flow-box wd-flow-rules">18 OWASP Rules</div>
            <span className="wd-flow-arrow">→</span>
            <div className="wd-flow-box wd-flow-finding">Finding Objects</div>
            <span className="wd-flow-arrow">→</span>
            <div className="wd-flow-box wd-flow-sarif">SARIF 2.1.0</div>
            <span className="wd-flow-arrow">→</span>
            <div className="wd-flow-box wd-flow-upload">GitHub Upload</div>
            <span className="wd-flow-arrow">→</span>
            <div className="wd-flow-box wd-flow-tab">Security Tab</div>
          </div>
          <div className="wd-flow-branches">
            <div className="wd-flow-branch wd-flow-branch-json">
              <div className="wd-flow-branch-label">↓ JSON Format</div>
              <div className="wd-flow-box wd-flow-pr">PR Comment (blocking issues table)</div>
            </div>
            <div className="wd-flow-branch wd-flow-branch-text">
              <div className="wd-flow-branch-label">↓ Text Format</div>
              <div className="wd-flow-box wd-flow-log">Actions Log (human-readable)</div>
            </div>
          </div>
        </div>

        <h3 className="wd-section-heading">Stage-by-Stage Data Transformation</h3>
        <div className="wd-stage-list">
          <div className="wd-stage">
            <span className="wd-stage-label">Input</span>
            <p>Raw XML string + parsed ElementTree</p>
          </div>
          <div className="wd-stage">
            <span className="wd-stage-label">Rule Engine</span>
            <p>8 strategies applied per rule → Finding dataclass populated</p>
          </div>
          <div className="wd-stage">
            <span className="wd-stage-label">Finding Object</span>
            <p>rule_id, rule_name, severity, category, owasp, description, recommendation, file, line</p>
          </div>
          <div className="wd-stage">
            <span className="wd-stage-label">SARIF Transform</span>
            <p>Finding → SARIF result with ruleId, level (error/warning/note), message, physicalLocation, security-severity score</p>
          </div>
          <div className="wd-stage">
            <span className="wd-stage-label">GitHub Upload</span>
            <p>SARIF file → Code Scanning API → appears in Security tab with category "apim-policy-security"</p>
          </div>
          <div className="wd-stage">
            <span className="wd-stage-label">PR Comment</span>
            <p>JSON findings → markdown table → <code>github.rest.issues.createComment()</code> on PR</p>
          </div>
        </div>
      </Accordion>
    </div>
  );
}

/* ─── Main App ─── */
function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [healthy, setHealthy] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getProducts(categoryFilter);
      setProducts(res.data || []);
    } catch {
      addToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, addToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Health check polling
  useEffect(() => {
    const check = async () => {
      try {
        await api.checkHealth();
        setHealthy(true);
      } catch {
        setHealthy(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async (data, id) => {
    try {
      if (id) {
        await api.updateProduct(id, data);
        addToast('Product updated successfully');
      } else {
        await api.createProduct(data);
        addToast('Product created successfully');
      }
      setShowModal(false);
      setModalProduct(null);
      fetchProducts();
    } catch {
      addToast(id ? 'Failed to update product' : 'Failed to create product', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteProduct(id);
      addToast('Product deleted successfully');
      setDeleteTarget(null);
      fetchProducts();
    } catch {
      addToast('Failed to delete product', 'error');
    }
  };

  const openCreate = () => { setModalProduct(null); setShowModal(true); };
  const openEdit = (product) => { setModalProduct(product); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setModalProduct(null); };

  const tabs = [
    { id: 'overview', label: '📋 Demo Overview' },
    { id: 'architecture', label: '🏗️ Architecture' },
    { id: 'archguide', label: '🗺️ Architecture Guide' },
    { id: 'guide', label: '📖 Demo Guide' },
    { id: 'workflow', label: '🔬 Workflow Deep Dive' },
    { id: 'scanner', label: '🔍 Live Scanner' },
    { id: 'prsim', label: '🔄 PR Simulation' },
    { id: 'products', label: '🛒 Products API' },
  ];

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">
            ☁ Product<span>Hub</span>
          </div>
        </div>
        <div className="health-badge">
          <span
            className={`health-dot ${healthy === true ? 'healthy' : healthy === false ? 'unhealthy' : ''}`}
          />
          {healthy === null ? 'Checking...' : healthy ? 'API Connected' : 'API Offline'}
        </div>
      </header>

      <nav className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && <DemoOverview />}

      {activeTab === 'architecture' && <ArchitectureDiagram />}

      {activeTab === 'archguide' && <ArchitectureGuide />}

      {activeTab === 'guide' && <DemoGuide />}

      {activeTab === 'workflow' && <WorkflowDeepDive />}

      {activeTab === 'scanner' && <LiveScanner />}

      {activeTab === 'prsim' && <PRSimulation />}

      {activeTab === 'products' && (
        <>
          <div className="toolbar">
            <input
              className="search-input"
              type="text"
              placeholder="Filter by category..."
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <button className="btn btn-primary" onClick={openCreate}>
              + Add Product
            </button>
          </div>

          <main className="main-content">
            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <h3>Loading products...</h3>
                <p>Fetching data from the API</p>
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <h3>No products found</h3>
                <p>{categoryFilter ? `No products match "${categoryFilter}"` : 'Get started by adding your first product'}</p>
              </div>
            ) : (
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {showModal && (
        <ProductModal
          product={modalProduct}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      <ToastContainer toasts={toasts} />
    </>
  );
}

export default App;
