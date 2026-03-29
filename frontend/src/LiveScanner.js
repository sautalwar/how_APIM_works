import { useState, useEffect, useCallback } from 'react';

/* ─── Theme constants ─── */
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
  btnPrimary: '#238636',
  btnHover: '#2ea043',
  codeBg: '#0d1117',
  codeText: '#c9d1d9',
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEV_COLOR = {
  critical: C.critical,
  high: C.high,
  medium: C.medium,
  low: C.low,
  info: C.textMuted,
};
const SEV_ICON = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
  info: 'ℹ️',
};

/* ─── XML syntax highlighter ─── */
function highlightXml(xml) {
  if (!xml) return null;
  const escaped = xml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const highlighted = escaped
    // Comments
    .replace(
      /(&lt;!--[\s\S]*?--&gt;)/g,
      '<span style="color:#8b949e;font-style:italic">$1</span>'
    )
    // Tags
    .replace(
      /(&lt;\/?)([\w:.-]+)/g,
      '<span style="color:#ff7b72">$1</span><span style="color:#7ee787">$2</span>'
    )
    // Closing >
    .replace(
      /(\/?&gt;)/g,
      '<span style="color:#ff7b72">$1</span>'
    )
    // Attribute names
    .replace(
      /\s([\w:.-]+)(=)/g,
      ' <span style="color:#79c0ff">$1</span><span style="color:#e6edf3">$2</span>'
    )
    // Attribute values
    .replace(
      /(".*?")/g,
      '<span style="color:#a5d6ff">$1</span>'
    );

  return highlighted;
}

/* ─── Keyframes injected once ─── */
const STYLE_TAG_CONTENT = `
@keyframes ls-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes ls-slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ls-celebrate {
  0% { transform: scale(0.5) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.15) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes ls-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes ls-badgePop {
  0% { transform: scale(0); }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
`;

/* ─── Sub-components ─── */

