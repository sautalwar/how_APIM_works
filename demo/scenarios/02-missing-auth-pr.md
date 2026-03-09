# Demo Scenario 2: Missing Authentication → AI Flags and Suggests Fix

## Scenario
A developer adds a new API operation but forgets to include JWT validation, leaving the endpoint completely open. The agentic workflow catches it and suggests the exact policy to add.

## Steps to Demo

### 1. Create a branch
```bash
git checkout -b demo/new-endpoint-no-auth
```

### 2. Add a new operation policy without authentication
Create `policies/operation-search-policy.xml`:

```xml
<!-- New search endpoint — developer forgot authentication -->
<policies>
    <inbound>
        <base />
        <!-- Rate limiting is present (good!) -->
        <rate-limit-by-key calls="50" renewal-period="60"
                           counter-key="@(context.Request.IpAddress)" />
        <!-- ❌ No validate-jwt — endpoint is completely open! -->
    </inbound>
    <backend>
        <base />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```

### 3. Push and create PR
```bash
git add policies/
git commit -m "Add search endpoint with rate limiting"
git push origin demo/new-endpoint-no-auth
```

### 4. Watch the AI review

**Agentic Workflow response:**

```markdown
🟠 **HIGH: Missing Authentication** (OWASP API2)

The new search endpoint at `policies/operation-search-policy.xml` has rate 
limiting configured ✅ but is missing JWT token validation ❌.

Without authentication, anyone can:
- Access your search endpoint without credentials
- Enumerate data through the search API
- Bypass subscription-based access control

**Suggested fix — add before the rate-limit policy:**

​```xml
<validate-jwt header-name="Authorization"
              failed-validation-httpcode="401"
              require-expiration-time="true"
              require-signed-tokens="true">
    <openid-config url="https://login.microsoftonline.com/{{tenant-id}}/v2.0/.well-known/openid-configuration" />
    <audiences>
        <audience>{{api-audience}}</audience>
    </audiences>
</validate-jwt>
​```

The AI noticed that rate limiting was correctly added (good practice!) but 
authentication was the missing piece.
```

### Key Talking Points
- "The AI understands **context** — it acknowledged what was done right (rate limiting) and what was missing"
- "It didn't just say 'add auth' — it provided the exact XML with your tenant configuration"
- "This is OWASP API2 (Broken Authentication) caught before it ever reaches production"
