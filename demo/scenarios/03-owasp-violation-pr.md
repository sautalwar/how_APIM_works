# Demo Scenario 3: OWASP Violation → Automated Detection & Remediation

## Scenario
A developer updates a policy to add a feature that inadvertently introduces an SSRF vulnerability (OWASP API7) and exposes internal error details (OWASP API8). The three-layer security system catches both issues.

## Steps to Demo

### 1. Create a branch
```bash
git checkout -b demo/ssrf-and-error-leak
```

### 2. Modify backend policy to allow dynamic URLs (SSRF risk)
Edit `policies/api-level-policy.xml` to add a feature that forwards to user-specified URLs:

```xml
<backend>
    <base />
    <!-- ❌ SSRF: Using user-supplied URL for backend -->
    <set-backend-service 
        base-url="@(context.Request.Headers.GetValueOrDefault("X-Target-Service",""))" />
</backend>
```

### 3. Remove safe error handling
Remove the `<on-error>` content, leaving raw error passthrough:

```xml
<on-error>
    <base />
    <!-- ❌ No custom error handling — backend stack traces leak to caller -->
</on-error>
```

### 4. Push and create PR
```bash
git add policies/
git commit -m "Add dynamic backend routing for multi-service support"
git push origin demo/ssrf-and-error-leak
```

### 5. Watch all three layers respond

**Layer 1: CI Policy Scanner**
```
🔴 [NET002] References to Internal IPs — SSRF risk detected
   The policy allows dynamic backend URL from user input
🟠 [ERR001] Missing On-Error Section
   No custom error handling — internal details may leak
```

**Layer 2: SARIF in GitHub Security Tab**
- 2 new findings with OWASP references
- Linked to specific lines in the changed files

**Layer 3: Agentic Workflow (AI Review)**
```markdown
## 🚫 Security Review Failed — 2 Critical Issues

### 🔴 CRITICAL: Server-Side Request Forgery (OWASP API7)

The backend policy at line 45 sets the backend URL from the 
`X-Target-Service` request header. This allows an attacker to:

1. **Access internal services**: `X-Target-Service: http://169.254.169.254/metadata`
2. **Port scan internal network**: `X-Target-Service: http://10.0.0.5:8080`
3. **Access cloud metadata**: Steal managed identity tokens

**Fix: Use an allowlist of approved backends:**

​```xml
<backend>
    <choose>
        <when condition="@(context.Request.Headers
            .GetValueOrDefault("X-Target-Service","") == "products")">
            <set-backend-service base-url="https://products-api.azurewebsites.net" />
        </when>
        <when condition="@(context.Request.Headers
            .GetValueOrDefault("X-Target-Service","") == "orders")">
            <set-backend-service base-url="https://orders-api.azurewebsites.net" />
        </when>
        <otherwise>
            <return-response>
                <set-status code="400" reason="Bad Request" />
                <set-body>{"error": "Invalid target service"}</set-body>
            </return-response>
        </otherwise>
    </choose>
</backend>
​```

### 🟠 HIGH: Missing Error Handling (OWASP API8)

The `<on-error>` section has no custom handling. If the backend 
returns a 500 error with a stack trace, it will be forwarded 
directly to the API consumer, leaking:
- Internal file paths
- Database connection strings
- Framework versions

**Fix: Add safe error handling:**

​```xml
<on-error>
    <base />
    <return-response>
        <set-status code="500" reason="Internal Server Error" />
        <set-body>@{
            return new JObject(
                new JProperty("error", "An internal error occurred"),
                new JProperty("correlationId", context.RequestId.ToString())
            ).ToString();
        }</set-body>
    </return-response>
</on-error>
​```
```

### Key Talking Points
- "Three independent layers caught the issue — if one misses it, the others catch it"
- "The AI didn't just detect SSRF — it provided a **secure alternative architecture** using an allowlist"
- "This is the #7 OWASP API vulnerability, and it's caught in seconds, not days"
- "The developer learns from the AI's explanation — it's training and enforcement simultaneously"

## The Microsoft Advantage

Show this slide during the demo:

```
┌──────────────────────────────────────────────────────────────┐
│                  COMPETING SOLUTIONS                         │
│                                                              │
│  AWS API Gateway     → No native policy scanner              │
│                      → No AI-powered review                  │
│                      → Manual security review required        │
│                                                              │
│  Kong / Apigee       → Third-party security tools needed     │
│                      → No native CI/CD integration           │
│                      → Complex multi-vendor setup             │
│                                                              │
│  ═══════════════════════════════════════════════════════════  │
│                                                              │
│  Microsoft (APIM + GitHub)                                   │
│  ✅ Native policy engine with 50+ security policies          │
│  ✅ GitHub Actions CI/CD with SARIF security integration     │
│  ✅ AI-powered agentic review (unique to GitHub)             │
│  ✅ Azure Monitor + Sentinel for runtime protection          │
│  ✅ Single vendor, fully integrated, enterprise-grade        │
└──────────────────────────────────────────────────────────────┘
```