function ScanningAnimation() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>
        {['⬤', '⬤', '⬤'].map((dot, i) => (
          <span
            key={i}
            style={{
              color: C.medium,
              margin: '0 6px',
              animation: 'ls-pulse 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.25}s`,
              display: 'inline-block',
            }}
          >
            {dot}
          </span>
        ))}
      </div>
      <div style={{ color: C.textMuted, fontSize: 14, letterSpacing: 1 }}>
        Analyzing policies for security vulnerabilities…
      </div>
      <div
        style={{
          marginTop: 20,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${C.card}, ${C.medium}, ${C.card})`,
          backgroundSize: '200% 100%',
          animation: 'ls-shimmer 1.5s linear infinite',
          maxWidth: 320,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      />
    </div>
  );
}

function ZeroFindingsCelebration() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        animation: 'ls-celebrate 0.6s ease-out forwards',
      }}
    >
      <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: C.success,
          marginBottom: 8,
        }}
      >
        All Clear — No Vulnerabilities Found!
      </div>
      <div style={{ color: C.textMuted, fontSize: 14 }}>
        Your APIM policies passed all security checks.
      </div>
    </div>
  );
}

function SeverityBadge({ severity, count }) {
  const color = SEV_COLOR[severity] || C.textMuted;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        borderRadius: 20,
        padding: '4px 14px',
        fontSize: 13,
        fontWeight: 600,
        animation: 'ls-badgePop 0.35s ease-out forwards',
      }}
    >
      {SEV_ICON[severity]} {severity.charAt(0).toUpperCase() + severity.slice(1)}
      <span
        style={{
          background: color,
          color: '#000',
          borderRadius: 10,
          padding: '1px 8px',
          fontSize: 12,
          fontWeight: 700,
          marginLeft: 2,
        }}
      >
        {count}
      </span>
    </span>
  );
}

function SummaryBar({ findings }) {
  const counts = {};
  findings.forEach((f) => {
    const s = (f.severity || 'info').toLowerCase();
    counts[s] = (counts[s] || 0) + 1;
  });
  const ordered = Object.entries(counts).sort(
    ([a], [b]) => (SEV_ORDER[a] ?? 99) - (SEV_ORDER[b] ?? 99)
  );
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        padding: '14px 18px',
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        marginBottom: 20,
        alignItems: 'center',
      }}
    >
      <span style={{ color: C.textMuted, fontSize: 13, fontWeight: 600, marginRight: 4 }}>
        {findings.length} finding{findings.length !== 1 ? 's' : ''}
      </span>
      {ordered.map(([sev, cnt]) => (
        <SeverityBadge key={sev} severity={sev} count={cnt} />
      ))}
    </div>
  );
}

function FindingCard({ finding, index }) {
  const [expanded, setExpanded] = useState(false);
  const sev = (finding.severity || 'info').toLowerCase();
  const color = SEV_COLOR[sev] || C.textMuted;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        marginBottom: 10,
        animation: 'ls-slideUp 0.35s ease-out forwards',
        animationDelay: `${index * 0.04}s`,
        opacity: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
          flexWrap: 'wrap',
        }}
      >
        {/* Severity pill */}
        <span
          style={{
            background: `${color}22`,
            color,
            border: `1px solid ${color}55`,
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          {SEV_ICON[sev]} {sev}
        </span>

        {/* Rule info */}
        <span style={{ color: C.textMuted, fontSize: 12, fontFamily: 'monospace', flexShrink: 0 }}>
          {finding.rule_id}
        </span>
        <span style={{ color: C.text, fontSize: 14, fontWeight: 600, flex: 1 }}>
          {finding.rule_name}
        </span>

        {/* OWASP tag */}
        {finding.owasp && (
          <span
            style={{
              background: '#388bfd22',
              color: C.medium,
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {finding.owasp}
          </span>
        )}

        {/* Chevron */}
        <span
          style={{
            color: C.textMuted,
            fontSize: 14,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            padding: '0 18px 16px',
            borderTop: `1px solid ${C.border}`,
            animation: 'ls-slideUp 0.2s ease-out',
          }}
        >
          {/* File / line */}
          {(finding.file || finding.line) && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: C.textMuted,
                fontFamily: 'monospace',
              }}
            >
              📄 {finding.file || '—'}
              {finding.line != null && `:${finding.line}`}
            </div>
          )}

          {/* Description */}
          <div style={{ marginTop: 10, color: C.text, fontSize: 14, lineHeight: 1.6 }}>
            {finding.description}
          </div>

          {/* Category */}
          {finding.category && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.textMuted }}>
              Category: <strong style={{ color: C.text }}>{finding.category}</strong>
            </div>
          )}

          {/* Recommendation */}
          {finding.recommendation && (
            <div
              style={{
                marginTop: 14,
                background: `${C.success}12`,
                border: `1px solid ${C.success}35`,
                borderRadius: 8,
                padding: '12px 16px',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.success,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                💡 Recommended Fix
              </div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>
                {finding.recommendation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */

function LiveScanner() {
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [policyContent, setPolicyContent] = useState('');
  const [findings, setFindings] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanDuration, setScanDuration] = useState(null);
  const [scannedLabel, setScannedLabel] = useState('');
  const [error, setError] = useState('');
  const [loadingPolicies, setLoadingPolicies] = useState(true);

  /* Fetch policy list on mount */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/scanner/policies');
        if (!res.ok) throw new Error('Failed to load policies');
        const json = await res.json();
        if (!cancelled) {
          setPolicies(json.data || []);
          setLoadingPolicies(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoadingPolicies(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* When selected policy changes, store its content */
  useEffect(() => {
    if (selectedPolicy) {
      setPolicyContent(selectedPolicy.content || '');
    } else {
      setPolicyContent('');
    }
  }, [selectedPolicy]);

  /* Scan a single file */
  const scanFile = useCallback(
    async (filename) => {
      setScanning(true);
      setFindings([]);
      setScanDuration(null);
      setScannedLabel(filename);
      setError('');
      const t0 = performance.now();
      try {
        const res = await fetch(`/api/scanner/scan/${encodeURIComponent(filename)}`);
        if (!res.ok) throw new Error('Scan request failed');
        const json = await res.json();
        const sorted = (json.data || []).sort(
          (a, b) =>
            (SEV_ORDER[(a.severity || '').toLowerCase()] ?? 99) -
            (SEV_ORDER[(b.severity || '').toLowerCase()] ?? 99)
        );
        setFindings(sorted);
        setScanDuration(Math.round(performance.now() - t0));
      } catch (err) {
        setError(err.message);
      } finally {
        setScanning(false);
      }
    },
    []
  );

  /* Scan all policies */
  const scanAll = useCallback(async () => {
    setScanning(true);
    setFindings([]);
    setScanDuration(null);
    setScannedLabel('All Policies');
    setError('');
    const t0 = performance.now();
    try {
      const res = await fetch('/api/scanner/scan');
      if (!res.ok) throw new Error('Scan request failed');
      const json = await res.json();
      const sorted = (json.data || []).sort(
        (a, b) =>
          (SEV_ORDER[(a.severity || '').toLowerCase()] ?? 99) -
          (SEV_ORDER[(b.severity || '').toLowerCase()] ?? 99)
      );
      setFindings(sorted);
      setScanDuration(Math.round(performance.now() - t0));
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }, []);

  /* Keyboard shortcut: Enter triggers scan */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && !scanning && selectedPolicy && e.target.tagName !== 'TEXTAREA') {
        scanFile(selectedPolicy.name);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedPolicy, scanning, scanFile]);

  /* ─── Render ─── */
  return (
    <div
      style={{
        fontFamily: C.font,
        color: C.text,
        background: C.bg,
        minHeight: '100vh',
        padding: '32px 24px',
        boxSizing: 'border-box',
      }}
    >
      <style>{STYLE_TAG_CONTENT}</style>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 28 }}>🛡️</span>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: 0,
              background: `linear-gradient(135deg, ${C.medium}, ${C.success})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Live Security Scanner
          </h1>
        </div>
        <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 28px 42px' }}>
          Scan Azure API Management policies for OWASP vulnerabilities in real time.
          <span style={{ color: C.textMuted, fontSize: 12, marginLeft: 10, opacity: 0.6 }}>
            Press <kbd style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>Enter</kbd> to scan
          </span>
        </p>

        {/* Error banner */}
        {error && (
          <div
            style={{
              background: `${C.critical}18`,
              border: `1px solid ${C.critical}40`,
              borderRadius: 8,
              padding: '12px 18px',
              marginBottom: 20,
              color: C.critical,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>⚠️</span> {error}
            <button
              onClick={() => setError('')}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: C.critical,
                cursor: 'pointer',
                fontSize: 16,
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Policy selector section ── */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              📁 Policy Files
            </h2>
            <button
              onClick={scanAll}
              disabled={scanning || policies.length === 0}
              style={{
                background: 'linear-gradient(135deg, #6e40c9, #8957e5)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: scanning || policies.length === 0 ? 'not-allowed' : 'pointer',
                opacity: scanning || policies.length === 0 ? 0.5 : 1,
                transition: 'opacity 0.2s, transform 0.1s',
              }}
            >
              ⚡ Scan All Policies
            </button>
          </div>

          {loadingPolicies ? (
            <div style={{ color: C.textMuted, fontSize: 14, padding: 12 }}>
              Loading policies…
            </div>
          ) : policies.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: 14, padding: 12 }}>
              No policy files found. Make sure the scanner backend is running on port 4000.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 10,
              }}
            >
              {policies.map((p) => {
                const active = selectedPolicy?.name === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => setSelectedPolicy(active ? null : p)}
                    style={{
                      background: active ? `${C.medium}18` : C.bg,
                      border: `1px solid ${active ? C.medium : C.border}`,
                      borderRadius: 8,
                      padding: '12px 14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      color: C.text,
                      fontFamily: C.font,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 4,
                        wordBreak: 'break-all',
                      }}
                    >
                      📄 {p.name}
                    </div>
                    {p.size != null && (
                      <div style={{ fontSize: 11, color: C.textMuted }}>
                        {p.size > 1024
                          ? `${(p.size / 1024).toFixed(1)} KB`
                          : `${p.size} B`}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Selected policy preview + scan button ── */}
        {selectedPolicy && (
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              animation: 'ls-slideUp 0.25s ease-out',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                🔎 {selectedPolicy.name}
              </h2>
              <button
                onClick={() => scanFile(selectedPolicy.name)}
                disabled={scanning}
                style={{
                  background: scanning ? C.border : C.btnPrimary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 22px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s, transform 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!scanning) e.currentTarget.style.background = C.btnHover;
                }}
                onMouseLeave={(e) => {
                  if (!scanning) e.currentTarget.style.background = C.btnPrimary;
                }}
              >
                🔍 Run Security Scan
              </button>
            </div>

            {/* XML Preview */}
            <div
              style={{
                background: C.codeBg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                maxHeight: 360,
                overflow: 'auto',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  background: C.card,
                  borderBottom: `1px solid ${C.border}`,
                  padding: '6px 14px',
                  fontSize: 11,
                  color: C.textMuted,
                  fontFamily: 'monospace',
                  zIndex: 1,
                }}
              >
                XML Policy · {policyContent.split('\n').length} lines
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '14px 18px',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: C.codeText,
                  fontFamily:
                    "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
                  overflow: 'auto',
                  tabSize: 2,
                }}
              >
                <code
                  dangerouslySetInnerHTML={{ __html: highlightXml(policyContent) }}
                />
              </pre>
            </div>
          </div>
        )}

        {/* ── Scanning animation ── */}
        {scanning && (
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <ScanningAnimation />
          </div>
        )}

        {/* ── Results ── */}
        {!scanning && findings.length > 0 && (
          <div style={{ animation: 'ls-slideUp 0.3s ease-out' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                🔬 Scan Results
                {scannedLabel && (
                  <span style={{ fontWeight: 400, fontSize: 14, color: C.textMuted, marginLeft: 10 }}>
                    — {scannedLabel}
                  </span>
                )}
              </h2>
              {scanDuration != null && (
                <span style={{ fontSize: 12, color: C.textMuted }}>
                  ⏱ Completed in {scanDuration < 1000 ? `${scanDuration}ms` : `${(scanDuration / 1000).toFixed(2)}s`}
                </span>
              )}
            </div>

            <SummaryBar findings={findings} />

            {findings.map((f, i) => (
              <FindingCard key={`${f.rule_id}-${f.file}-${f.line}-${i}`} finding={f} index={i} />
            ))}
          </div>
        )}

        {/* ── Zero findings celebration ── */}
        {!scanning && scanDuration != null && findings.length === 0 && (
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.success}40`,
              borderRadius: 12,
              marginBottom: 24,
            }}
          >
            <ZeroFindingsCelebration />
            {scanDuration != null && (
              <div
                style={{
                  textAlign: 'center',
                  paddingBottom: 20,
                  fontSize: 12,
                  color: C.textMuted,
                }}
              >
                ⏱ Scanned in {scanDuration}ms
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveScanner;
