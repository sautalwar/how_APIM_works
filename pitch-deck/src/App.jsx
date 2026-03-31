import { useState, useEffect, useRef } from 'react'

// ── DATA ──

const scenarios = [
  {
    id: 'student-platform',
    title: 'Student Learning Platform',
    prompt: 'Our Ed platform serves millions of K-12 students. I need JWT auth scoped to school district Azure AD tenants, FERPA-compliant error masking so student PII never leaks in error responses, rate limiting per school district, and request validation to prevent oversized uploads from student devices.',
    policy: `<policies>
  <inbound>
    <validate-jwt header-name="Authorization"
      failed-validation-httpcode="401">
      <openid-config url="https://login.microsoftonline.com/
        {{district-tenant-id}}/.well-known/openid-configuration" />
      <required-claims>
        <claim name="roles" match="any">
          <value>Student</value>
          <value>Teacher</value>
          <value>Admin</value>
        </claim>
        <claim name="district_id" match="all">
          <value>{{district-id}}</value>
        </claim>
      </required-claims>
    </validate-jwt>
    <rate-limit-by-key calls="500"
      renewal-period="60"
      counter-key="@(context.Request.Headers
        .GetValueOrDefault("X-District-Id","default"))" />
    <validate-content
      unspecified-content-type-action="prevent"
      max-size="5242880" />
    <set-header name="X-Content-Type-Options"
      exists-action="override">
      <value>nosniff</value>
    </set-header>
  </inbound>
  <on-error>
    <set-body>{"error":"Request could not be processed",
      "support":"support@hmhco.com"}</set-body>
    <set-header name="X-Request-Id"
      exists-action="override">
      <value>@(context.RequestId)</value>
    </set-header>
  </on-error>
</policies>`,
    review: [
      { label: 'JWT scoped to district tenant — each school authenticates against their own Azure AD', icon: '🔐' },
      { label: 'Role claims enforce Student/Teacher/Admin access levels', icon: '🎓' },
      { label: 'Per-district rate limiting — one school\'s traffic spike can\'t impact others', icon: '⏱️' },
      { label: 'FERPA-compliant error masking — no student PII in error responses, ever', icon: '🛡️' },
      { label: 'Upload size capped at 5MB — protects against oversized submissions from student devices', icon: '📏' },
    ]
  },
  {
    id: 'content-catalog',
    title: 'Content Catalog & Reader',
    prompt: 'We have a public-facing API for browsing our book catalog, curriculum titles, and sample chapters. It needs to be read-only, rate limited per IP to prevent scraping of our copyrighted content, and CORS locked to our web reader domain.',
    policy: `<policies>
  <inbound>
    <rate-limit-by-key calls="120"
      renewal-period="60"
      counter-key="@(context.Request.IpAddress)" />
    <cors allow-credentials="false">
      <allowed-origins>
        <origin>https://www.hmhco.com</origin>
        <origin>https://reader.hmhco.com</origin>
      </allowed-origins>
      <allowed-methods>
        <method>GET</method>
      </allowed-methods>
      <allowed-headers>
        <header>Accept</header>
        <header>X-Catalog-Version</header>
      </allowed-headers>
    </cors>
    <choose>
      <when condition="@(context.Request.Method != &quot;GET&quot;)">
        <return-response>
          <set-status code="405"
            reason="Catalog is read-only" />
        </return-response>
      </when>
    </choose>
    <set-header name="Cache-Control"
      exists-action="override">
      <value>public, max-age=3600</value>
    </set-header>
  </inbound>
</policies>`,
    review: [
      { label: 'Rate limited per IP — prevents automated scraping of copyrighted catalog data', icon: '⏱️' },
      { label: 'CORS locked to HMH domains — only your web reader can call this API', icon: '🌐' },
      { label: 'Strictly read-only — no POST/PUT/DELETE reaches the backend', icon: '🚫' },
      { label: 'Cache headers set at gateway — reduces load during back-to-school traffic surges', icon: '📚' },
    ]
  },
  {
    id: 'district-integration',
    title: 'School District Roster Sync',
    prompt: 'School districts sync student rosters, class assignments, and grade data with our platform via API. I need per-district rate limits, IP allowlisting per district, mutual TLS for district identity verification, and full audit logging for FERPA compliance.',
    policy: `<policies>
  <inbound>
    <rate-limit-by-key calls="2000"
      renewal-period="60"
      counter-key="@(context.Subscription.Id)" />
    <ip-filter action="allow">
      <address-range
        from="10.200.0.0"
        to="10.200.255.255" />
      <address-range
        from="172.16.50.0"
        to="172.16.50.255" />
    </ip-filter>
    <validate-client-certificate
      validate-revocation="true"
      validate-trust="true"
      validate-not-before="true"
      validate-not-after="true" />
    <validate-content
      unspecified-content-type-action="prevent"
      max-size="10485760" />
  </inbound>
  <outbound>
    <log-to-eventhub logger-id="ferpa-audit-log">
      @{
        return new JObject(
          new JProperty("district",
            context.Subscription.Name),
          new JProperty("operation",
            context.Operation.Name),
          new JProperty("recordCount",
            context.Response.Headers
              .GetValueOrDefault(
                "X-Record-Count","0")),
          new JProperty("timestamp",
            DateTime.UtcNow)
        ).ToString();
      }
    </log-to-eventhub>
  </outbound>
  <on-error>
    <set-body>{"error":"Sync request failed",
      "contact":"districts@hmhco.com"}</set-body>
  </on-error>
</policies>`,
    review: [
      { label: 'Per-district rate limits — fair resource allocation across 13,000+ districts', icon: '⚖️' },
      { label: 'IP allowlist per district — only authorized school networks can connect', icon: '🏫' },
      { label: 'Mutual TLS — cryptographic verification of district identity before any data exchange', icon: '🔏' },
      { label: 'FERPA audit trail — every roster sync logged to Event Hub with district, operation, and record count', icon: '📋' },
      { label: 'Error masking on sync failures — no student data in error responses', icon: '🛡️' },
    ]
  }
]

