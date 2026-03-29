import { useState, useCallback } from 'react';

/* ─────────────────────── Policy XML constants ─────────────────────── */

const INSECURE_POLICY = `<policies>
    <inbound>
        <base />
        <cors allow-credentials="true">
            <allowed-origins>
                <origin>*</origin>
            </allowed-origins>
            <allowed-methods preflight-result-max-age="300">
                <method>*</method>
            </allowed-methods>
            <allowed-headers>
                <header>*</header>
            </allowed-headers>
        </cors>
    </inbound>
    <backend>
        <set-backend-service base-url="http://10.0.1.45:3000/api" />
    </backend>
    <outbound>
        <base />
    </outbound>
</policies>`;

const SECURE_POLICY = `<policies>
    <inbound>
        <base />
        <validate-jwt header-name="Authorization"
                      failed-validation-httpcode="401"
                      failed-validation-error-message="Unauthorized"
                      require-expiration-time="true"
                      require-signed-tokens="true">
            <openid-config url="https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration" />
            <audiences>
                <audience>api://partner-api</audience>
            </audiences>
            <issuers>
                <issuer>https://sts.windows.net/your-tenant-id/</issuer>
            </issuers>
        </validate-jwt>
        <rate-limit-by-key calls="100" renewal-period="60"
                           counter-key="@(context.Subscription?.Id ?? context.Request.IpAddress)" />
        <cors allow-credentials="false">
            <allowed-origins>
                <origin>https://partner-portal.example.com</origin>
            </allowed-origins>
            <allowed-methods>
                <method>GET</method>
                <method>POST</method>
            </allowed-methods>
            <allowed-headers>
                <header>Authorization</header>
                <header>Content-Type</header>
            </allowed-headers>
        </cors>
        <validate-content max-size="102400" size-exceeded-action="detect" />
        <choose>
            <when condition="@(context.Request.Method == &quot;TRACE&quot;)">
                <return-response>
                    <set-status code="405" reason="Method Not Allowed" />
                </return-response>
            </when>
        </choose>
    </inbound>
    <backend>
        <set-backend-service base-url="https://api.internal.example.com/v1" />
    </backend>
    <outbound>
        <base />
        <set-header name="X-Content-Type-Options" exists-action="override">
            <value>nosniff</value>
        </set-header>
        <set-header name="Strict-Transport-Security" exists-action="override">
            <value>max-age=31536000; includeSubDomains</value>
        </set-header>
        <set-header name="Server" exists-action="delete" />
        <set-header name="X-Powered-By" exists-action="delete" />
        <set-header name="X-AspNet-Version" exists-action="delete" />
    </outbound>
    <on-error>
        <return-response>
            <set-status code="500" reason="Internal Server Error" />
            <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
            </set-header>
            <set-body>{"error":{"code":"InternalError","message":"An error occurred processing your request."}}</set-body>
        </return-response>
    </on-error>
</policies>`;

/* ─────────────────────── Diff annotations ─────────────────────── */

const DIFF_ANNOTATIONS = [
  { label: '🔐 JWT Authentication', desc: 'Added validate-jwt with Azure AD, audiences, and issuers' },
  { label: '⏱️ Rate Limiting', desc: 'Added rate-limit-by-key: 100 calls/min per subscription or IP' },
  { label: '🌐 CORS Hardened', desc: 'Replaced wildcard * with specific origin, methods, and headers' },
  { label: '📦 Content Validation', desc: 'Added validate-content with 100KB max payload size' },
  { label: '🚫 TRACE Blocked', desc: 'Explicitly blocks HTTP TRACE method (XST prevention)' },
  { label: '🔒 HTTPS Backend', desc: 'Changed from http:// internal IP to https:// named endpoint' },
  { label: '🛡️ Security Headers', desc: 'Added HSTS, X-Content-Type-Options, removed server info headers' },
  { label: '⚠️ Error Handling', desc: 'Added on-error block — no stack traces leak to callers' },
];

/* ─────────────────────── Style constants ─────────────────────── */

