# Demo Scenario 1: Insecure Policy PR → Automatically Blocked

## Scenario
A developer submits a PR that removes JWT validation and adds wildcard CORS — simulating a common "quick fix" that introduces critical vulnerabilities.

## Steps to Demo

### 1. Create a branch with insecure changes
```bash
git checkout -b demo/insecure-cors-change
```

### 2. Modify the API-level policy to be insecure
Edit `policies/api-level-policy.xml` and make these changes:

```xml
<!-- BEFORE (secure) -->
<cors allow-credentials="true">
    <allowed-origins>
        <origin>https://portal.contoso.com</origin>
        <origin>https://app.contoso.com</origin>
    </allowed-origins>
</cors>

<!-- AFTER (insecure — this is what the developer changes) -->
<cors allow-credentials="true">
    <allowed-origins>
        <origin>*</origin>
    </allowed-origins>
</cors>
```

Also remove the `<validate-jwt>` block entirely (simulating "I'll add it back later").

### 3. Push and create PR
```bash
git add policies/
git commit -m "Quick fix: relax CORS for testing"
git push origin demo/insecure-cors-change
```

### 4. Watch the automation kick in

**What happens automatically:**

1. **CI Pipeline triggers** — `apim-security-scan.yml` runs
2. **XML validation passes** — The XML is syntactically valid
3. **Policy scanner runs** — Detects:
   - 🔴 `CORS001`: Wildcard CORS origin
   - 🔴 `CORS002`: Credentials with wildcard
   - 🔴 `AUTH001`: Missing JWT validation
4. **SARIF uploaded** — Findings appear in GitHub Security tab
5. **PR comment posted** — Bot comments with detailed findings
6. **Agentic Workflow triggers** — Copilot AI reviews the changes:
   - Explains WHY wildcard CORS is dangerous
   - Shows the exact fix needed
   - Requests changes on the PR

### 5. Show the blocked PR
- PR status checks: ❌ FAILED
- Security tab: 3 new findings
- AI review comment with code suggestion
- **PR cannot be merged** until issues are fixed

### Key Talking Points
- "This took **zero human reviewer time** — the AI caught it instantly"
- "The developer gets specific, actionable feedback, not just 'failed'"
- "This catches the #1 cause of API breaches — accidental misconfigurations in policy changes"