const flowSteps = [
  {
    icon: '💬',
    num: 1,
    title: 'Describe',
    subtitle: 'Tell Copilot what protection you need — in plain English',
    color: '#58a6ff'
  },
  {
    icon: '🤖',
    num: 2,
    title: 'Generate',
    subtitle: 'Copilot writes gateway-native APIM policy XML — not boilerplate, custom to you',
    color: '#bc8cff'
  },
  {
    icon: '👁️',
    num: 3,
    title: 'Review',
    subtitle: 'Copilot explains what each policy element does and why it chose it',
    color: '#f0883e'
  },
  {
    icon: '🔄',
    num: 4,
    title: 'Iterate',
    subtitle: 'Push to GitHub — PR tracks the change, team reviews, Copilot suggests improvements',
    color: '#3fb950'
  },
  {
    icon: '🚀',
    num: 5,
    title: 'Deploy',
    subtitle: 'Merge triggers deployment — validated policy goes live on your gateway',
    color: '#f85149'
  }
]

const owaspMapping = [
  { id: 'API1', threat: 'Broken Object-Level Auth', policy: 'validate-jwt with scope claims', icon: '🔐' },
  { id: 'API2', threat: 'Broken Authentication', policy: 'validate-jwt + openid-config', icon: '🪪' },
  { id: 'API3', threat: 'Broken Property-Level Auth', policy: 'validate-content + set-body transform', icon: '📋' },
  { id: 'API4', threat: 'Unrestricted Resource Consumption', policy: 'rate-limit-by-key + quota-by-key', icon: '⏱️' },
  { id: 'API5', threat: 'Broken Function-Level Auth', policy: 'choose + validate-jwt per operation', icon: '🚧' },
  { id: 'API6', threat: 'Unrestricted Access to Sensitive Flows', policy: 'ip-filter + validate-client-certificate', icon: '🏢' },
  { id: 'API7', threat: 'Server-Side Request Forgery', policy: 'set-backend-service allowlist', icon: '🌐' },
  { id: 'API8', threat: 'Security Misconfiguration', policy: 'set-header (security headers) + cors', icon: '⚙️' },
  { id: 'API9', threat: 'Improper Inventory Management', policy: 'api-version-set + deprecation headers', icon: '📦' },
  { id: 'API10', threat: 'Unsafe API Consumption', policy: 'validate-content on backend response', icon: '🔍' },
]