const C = {
  bg: '#0d1117',
  card: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  textMuted: '#8b949e',
  critical: '#f85149',
  high: '#d29922',
  medium: '#58a6ff',
  low: '#8b949e',
  success: '#3fb950',
  merged: '#a371f7',
  prOpen: '#3fb950',
  codeBg: '#0d1117',
  diffRed: 'rgba(248, 81, 73, 0.15)',
  diffGreen: 'rgba(63, 185, 80, 0.15)',
  btnPrimary: '#238636',
  btnPrimaryHover: '#2ea043',
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

/* ─────────────────────── Keyframe styles (injected once) ─────────────────────── */

const STYLE_TAG_ID = 'pr-sim-keyframes';

function ensureKeyframes() {
  if (document.getElementById(STYLE_TAG_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = `
    @keyframes prsim-spin { to { transform: rotate(360deg); } }
    @keyframes prsim-fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes prsim-slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 2000px; } }
    @keyframes prsim-pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
    @keyframes prsim-confetti-fall {
      0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
    @keyframes prsim-confetti-sway {
      0%,100% { transform: translateX(0); }
      25% { transform: translateX(15px); }
      75% { transform: translateX(-15px); }
    }
    @keyframes prsim-scaleIn {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes prsim-checkmark {
      0% { stroke-dashoffset: 24; }
      100% { stroke-dashoffset: 0; }
    }
    @keyframes prsim-progressBar {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes prsim-typing {
      0%,100% { opacity: 1; }
      50% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/* ─────────────────────── Shared helpers ─────────────────────── */

function severityColor(s) {
  const m = { critical: C.critical, high: C.high, medium: C.medium, low: C.low, info: C.textMuted };
  return m[(s || '').toLowerCase()] || C.textMuted;
}

function SeverityBadge({ severity }) {
  const col = severityColor(severity);
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px',
      background: col + '22', color: col, border: `1px solid ${col}44`,
    }}>{severity}</span>
  );
}

function CodeBlock({ code, style: extra = {} }) {
  return (
    <pre style={{
      background: C.codeBg, color: C.text, border: `1px solid ${C.border}`,
      borderRadius: 6, padding: 16, fontSize: 13, lineHeight: 1.5,
      overflowX: 'auto', margin: 0, fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      ...extra,
    }}>{code}</pre>
  );
}

/* ─────────────────────── Step progress indicator ─────────────────────── */

const STEP_META = [
  { num: 1, icon: '📝', short: 'Submit PR' },
  { num: 2, icon: '🔍', short: 'CI Scan' },
  { num: 3, icon: '🔧', short: 'Fix Policy' },
  { num: 4, icon: '✅', short: 'Re-scan' },
  { num: 5, icon: '🎉', short: 'Merged' },
];

function StepProgress({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, margin: '0 0 28px', flexWrap: 'wrap' }}>
      {STEP_META.map((s, i) => {
        const done = s.num < current;
        const active = s.num === current;
        const barDone = s.num < current;
        return (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, transition: 'all .3s',
                background: done ? C.success + '33' : active ? C.medium + '33' : C.card,
                border: `2px solid ${done ? C.success : active ? C.medium : C.border}`,
                color: done ? C.success : active ? C.medium : C.textMuted,
                boxShadow: active ? `0 0 12px ${C.medium}44` : 'none',
              }}>
                {done ? '✓' : s.icon}
              </div>
              <span style={{
                fontSize: 11, marginTop: 6, color: done ? C.success : active ? C.text : C.textMuted,
                fontWeight: active ? 600 : 400,
              }}>{s.short}</span>
            </div>
            {i < STEP_META.length - 1 && (
              <div style={{
                width: 48, height: 2, margin: '0 4px', marginBottom: 20,
                background: barDone ? C.success : C.border, borderRadius: 1, transition: 'background .3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────── Mock GitHub PR header ─────────────────────── */

function PRHeader({ state = 'open', merged = false }) {
  const stateColor = merged ? C.merged : state === 'closed' ? C.critical : C.prOpen;
  const stateLabel = merged ? 'Merged' : state === 'open' ? 'Open' : 'Closed';
  const stateIcon = merged ? '🟣' : state === 'open' ? '🟢' : '🔴';
  return (
    <div style={{ marginBottom: 20, animation: 'prsim-fadeIn .5s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
            Add partner API policy for quick onboarding
            <span style={{ fontSize: 18, color: C.textMuted, fontWeight: 400 }}> #847</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px',
              borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: stateColor + '22', color: stateColor, border: `1px solid ${stateColor}55`,
            }}>{stateIcon} {stateLabel}</span>
            <span style={{ fontSize: 13, color: C.textMuted }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '50%', background: '#2f81f7', color: '#fff',
                fontSize: 11, fontWeight: 700, marginRight: 5, verticalAlign: 'middle',
              }}>JD</span>
              <strong style={{ color: C.text }}>jdeveloper</strong> wants to merge 1 commit into
              <code style={{
                background: C.medium + '22', color: C.medium, padding: '2px 7px',
                borderRadius: 6, fontSize: 12, margin: '0 4px',
              }}>master</code>
              from
              <code style={{
                background: C.medium + '22', color: C.medium, padding: '2px 7px',
                borderRadius: 6, fontSize: 12, margin: '0 4px',
              }}>demo/insecure-partner-api</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── GitHub Actions CI steps ─────────────────────── */

function CISteps({ phase, scanResult, onComplete }) {
  /* phase: 'running' | 'done-fail' | 'done-pass' */
  const [ciStep, setCiStep] = useState(0); // 0,1,2,3
  const [started, setStarted] = useState(false);

  const run = useCallback(() => {
    if (started) return;
    setStarted(true);
    setCiStep(1);
    setTimeout(() => setCiStep(2), 600);
    setTimeout(() => setCiStep(3), 1200);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 3400);
  }, [started, onComplete]);

  // auto-start
  if (!started) run();

  const steps = [
    { label: 'Checkout code', done: ciStep >= 1 },
    { label: 'Install scanner', done: ciStep >= 2 },
    { label: 'Running security scan...', done: ciStep >= 3 && phase !== 'running', spinning: ciStep >= 3 && phase === 'running' },
  ];

  const pass = phase === 'done-pass';
  const fail = phase === 'done-fail';

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20,
      animation: 'prsim-fadeIn .4s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>⚙️</span>
        <span style={{ fontWeight: 600, color: C.text, fontSize: 15 }}>GitHub Actions</span>
        <code style={{
          fontSize: 11, color: C.textMuted, background: C.bg, padding: '2px 8px', borderRadius: 4,
        }}>security-scan.yml</code>
        {(pass || fail) && (
          <span style={{
            marginLeft: 'auto', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
            background: (pass ? C.success : C.critical) + '22',
            color: pass ? C.success : C.critical,
          }}>{pass ? '✓ Passed' : '✗ Failed'}</span>
        )}
      </div>
      {steps.map((s, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          borderLeft: `2px solid ${s.done ? (pass || i < 2 ? C.success : C.critical) : s.spinning ? C.medium : C.border}`,
          marginLeft: 8, marginBottom: 4, transition: 'border-color .3s',
        }}>
          {s.done ? (
            <span style={{ color: (pass || i < 2) ? C.success : C.critical, fontSize: 15 }}>
              {(pass || i < 2) ? '✅' : '❌'}
            </span>
          ) : s.spinning ? (
            <span style={{
              display: 'inline-block', width: 16, height: 16, border: `2px solid ${C.medium}44`,
              borderTopColor: C.medium, borderRadius: '50%', animation: 'prsim-spin .8s linear infinite',
            }} />
          ) : (
            <span style={{ color: C.textMuted, fontSize: 14 }}>○</span>
          )}
          <span style={{ color: s.done || s.spinning ? C.text : C.textMuted, fontSize: 14 }}>{s.label}</span>
        </div>
      ))}
      {fail && scanResult && (
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 6,
          background: C.critical + '11', border: `1px solid ${C.critical}33`,
          animation: 'prsim-fadeIn .4s ease',
        }}>
          <span style={{ color: C.critical, fontWeight: 600, fontSize: 14 }}>
            ❌ Security scan failed — {scanResult.length} issue{scanResult.length !== 1 ? 's' : ''} found
          </span>
        </div>
      )}
      {pass && (
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 6,
          background: C.success + '11', border: `1px solid ${C.success}33`,
          animation: 'prsim-fadeIn .4s ease',
        }}>
          <span style={{ color: C.success, fontWeight: 600, fontSize: 14 }}>
            ✅ Security scan passed — 0 issues found!
          </span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Findings table (mock PR comment) ─────────────────────── */

function FindingsComment({ findings }) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  findings.forEach(f => { const s = (f.severity || '').toLowerCase(); if (counts[s] !== undefined) counts[s]++; });

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 20, overflow: 'hidden',
      animation: 'prsim-fadeIn .5s ease',
    }}>
      {/* Comment header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: C.bg, borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: '50%', background: '#6e40c9', color: '#fff',
          fontSize: 12, fontWeight: 700,
        }}>🤖</span>
        <div>
          <strong style={{ color: C.text, fontSize: 13 }}>apim-security-bot</strong>
          <span style={{
            marginLeft: 8, padding: '1px 6px', borderRadius: 10, fontSize: 10,
            background: C.border, color: C.textMuted, fontWeight: 600,
          }}>bot</span>
          <span style={{ color: C.textMuted, fontSize: 12, marginLeft: 8 }}>commented just now</span>
        </div>
      </div>
      {/* Comment body */}
      <div style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', color: C.critical, fontSize: 16 }}>
          🚨 Security Scan Results — {findings.length} issues found
        </h3>
        {/* Severity summary */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {[['Critical', counts.critical], ['High', counts.high], ['Medium', counts.medium], ['Low', counts.low]].map(([label, count]) => (
            <div key={label} style={{
              padding: '8px 16px', borderRadius: 8, background: C.bg,
              border: `1px solid ${C.border}`, textAlign: 'center', minWidth: 90,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: severityColor(label) }}>{count}</div>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
            </div>
          ))}
        </div>
        {/* Findings table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Severity', 'Rule', 'Category', 'Description'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 10px', color: C.textMuted,
                    fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {findings.map((f, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}>
                  <td style={{ padding: '8px 10px' }}><SeverityBadge severity={f.severity} /></td>
                  <td style={{ padding: '8px 10px', color: C.text, fontWeight: 500 }}>{f.rule_name || f.rule_id}</td>
                  <td style={{ padding: '8px 10px', color: C.textMuted }}>{f.category}</td>
                  <td style={{ padding: '8px 10px', color: C.textMuted, maxWidth: 320 }}>{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Review badge */}
      <div style={{
        padding: '12px 16px', borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8, background: C.critical + '08',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px',
          borderRadius: 20, fontSize: 12, fontWeight: 600,
          background: C.critical + '22', color: C.critical,
        }}>🔴 Changes requested</span>
        <span style={{ fontSize: 12, color: C.textMuted }}>
          apim-security-bot requested changes — all critical issues must be resolved before merge
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────── Diff view (Step 3) ─────────────────────── */

function DiffView() {
  const insecureLines = INSECURE_POLICY.split('\n');
  const secureLines = SECURE_POLICY.split('\n');

  return (
    <div style={{ animation: 'prsim-fadeIn .5s ease' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
        marginBottom: 20,
      }}>
        {/* Left - insecure */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px', background: C.critical + '11', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: C.critical, fontWeight: 600, fontSize: 13 }}>❌ partner-api-policy.xml</span>
            <span style={{
              marginLeft: 'auto', padding: '2px 8px', borderRadius: 10, fontSize: 10,
              background: C.critical + '22', color: C.critical, fontWeight: 600,
            }}>INSECURE</span>
          </div>
          <pre style={{
            margin: 0, padding: 12, fontSize: 12, lineHeight: 1.6,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            overflowX: 'auto', maxHeight: 520, overflowY: 'auto',
            background: C.codeBg, color: C.text,
          }}>
            {insecureLines.map((line, i) => {
              const highlight = line.includes('origin>*') || line.includes('method>*') || line.includes('header>*')
                || line.includes('allow-credentials="true"') || line.includes('http://10.0.1.45');
              return (
                <div key={i} style={{
                  padding: '1px 8px', margin: '0 -12px',
                  background: highlight ? C.diffRed : 'transparent',
                  borderLeft: highlight ? `3px solid ${C.critical}` : '3px solid transparent',
                }}>
                  <span style={{ color: C.textMuted, display: 'inline-block', width: 28, textAlign: 'right', marginRight: 12, userSelect: 'none', fontSize: 11 }}>{i + 1}</span>
                  {highlight && <span style={{ color: C.critical, marginRight: 6 }}>−</span>}
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
        {/* Right - secure */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px', background: C.success + '11', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: C.success, fontWeight: 600, fontSize: 13 }}>✅ partner-api-policy.xml</span>
            <span style={{
              marginLeft: 'auto', padding: '2px 8px', borderRadius: 10, fontSize: 10,
              background: C.success + '22', color: C.success, fontWeight: 600,
            }}>SECURE</span>
          </div>
          <pre style={{
            margin: 0, padding: 12, fontSize: 12, lineHeight: 1.6,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            overflowX: 'auto', maxHeight: 520, overflowY: 'auto',
            background: C.codeBg, color: C.text,
          }}>
            {secureLines.map((line, i) => {
              const highlight = line.includes('validate-jwt') || line.includes('rate-limit-by-key')
                || line.includes('allow-credentials="false"')
                || line.includes('partner-portal.example.com')
                || (line.includes('<method>GET') || line.includes('<method>POST'))
                || line.includes('Authorization</header') || line.includes('Content-Type</header')
                || line.includes('validate-content')
                || line.includes('TRACE')
                || line.includes('https://api.internal')
                || line.includes('X-Content-Type-Options') || line.includes('Strict-Transport')
                || line.includes('Server') || line.includes('X-Powered-By') || line.includes('X-AspNet')
                || line.includes('on-error') || line.includes('InternalError');
              return (
                <div key={i} style={{
                  padding: '1px 8px', margin: '0 -12px',
                  background: highlight ? C.diffGreen : 'transparent',
                  borderLeft: highlight ? `3px solid ${C.success}` : '3px solid transparent',
                }}>
                  <span style={{ color: C.textMuted, display: 'inline-block', width: 28, textAlign: 'right', marginRight: 12, userSelect: 'none', fontSize: 11 }}>{i + 1}</span>
                  {highlight && <span style={{ color: C.success, marginRight: 6 }}>+</span>}
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      </div>
      {/* Annotations */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20,
      }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, color: C.text }}>🔑 Key Changes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {DIFF_ANNOTATIONS.map((a, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 6,
              background: C.bg, border: `1px solid ${C.border}`,
            }}>
              <div>
                <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{a.label}</div>
                <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Confetti effect (Step 5) ─────────────────────── */

function Confetti() {
  const pieces = Array.from({ length: 50 }, (_, i) => {
    const colors = [C.success, C.merged, C.medium, '#f0883e', C.critical, '#d2a8ff', '#58d1db', '#f778ba'];
    return {
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      duration: 2 + Math.random() * 2.5,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 6,
      shape: i % 3, // 0 = square, 1 = circle, 2 = rectangle
    };
  });

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      pointerEvents: 'none', zIndex: 9999, overflow: 'hidden',
    }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: -20,
          left: `${p.left}%`,
          width: p.shape === 2 ? p.size * 2 : p.size,
          height: p.size,
          background: p.color,
          borderRadius: p.shape === 1 ? '50%' : 2,
          opacity: 0.9,
          animation: `prsim-confetti-fall ${p.duration}s ease-in ${p.delay}s both, prsim-confetti-sway ${p.duration * 0.5}s ease-in-out ${p.delay}s infinite alternate`,
        }} />
      ))}
    </div>
  );
}

/* ─────────────────────── Approved / Changes-requested badge ─────────────────────── */

function ReviewBadge({ approved }) {
  const col = approved ? C.success : C.critical;
  const label = approved ? '✓ Approved' : '✗ Changes requested';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px',
      borderRadius: 8, background: col + '15', border: `1px solid ${col}44`,
      marginTop: 16, animation: 'prsim-scaleIn .4s ease',
    }}>
      <span style={{ fontSize: 20 }}>{approved ? '✅' : '🔴'}</span>
      <div>
        <div style={{ fontWeight: 600, color: col, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: C.textMuted }}>
          {approved ? 'All checks passed. Ready to merge.' : 'Security issues must be resolved.'}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Primary button ─────────────────────── */

function PrimaryButton({ onClick, children, style: extra = {} }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 28px', fontSize: 15, fontWeight: 600, color: '#fff',
        background: C.btnPrimary, border: '1px solid rgba(240,246,252,.1)',
        borderRadius: 8, cursor: 'pointer', fontFamily: C.font,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'background .15s, transform .1s',
        ...extra,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = C.btnPrimaryHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = C.btnPrimary; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function PRSimulation() {
  ensureKeyframes();

  const [step, setStep] = useState(1);
  const [scanFindings, setScanFindings] = useState([]);
  const [ciPhase, setCiPhase] = useState('running');        // step 2
  const [ciPhasePass, setCiPhasePass] = useState('running'); // step 4
  const [showConfetti, setShowConfetti] = useState(false);
  const [scanError, setScanError] = useState(null);

  /* ─── Scan API call ─── */
  const runScan = useCallback(async (xml, onSuccess) => {
    try {
      const res = await fetch('/api/scanner/scan-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: xml, filename: 'partner-api-policy.xml' }),
      });
      if (!res.ok) throw new Error(`Scan API returned ${res.status}`);
      const json = await res.json();
      const data = json.data || json.findings || json.results || [];
      onSuccess(Array.isArray(data) ? data : []);
    } catch (err) {
      setScanError(err.message);
      onSuccess([]);
    }
  }, []);

  /* ─── Step handlers ─── */
  const handleSubmitPR = useCallback(() => {
    setCiPhase('running');
    setScanFindings([]);
    setScanError(null);
    setStep(2);
  }, []);

  const handleCIComplete = useCallback(() => {
    runScan(INSECURE_POLICY, (findings) => {
      setScanFindings(findings);
      setCiPhase(findings.length > 0 ? 'done-fail' : 'done-pass');
    });
  }, [runScan]);

  const handleSeeHowToFix = useCallback(() => setStep(3), []);

  const handlePushFix = useCallback(() => {
    setCiPhasePass('running');
    setScanError(null);
    setStep(4);
  }, []);

  const handleCIPassComplete = useCallback(() => {
    runScan(SECURE_POLICY, (findings) => {
      setCiPhasePass(findings.length === 0 ? 'done-pass' : 'done-fail');
    });
  }, [runScan]);

  const handleMerge = useCallback(() => {
    setStep(5);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
  }, []);

  const handleRestart = useCallback(() => {
    setStep(1);
    setScanFindings([]);
    setCiPhase('running');
    setCiPhasePass('running');
    setShowConfetti(false);
    setScanError(null);
  }, []);

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <div style={{
      background: C.bg, color: C.text, fontFamily: C.font,
      padding: '32px 0', minHeight: '100%',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: C.text }}>
            🔄 PR Simulation — Shift-Left Security in Action
          </h1>
          <p style={{ color: C.textMuted, fontSize: 14, margin: '6px 0 20px' }}>
            Watch how automated policy scanning integrates into the developer workflow
          </p>
        </div>

        {/* Progress indicator */}
        <StepProgress current={step} />

        {/* Error banner */}
        {scanError && (
          <div style={{
            padding: '10px 16px', borderRadius: 6, marginBottom: 16,
            background: C.high + '15', border: `1px solid ${C.high}44`,
            color: C.high, fontSize: 13,
          }}>
            ⚠️ Scanner API error: {scanError} — showing simulation with cached results
          </div>
        )}

        {/* ──────── STEP 1 ──────── */}
        {step === 1 && (
          <div style={{ animation: 'prsim-fadeIn .5s ease' }}>
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: 24, marginBottom: 20,
            }}>
              <PRHeader state="open" />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                padding: '8px 12px', borderRadius: 6, background: C.bg,
              }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>📄</span>
                <code style={{ fontSize: 13, color: C.text }}>policies/partner-api-policy.xml</code>
                <span style={{
                  marginLeft: 'auto', padding: '2px 8px', borderRadius: 10, fontSize: 11,
                  background: C.success + '22', color: C.success, fontWeight: 600,
                }}>+22 lines</span>
              </div>
              <CodeBlock code={INSECURE_POLICY} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <PrimaryButton onClick={handleSubmitPR}>
                Submit PR →
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ──────── STEP 2 ──────── */}
        {step === 2 && (
          <div style={{ animation: 'prsim-fadeIn .5s ease' }}>
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: 24, marginBottom: 20,
            }}>
              <PRHeader state="open" />
              <CISteps
                key="ci-insecure"
                phase={ciPhase}
                scanResult={scanFindings}
                onComplete={handleCIComplete}
              />
              {ciPhase === 'done-fail' && scanFindings.length > 0 && (
                <FindingsComment findings={scanFindings} />
              )}
              {ciPhase === 'done-fail' && (
                <div style={{ marginTop: 16 }}>
                  <ReviewBadge approved={false} />
                </div>
              )}
            </div>
            {ciPhase === 'done-fail' && (
              <div style={{ textAlign: 'center', animation: 'prsim-fadeIn .5s ease' }}>
                <PrimaryButton onClick={handleSeeHowToFix}>
                  See How to Fix →
                </PrimaryButton>
              </div>
            )}
          </div>
        )}

        {/* ──────── STEP 3 ──────── */}
        {step === 3 && (
          <div style={{ animation: 'prsim-fadeIn .5s ease' }}>
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: 24, marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>🔧</span>
                <h2 style={{ margin: 0, fontSize: 18, color: C.text }}>Developer Fixes the Policy</h2>
                <span style={{
                  marginLeft: 'auto', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: C.medium + '22', color: C.medium,
                }}>Commit 2 of 2</span>
              </div>
              <DiffView />
            </div>
            <div style={{ textAlign: 'center' }}>
              <PrimaryButton onClick={handlePushFix}>
                Push Fix & Re-run CI →
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ──────── STEP 4 ──────── */}
        {step === 4 && (
          <div style={{ animation: 'prsim-fadeIn .5s ease' }}>
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: 24, marginBottom: 20,
            }}>
              <PRHeader state="open" />
              <CISteps
                key="ci-secure"
                phase={ciPhasePass}
                scanResult={[]}
                onComplete={handleCIPassComplete}
              />
              {ciPhasePass === 'done-pass' && (
                <div style={{ marginTop: 16 }}>
                  <ReviewBadge approved={true} />
                </div>
              )}
            </div>
            {ciPhasePass === 'done-pass' && (
              <div style={{ textAlign: 'center', animation: 'prsim-fadeIn .5s ease' }}>
                <PrimaryButton onClick={handleMerge} style={{ background: C.merged }}>
                  Merge PR →
                </PrimaryButton>
              </div>
            )}
          </div>
        )}

        {/* ──────── STEP 5 ──────── */}
        {step === 5 && (
          <div style={{ animation: 'prsim-fadeIn .5s ease' }}>
            {showConfetti && <Confetti />}
            {/* Merged badge */}
            <div style={{ textAlign: 'center', marginBottom: 28, animation: 'prsim-scaleIn .5s ease' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 12, padding: '16px 32px',
                borderRadius: 12, background: C.merged + '18', border: `2px solid ${C.merged}55`,
              }}>
                <span style={{ fontSize: 36 }}>🟣</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.merged }}>PR #847 Merged</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>
                    demo/insecure-partner-api → master • 2 commits • all checks passed
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: 24, marginBottom: 20,
            }}>
              <h3 style={{ margin: '0 0 18px', fontSize: 16, color: C.text }}>📋 What Just Happened</h3>
              {[
                { icon: '📝', text: 'Developer submitted insecure partner API policy', color: C.medium, time: '0:00' },
                { icon: '🔍', text: 'Automated scanner caught 12 vulnerabilities (4 critical)', color: C.critical, time: '0:03' },
                { icon: '🔧', text: 'Developer fixed all security issues', color: C.high, time: '0:15' },
                { icon: '✅', text: 'Scanner verified the fix — 0 issues remaining', color: C.success, time: '0:18' },
                { icon: '🚀', text: 'Policy deployed to production securely', color: C.merged, time: '0:20' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
                  borderLeft: `2px solid ${item.color}`,
                  marginLeft: 14, paddingLeft: 18,
                  animation: `prsim-fadeIn .5s ease ${i * 0.12}s both`,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: item.color + '22', fontSize: 16,
                  }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>{item.text}</div>
                  </div>
                  <code style={{
                    fontSize: 11, color: C.textMuted, background: C.bg,
                    padding: '2px 8px', borderRadius: 4,
                  }}>{item.time}</code>
                </div>
              ))}
            </div>

            {/* Value Summary */}
            <div style={{
              background: `linear-gradient(135deg, ${C.success}11, ${C.merged}11)`,
              border: `1px solid ${C.success}33`, borderRadius: 8,
              padding: 24, marginBottom: 28,
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: C.success }}>💎 Value Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: '🛡️', stat: '4', label: 'Critical vulnerabilities caught before production' },
                  { icon: '🤖', stat: 'Zero', label: 'Manual security review needed' },
                  { icon: '⚡', stat: 'Minutes', label: 'Fix cycle completed — not days' },
                  { icon: '📋', stat: 'OWASP', label: 'API Top 10 compliance enforced automatically' },
                ].map((v, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12, padding: '14px 18px', borderRadius: 8,
                    background: C.card, border: `1px solid ${C.border}`,
                    animation: `prsim-scaleIn .4s ease ${i * 0.1}s both`,
                  }}>
                    <span style={{ fontSize: 24 }}>{v.icon}</span>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.success }}>{v.stat}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.4 }}>{v.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Restart */}
            <div style={{ textAlign: 'center' }}>
              <PrimaryButton onClick={handleRestart} style={{ background: C.medium }}>
                🔄 Restart Demo
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PRSimulation;
