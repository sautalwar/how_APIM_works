# 🛡️ Azure APIM Security Demo with GitHub Agentic Workflows

> **End-to-end demo**: How Azure API Management secures APIs and how GitHub Agentic Workflows automate security guardrails to prevent vulnerabilities before they reach production.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   👨‍💻 Developer  ──→  📝 PR  ──→  🤖 AI Review  ──→  🔬 Scanner       │
│                                         │                    │          │
│                                    ✅ or ❌             📊 SARIF        │
│                                         │                    │          │
│                                    🔀 Merge  ──→  🚀 Deploy to Azure   │
│                                                        │                │
│                                                   ☁️ APIM Gateway       │
│                                                   🔒 Policy Engine      │
│                                                   📱 → 🖥️ Backend      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## What This Demo Shows

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API Gateway** | Azure API Management | Runtime security: JWT auth, rate limiting, CORS, header sanitization |
| **Policy-as-Code** | APIM Policy XML + Bicep IaC | Security policies defined, versioned, and deployed as code |
| **Automated Scanning** | Python Policy Scanner | Deterministic rule-based scanning of policies for misconfigurations |
| **AI Security Review** | GitHub Agentic Workflow | Context-aware AI review of policy changes (OWASP-aware) |
| **CI/CD Pipeline** | GitHub Actions | Security gates that block insecure changes from reaching production |

## Repository Structure

```
├── 📖 docs/                          # Education & documentation
│   ├── 01-apim-architecture.md       # How APIM works end-to-end
│   ├── 02-policy-pipeline.md         # Policy pipeline deep-dive
│   ├── 03-owasp-api-top10.md         # OWASP API Top 10 + APIM mitigations
│   ├── 04-security-automation.md     # GitHub Agentic Workflow explanation
│   └── 05-demo-walkthrough.md        # Step-by-step demo script
│
├── 🔌 sample-api/                    # Backend API (Node.js)
│   ├── server.js                     # Express CRUD API
│   └── Dockerfile                    # Container deployment
│
├── 🏗️ infra/                         # Azure Infrastructure (Bicep)
│   ├── main.bicep                    # Main deployment template
│   └── modules/                      # APIM, API definitions, policies
│
├── 📋 policies/                      # APIM Security Policies
│   ├── global-policy.xml             # Baseline security for all APIs
│   ├── api-level-policy.xml          # Products API security
│   ├── operation-level-policy.xml    # Admin-only operations
│   └── fragments/                    # Reusable policy building blocks
│       ├── jwt-validation.xml
│       ├── rate-limiting.xml
│       ├── cors-secure.xml
│       ├── ip-filtering.xml
│       ├── response-sanitization.xml
│       └── request-validation.xml
│
├── 🔬 security-scanner/              # Policy Security Scanner
│   ├── scanner.py                    # Scanning engine
│   ├── rules/rules.yaml             # Security rules (18 rules)
│   └── tests/                       # Test fixtures (secure + insecure)
│
├── 🤖 .github/
│   ├── copilot/
│   │   └── agentic-security-review.md  # AI security reviewer
│   └── workflows/
│       ├── apim-security-scan.yml      # CI: scan on every PR
│       └── deploy-apim.yml            # CD: deploy to Azure
│
└── 🎬 demo/scenarios/                # Live demo scripts
    ├── 01-insecure-policy-pr.md      # Wildcard CORS → blocked
    ├── 02-missing-auth-pr.md         # No JWT → AI suggests fix
    └── 03-owasp-violation-pr.md      # SSRF → auto-remediation
```

## Quick Start

### 1. Explore the Documentation
Start with the architecture overview to understand how APIM works:
```bash
# Read in order:
docs/01-apim-architecture.md    # How APIM works
docs/02-policy-pipeline.md      # Policy pipeline
docs/03-owasp-api-top10.md      # OWASP mitigations
docs/04-security-automation.md  # GitHub automation
```

### 2. Run the Security Scanner Locally
```bash
cd security-scanner
pip install -r requirements.txt

# Scan all policies
python scanner.py ../policies/ --format text

# Generate SARIF report
python scanner.py ../policies/ --format sarif -o results.sarif
```

### 3. Run Scanner Tests
```bash
python tests/test_scanner.py
```

### 4. Deploy to Azure
```bash
# Deploy backend API
cd sample-api
az webapp up --name products-api-dev --resource-group rg-apim-demo

# Deploy APIM infrastructure
az deployment group create \
  --resource-group rg-apim-demo \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam
```

### 5. Run the Demo
Follow the step-by-step guide: [`docs/05-demo-walkthrough.md`](docs/05-demo-walkthrough.md)

## Security Coverage

### OWASP API Top 10 (2023) — All 10 Addressed

| # | Vulnerability | APIM Policy | Scanner Rule | AI Review |
|---|--------------|-------------|--------------|-----------|
| API1 | Broken Object Level Auth | `validate-jwt` + user ID injection | ✅ AUTH001 | ✅ |
| API2 | Broken Authentication | `validate-jwt` (full config) | ✅ AUTH001-003 | ✅ |
| API3 | Property Level Auth | `set-body` (field filtering) | ✅ | ✅ |
| API4 | Unrestricted Consumption | `rate-limit` + `quota` + `validate-content` | ✅ RATE001-002, DATA001 | ✅ |
| API5 | Function Level Auth | Role-based `validate-jwt` per operation | ✅ AUTH001 | ✅ |
| API6 | Sensitive Business Flows | Aggressive rate limits + captcha check | ✅ RATE001 | ✅ |
| API7 | SSRF | URL allowlist + internal IP blocking | ✅ NET002 | ✅ |
| API8 | Security Misconfiguration | Headers, CORS, HTTPS, method blocking | ✅ CORS001-002, HDR001-004, NET001 | ✅ |
| API9 | Inventory Management | Version deprecation policy | ✅ | ✅ |
| API10 | Unsafe 3rd Party APIs | Response validation + sanitization | ✅ | ✅ |

## Why Microsoft?

| Capability | Microsoft | AWS | Google Cloud |
|-----------|-----------|-----|-------------|
| API Gateway with policy engine | ✅ APIM (50+ policies) | ⚠️ API Gateway (limited) | ⚠️ Apigee (separate product) |
| Policy-as-Code (Bicep/Terraform) | ✅ Native | ⚠️ CloudFormation | ⚠️ Terraform only |
| AI-powered security review | ✅ GitHub Agentic Workflows | ❌ | ❌ |
| Native CI/CD + SARIF integration | ✅ GitHub Actions | ⚠️ CodePipeline | ⚠️ Cloud Build |
| Unified security monitoring | ✅ Azure Monitor + Sentinel | ⚠️ CloudWatch + GuardDuty | ⚠️ Cloud Monitoring |
| Single vendor integration | ✅ End-to-end | ❌ Multi-tool | ❌ Multi-tool |

## License

This demo is provided for educational and demonstration purposes.