// Policy fragments for dynamic assembly from free-text input
const policyFragments = [
  {
    keywords: ['jwt', 'auth', 'authentication', 'token', 'azure ad', 'oauth', 'openid', 'login', 'identity'],
    section: 'inbound',
    xml: `    <validate-jwt header-name="Authorization"
      failed-validation-httpcode="401">
      <openid-config url="https://login.microsoftonline.com/
        {{tenant-id}}/.well-known/openid-configuration" />
      <required-claims>
        <claim name="aud" match="all">
          <value>{{api-audience}}</value>
        </claim>
      </required-claims>
    </validate-jwt>`,
    review: { label: 'JWT validates tokens against your identity provider', icon: '🔐' },
  },
  {
    keywords: ['rate limit', 'throttl', 'calls per', 'requests per', 'abuse', 'ddos', 'brute force'],
    section: 'inbound',
    xml: `    <rate-limit-by-key calls="100"
      renewal-period="60"
      counter-key="@(context.Subscription.Id)" />`,
    review: { label: 'Rate limiting prevents abuse and resource exhaustion', icon: '⏱️' },
  },
  {
    keywords: ['cors', 'cross-origin', 'cross origin', 'browser', 'storefront', 'frontend domain'],
    section: 'inbound',
    xml: `    <cors allow-credentials="false">
      <allowed-origins>
        <origin>https://your-domain.com</origin>
      </allowed-origins>
      <allowed-methods>
        <method>GET</method>
        <method>POST</method>
      </allowed-methods>
    </cors>`,
    review: { label: 'CORS restricts which domains can call your API', icon: '🌐' },
  },
  {
    keywords: ['ip filter', 'ip allow', 'ip block', 'whitelist', 'allowlist', 'ip restrict', 'network range'],
    section: 'inbound',
    xml: `    <ip-filter action="allow">
      <address-range
        from="203.0.113.0" to="203.0.113.255" />
    </ip-filter>`,
    review: { label: 'IP filtering restricts access to known network ranges', icon: '🏢' },
  },
  {
    keywords: ['valid', 'body', 'content', 'payload', 'size', 'request size', 'max size', '100kb', '50kb'],
    section: 'inbound',
    xml: `    <validate-content
      unspecified-content-type-action="prevent"
      max-size="102400" />`,
    review: { label: 'Validates request body size and enforces content types', icon: '📏' },
  },
  {
    keywords: ['header', 'security header', 'x-content', 'x-frame', 'nosniff', 'clickjack', 'hsts'],
    section: 'inbound',
    xml: `    <set-header name="X-Content-Type-Options"
      exists-action="override">
      <value>nosniff</value>
    </set-header>
    <set-header name="X-Frame-Options"
      exists-action="override">
      <value>DENY</value>
    </set-header>`,
    review: { label: 'Security headers block content sniffing and clickjacking', icon: '⚙️' },
  },
  {
    keywords: ['tls', 'mutual tls', 'mtls', 'client cert', 'certificate'],
    section: 'inbound',
    xml: `    <validate-client-certificate
      validate-revocation="true"
      validate-trust="true"
      validate-not-before="true"
      validate-not-after="true" />`,
    review: { label: 'Mutual TLS verifies client certificate identity', icon: '🔏' },
  },
  {
    keywords: ['get only', 'read only', 'read-only', 'block write', 'block post', 'block delete', 'method filter'],
    section: 'inbound',
    xml: `    <choose>
      <when condition="@(context.Request.Method != &quot;GET&quot;)">
        <return-response>
          <set-status code="405" reason="Not Allowed" />
        </return-response>
      </when>
    </choose>`,
    review: { label: 'Method filtering blocks unwanted HTTP verbs at the gateway', icon: '🚫' },
  },
  {
    keywords: ['log', 'audit', 'event hub', 'tracking', 'monitor', 'telemetry'],
    section: 'outbound',
    xml: `    <log-to-eventhub logger-id="api-audit">
      @{
        return new JObject(
          new JProperty("caller",
            context.Subscription.Name),
          new JProperty("operation",
            context.Operation.Name),
          new JProperty("time",
            DateTime.UtcNow)
        ).ToString();
      }
    </log-to-eventhub>`,
    review: { label: 'Audit logging sends every API call to Event Hub', icon: '📋' },
  },
  {
    keywords: ['error', 'mask', 'stack trace', 'hide error', 'error handling', 'on-error', 'error response', 'error mask'],
    section: 'on-error',
    xml: `    <set-body>{"error":"An error occurred"}</set-body>
    <set-header name="X-Request-Id"
      exists-action="override">
      <value>@(context.RequestId)</value>
    </set-header>`,
    review: { label: 'Error masking hides internals — returns safe messages only', icon: '🛡️' },
  },
]

function buildPolicyFromText(text) {
  const lower = text.toLowerCase()
  const matched = policyFragments.filter(f =>
    f.keywords.some(kw => lower.includes(kw))
  )
  if (matched.length === 0) return null

  const inbound = matched.filter(f => f.section === 'inbound')
  const outbound = matched.filter(f => f.section === 'outbound')
  const onError = matched.filter(f => f.section === 'on-error')

  let xml = '<policies>\n  <inbound>\n'
  inbound.forEach(f => { xml += f.xml + '\n' })
  xml += '  </inbound>\n'

  if (outbound.length > 0) {
    xml += '  <outbound>\n'
    outbound.forEach(f => { xml += f.xml + '\n' })
    xml += '  </outbound>\n'
  }

  if (onError.length > 0) {
    xml += '  <on-error>\n'
    onError.forEach(f => { xml += f.xml + '\n' })
    xml += '  </on-error>\n'
  }

  xml += '</policies>'
  return { policy: xml, review: matched.map(f => f.review) }
}

// ── COMPONENTS ──

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <span className="nav-icon">🚀</span>
        <span className="nav-title">APIM Policy Pilot</span>
      </div>
      <div className="nav-links">
        <a href="#gap">The Gap</a>
        <a href="#flow">The Flow</a>
        <a href="#owasp">OWASP</a>
        <a href="#demo">Live Demo</a>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-badge">THE 10-MINUTE QUESTION</div>
        <h1>
          You have <span className="hl-blue">APIM</span>.
          You have <span className="hl-green">Kong</span>.
        </h1>
        <h2 className="hero-q">
          Who writes the policies?<br/>
          Who reviews them?<br/>
          Who makes sure they're <span className="hl-red">correct</span>?
        </h2>
        <p className="hero-sub">
          Your gateway enforces policies. But policies are written by humans.
          What if AI could author them, explain them, and help your team
          iterate — all inside GitHub?
        </p>
        <a href="#gap" className="hero-cta">See the Gap ↓</a>
      </div>
    </section>
  )
}

function TheGap() {
  return (
    <section id="gap" className="section section-light">
      <div className="container">
        <h2 className="section-title">The Gap Nobody Talks About</h2>
        <p className="section-sub">Your gateway handles runtime. Nobody handles the policy lifecycle.</p>

        <div className="gap-grid">
          <div className="gap-card gap-have">
            <div className="gap-hdr">
              <span className="gap-emoji">🛡️</span>
              <h3>What Your Gateway Does</h3>
              <span className="badge badge-green">RUNTIME</span>
            </div>
            <ul>
              <li><span className="chk">✅</span> Enforces policies on every request</li>
              <li><span className="chk">✅</span> Rate limiting &amp; throttling</li>
              <li><span className="chk">✅</span> JWT / OAuth token validation</li>
              <li><span className="chk">✅</span> CORS, IP filtering, routing</li>
              <li><span className="chk">✅</span> Request/response transformation</li>
            </ul>
          </div>
          <div className="gap-card gap-missing">
            <div className="gap-hdr">
              <span className="gap-emoji">⚠️</span>
              <h3>What Nobody Does Today</h3>
              <span className="badge badge-red">LIFECYCLE</span>
            </div>
            <ul>
              <li><span className="x">❌</span> Who writes correct policy XML from scratch?</li>
              <li><span className="x">❌</span> Who maps OWASP API threats to policy elements?</li>
              <li><span className="x">❌</span> Who explains what each policy does and why?</li>
              <li><span className="x">❌</span> Who ensures consistency across 50+ APIs?</li>
              <li><span className="x">❌</span> Where's the version history &amp; audit trail?</li>
            </ul>
          </div>
        </div>

        <div className="gap-answer">
          <span className="gap-answer-icon">💡</span>
          <div>
            <strong>GitHub Copilot + Actions fills this gap.</strong>
            <p>AI authors policies. PRs track changes. Your gateway stays protected the way YOU defined it.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function TheFlow() {
  return (
    <section id="flow" className="section section-dark">
      <div className="container">
        <h2 className="section-title light">From Intent to Protected API</h2>
        <p className="section-sub light">Five steps. Every policy authored by AI, reviewed by your team, deployed with confidence.</p>

        <div className="flow-steps">
          {flowSteps.map((s, i) => (
            <div key={i} className="flow-step-wrap">
              <div className="flow-step" style={{ borderTopColor: s.color }}>
                <div className="flow-num" style={{ background: s.color }}>{s.num}</div>
                <div className="flow-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.subtitle}</p>
              </div>
              {i < flowSteps.length - 1 && <div className="flow-arrow">→</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function OwaspMap() {
  const [showAll, setShowAll] = useState(false)

  const featured = [
    {
      id: 'API2',
      threat: 'Broken Authentication',
      icon: '🔐',
      policy: 'validate-jwt + openid-config',
      story: 'A student in Dallas shouldn\'t see a teacher\'s account in Boston.',
      explain: 'This policy checks every single API request to verify: Are you who you say you are? Do you belong to this school district? Are you a Student, Teacher, or Admin? If any answer is no — the request is blocked before it touches your data.',
      hmhWhy: 'With millions of students across thousands of districts, one authentication gap means a FERPA violation. Copilot generates JWT validation scoped to each district\'s Azure AD tenant — not a generic template, but a policy customized to YOUR identity setup.',
      xml: `<validate-jwt header-name="Authorization">
  <openid-config url="https://login.microsoftonline.com/
    {{district-tenant-id}}/.well-known/openid-configuration" />
  <required-claims>
    <claim name="roles" match="any">
      <value>Student</value>
      <value>Teacher</value>
    </claim>
  </required-claims>
</validate-jwt>`,
    },
    {
      id: 'API4',
      threat: 'Unrestricted Resource Consumption',
      icon: '⏱️',
      policy: 'rate-limit-by-key + quota-by-key',
      story: 'It\'s September. 2 million students log in on day one.',
      explain: 'Without rate limiting, one district\'s back-to-school traffic spike can overwhelm the platform for everyone. This policy gives each school district its own "lane" — a fair share of API capacity that can\'t be consumed by someone else.',
      hmhWhy: 'Copilot generates per-district rate limits, not a global cap. Each district gets 500 calls/minute tied to their subscription key. If Dallas surges, Boston isn\'t affected. The policy is customized to how HMH actually partitions its customers.',
      xml: `<rate-limit-by-key calls="500"
  renewal-period="60"
  counter-key="@(context.Request.Headers
    .GetValueOrDefault(
      "X-District-Id","default"))" />`,
    },
  ]

  const remaining = owaspMapping.filter(o => o.id !== 'API2' && o.id !== 'API4')

  return (
    <section id="owasp" className="section section-light">
      <div className="container">
        <h2 className="section-title">How OWASP Threats Map to Real Policies</h2>
        <p className="section-sub">Every API threat has a specific APIM policy countermeasure. Here are the two that matter most for EdTech.</p>

        <div className="featured-owasp">
          {featured.map((f) => (
            <div key={f.id} className="featured-card">
              <div className="featured-header">
                <span className="featured-icon">{f.icon}</span>
                <div>
                  <span className="featured-id">{f.id}</span>
                  <span className="featured-threat">{f.threat}</span>
                </div>
              </div>
              <div className="featured-story">"{f.story}"</div>
              <div className="featured-explain">{f.explain}</div>
              <div className="featured-xml">
                <div className="featured-xml-label">What Copilot generates →</div>
                <pre><code>{f.xml}</code></pre>
              </div>
              <div className="featured-hmh">
                <span className="featured-hmh-icon">🎯</span>
                <div><strong>Why this is customized for you:</strong> {f.hmhWhy}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="owasp-expander">
          <button className="owasp-toggle" onClick={() => setShowAll(!showAll)}>
            {showAll ? '▼ Hide' : '▶ See all 10 OWASP API protections'} {!showAll && <span className="owasp-toggle-sub">— Copilot knows every mapping</span>}
          </button>
          {showAll && (
            <div className="owasp-grid">
              {remaining.map((o) => (
                <div key={o.id} className="owasp-row">
                  <div className="owasp-threat">
                    <span className="owasp-icon">{o.icon}</span>
                    <div>
                      <span className="owasp-id">{o.id}</span>
                      <span className="owasp-name">{o.threat}</span>
                    </div>
                  </div>
                  <div className="owasp-arrow">→</div>
                  <div className="owasp-policy">
                    <code>{o.policy}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function CopilotDemo() {
  const [mode, setMode] = useState('presets') // presets | custom
  const [active, setActive] = useState(null)
  const [customText, setCustomText] = useState('')
  const [displayedPolicy, setDisplayedPolicy] = useState('')
  const [phase, setPhase] = useState('idle') // idle | thinking | typing | reviewing | done
  const [visibleChecks, setVisibleChecks] = useState(0)
  const [currentReview, setCurrentReview] = useState([])
  const intervalRef = useRef(null)
  const timeoutRef = useRef(null)

  const clearTimers = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  const runAnimation = (policy, review) => {
    clearTimers()
    setDisplayedPolicy('')
    setVisibleChecks(0)
    setCurrentReview(review)
    setPhase('thinking')

    timeoutRef.current = setTimeout(() => {
      setPhase('typing')
      let idx = 0
      intervalRef.current = setInterval(() => {
        idx += 3
        if (idx >= policy.length) {
          idx = policy.length
          clearInterval(intervalRef.current)
          setPhase('reviewing')
          let checkIdx = 0
          intervalRef.current = setInterval(() => {
            checkIdx++
            setVisibleChecks(checkIdx)
            if (checkIdx >= review.length) {
              clearInterval(intervalRef.current)
              setPhase('done')
            }
          }, 400)
        }
        setDisplayedPolicy(policy.slice(0, idx))
      }, 12)
    }, 800)
  }

  const runScenario = (scenario) => {
    setActive(scenario)
    setCurrentReview(scenario.review)
    runAnimation(scenario.policy, scenario.review)
  }

  const generateFromCustom = () => {
    const result = buildPolicyFromText(customText)
    if (!result) return
    setActive({ id: 'custom', prompt: customText, ...result })
    runAnimation(result.policy, result.review)
  }

  useEffect(() => {
    return () => clearTimers()
  }, [])

  const detectedCount = mode === 'custom' && customText
    ? policyFragments.filter(f => f.keywords.some(kw => customText.toLowerCase().includes(kw))).length
    : 0

  return (
    <section id="demo" className="section section-white">
      <div className="container">
        <h2 className="section-title">See Copilot Author a Policy</h2>
        <p className="section-sub">Pick a preset or describe your own requirements. Watch the policy generate in real time.</p>

        <div className="demo-mode-toggle">
          <button
            className={`mode-btn ${mode === 'presets' ? 'active' : ''}`}
            onClick={() => { setMode('presets'); clearTimers(); setPhase('idle'); setActive(null) }}
          >
            📚 HMH Scenarios
          </button>
          <button
            className={`mode-btn ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => { setMode('custom'); clearTimers(); setPhase('idle'); setActive(null) }}
          >
            ✍️ Write Your Own
          </button>
        </div>

        {mode === 'presets' && (
          <div className="demo-btns">
            {scenarios.map(s => (
              <button
                key={s.id}
                className={`demo-btn ${active?.id === s.id ? 'active' : ''}`}
                onClick={() => runScenario(s)}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}

        {mode === 'custom' && (
          <div className="custom-input-area">
            <div className="custom-input-pane">
              <div className="demo-pane-hdr">
                <span>💬</span> Describe Your API Security Needs
                {detectedCount > 0 && (
                  <span className="detected-badge">{detectedCount} protection{detectedCount !== 1 ? 's' : ''} detected</span>
                )}
              </div>
              <textarea
                className="custom-textarea"
                placeholder={'Try: "I need JWT authentication for our student learning platform, rate limiting per school district, CORS locked to our reader domain, request body validation, FERPA-compliant error masking, and audit logging to Event Hub."'}
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                rows={5}
              />
              <div className="custom-input-footer">
                <div className="keyword-hints">
                  Try: <span className="hint-kw">JWT auth</span>
                  <span className="hint-kw">rate limit</span>
                  <span className="hint-kw">CORS</span>
                  <span className="hint-kw">IP filter</span>
                  <span className="hint-kw">error masking</span>
                  <span className="hint-kw">body validation</span>
                  <span className="hint-kw">security headers</span>
                  <span className="hint-kw">mutual TLS</span>
                  <span className="hint-kw">audit logging</span>
                  <span className="hint-kw">read-only</span>
                </div>
                <button
                  className="generate-btn"
                  onClick={generateFromCustom}
                  disabled={detectedCount === 0}
                >
                  🤖 Generate Policy
                </button>
              </div>
            </div>
          </div>
        )}

        {active && phase !== 'idle' && (
          <div className={`demo-workspace ${mode === 'custom' ? 'demo-workspace-full' : ''}`}>
            {mode === 'presets' && (
              <div className="demo-pane">
                <div className="demo-pane-hdr"><span>💬</span> Your Requirement</div>
                <div className="demo-prompt">"{active.prompt}"</div>
              </div>
            )}

            <div className={`demo-pane ${mode === 'custom' ? 'demo-pane-full' : 'demo-pane-wide'}`}>
              <div className="demo-pane-hdr">
                <span>🤖</span> Copilot-Generated Policy
                {phase === 'thinking' && <span className="gen-badge thinking">● Thinking...</span>}
                {phase === 'typing' && <span className="gen-badge typing">● Writing...</span>}
                {phase === 'done' && <span className="gen-badge done">✓ Complete</span>}
              </div>
              <pre className="demo-code">
                <code>{phase === 'thinking' ? '' : displayedPolicy}</code>
                {(phase === 'thinking' || phase === 'typing') && <span className="cursor">|</span>}
              </pre>
            </div>
          </div>
        )}

        {active && (phase === 'reviewing' || phase === 'done') && (
          <div className="demo-review">
            <div className="demo-review-hdr">
              <span>👁️</span> Copilot Explains Why
            </div>
            <div className="demo-review-items">
              {currentReview.slice(0, visibleChecks).map((r, i) => (
                <div key={i} className="review-item" style={{ animationDelay: `${i * 0.05}s` }}>
                  <span className="review-icon">{r.icon}</span>
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
            {phase === 'done' && (
              <div className="demo-deploy-ready">
                <span>🚀</span> Policy ready — push to GitHub, merge PR, auto-deploys to your gateway
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function BottomLine() {
  return (
    <section className="section section-closing">
      <div className="container closing-content">
        <h2>The Bottom Line</h2>
        <div className="closing-cards">
          <div className="closing-card">
            <span className="closing-emoji">🔒</span>
            <p><strong>Your Gateway</strong> is the lock on the door</p>
          </div>
          <div className="closing-card">
            <span className="closing-emoji">🤖</span>
            <p><strong>GitHub Copilot</strong> is the locksmith who builds it right</p>
          </div>
          <div className="closing-card">
            <span className="closing-emoji">👥</span>
            <p><strong>Your Team</strong> reviews and approves — with AI explaining every decision</p>
          </div>
        </div>
        <p className="closing-tagline">
          Your gateway protects your APIs.<br/>
          <strong>GitHub ensures the protection is correct.</strong>
        </p>
      </div>
    </section>
  )
}

// ── APP ──

export default function App() {
  return (
    <div className="app">
      <Nav />
      <Hero />
      <TheGap />
      <TheFlow />
      <OwaspMap />
      <CopilotDemo />
      <BottomLine />
    </div>
  )
}
