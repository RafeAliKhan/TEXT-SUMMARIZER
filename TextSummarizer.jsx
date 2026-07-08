import { useState, useRef, useCallback } from "react";
import { FlaskConical, Upload, Copy, Download, Check, Loader2, AlertTriangle, Sparkles } from "lucide-react";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

const FORMAT_OPTIONS = [
  { id: "bullets", label: "Bullet points" },
  { id: "paragraph", label: "Short paragraph" },
  { id: "tldr", label: "One-line TL;DR" },
];

const LENGTH_OPTIONS = [
  { id: "short", label: "Short", hint: "~3 points / 40 words" },
  { id: "medium", label: "Medium", hint: "~6 points / 90 words" },
  { id: "long", label: "Long", hint: "~10 points / 160 words" },
];

function countWords(str) {
  const t = (str || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function buildInstruction(format, length) {
  const lengthMap = {
    bullets: { short: "3 bullet points", medium: "5-6 bullet points", long: "9-10 bullet points" },
    paragraph: { short: "about 40 words", medium: "about 90 words", long: "about 160 words" },
    tldr: { short: "a single short sentence", medium: "a single sentence", long: "one or two sentences" },
  };
  const target = lengthMap[format][length];

  if (format === "bullets") {
    return `Summarize the following text as ${target}. Start each line with "• ". Cover only the most important ideas, in the order they matter most. Do not add commentary, headers, or information not present in the source.`;
  }
  if (format === "paragraph") {
    return `Summarize the following text in ${target}, as a single flowing paragraph. Do not use bullet points, headers, or add information not present in the source.`;
  }
  return `Summarize the following text in ${target} — the single most essential takeaway, TL;DR style. No preamble, no bullet points, just the sentence(s).`;
}

export default function TextSummarizer() {
  const [inputText, setInputText] = useState("");
  const [format, setFormat] = useState("bullets");
  const [length, setLength] = useState("medium");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef(null);

  const inputWords = countWords(inputText);
  const outputWords = countWords(summary);
  const reduction = inputWords > 0 && outputWords > 0
    ? Math.max(0, Math.round((1 - outputWords / inputWords) * 100))
    : 0;

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError("Only .txt files can be read directly in the browser. Paste other content instead.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setInputText(ev.target.result || "");
      setFileName(file.name);
    };
    reader.onerror = () => setError("Couldn't read that file. Try pasting the text instead.");
    reader.readAsText(file);
  }, []);

  const handleSummarize = useCallback(async () => {
    if (!inputText.trim()) {
      setError("Paste in some text or upload a .txt file first.");
      return;
    }
    setError("");
    setLoading(true);
    setSummary("");
    try {
      const instruction = buildInstruction(format, length);
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You are a precise, faithful summarizer. You never invent facts, numbers, or claims that aren't in the source text. You never add opinions or filler like 'this text discusses'. You output only the summary itself.",
          messages: [
            {
              role: "user",
              content: `${instruction}\n\nTEXT TO SUMMARIZE:\n"""\n${inputText}\n"""`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const data = await response.json();
      const text = (data.content || [])
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      if (!text) throw new Error("No summary came back. Try again.");
      setSummary(text);
    } catch (err) {
      setError(err.message || "Something went wrong while distilling this text.");
    } finally {
      setLoading(false);
    }
  }, [inputText, format, length]);

  const handleCopy = useCallback(async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  }, [summary]);

  const handleDownload = useCallback(() => {
    if (!summary) return;
    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summary.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [summary]);

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        background: "#14211C",
        color: "#EFE9DA",
        minHeight: "100%",
        padding: "32px 20px 48px",
        boxSizing: "border-box",
      }}
    >
      <style>{FONT_IMPORT}</style>
      <style>{`
        .ts-textarea::placeholder { color: #7C8B82; }
        .ts-textarea:focus, .ts-select:focus, .ts-btn:focus-visible {
          outline: 2px solid #C98A3E;
          outline-offset: 2px;
        }
        .ts-select option { background: #EFE9DA; color: #1B2420; }
        @media (min-width: 860px) {
          .ts-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ts-gauge-fill, .ts-spin { transition: none !important; animation: none !important; }
        }
        .ts-spin { animation: ts-spin 0.9s linear infinite; }
        @keyframes ts-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 960, margin: "0 auto 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <FlaskConical size={22} color="#C98A3E" strokeWidth={2} />
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Text Summarizer
          </span>
        </div>
        <p style={{ margin: 0, color: "#9FAFA5", fontSize: 14.5, maxWidth: 560 }}>
          Paste in an article, document, or notes. Choose a format. Get the essence back — nothing added, nothing missing.
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto 18px",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <ControlSelect
          label="Format"
          value={format}
          onChange={setFormat}
          options={FORMAT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
        />
        <ControlSelect
          label="Length"
          value={length}
          onChange={setLength}
          options={LENGTH_OPTIONS.map((o) => ({ value: o.id, label: `${o.label} — ${o.hint}` }))}
        />

        <button
          className="ts-btn"
          onClick={handleSummarize}
          disabled={loading}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: loading ? "#A96F2C" : "#C98A3E",
            color: "#14211C",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: 14.5,
            cursor: loading ? "default" : "pointer",
            transition: "background 0.15s ease",
          }}
        >
          {loading ? (
            <>
              <Loader2 className="ts-spin" size={16} />
              Distilling…
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Distill
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto 18px",
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            background: "rgba(201,138,62,0.12)",
            border: "1px solid #C98A3E",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13.5,
            color: "#EFE9DA",
          }}
        >
          <AlertTriangle size={16} color="#C98A3E" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Panels */}
      <div
        className="ts-grid"
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 18,
        }}
      >
        {/* Input panel */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span style={panelLabelStyle}>Source text</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {fileName && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "#6B7A70" }}>
                  {fileName}
                </span>
              )}
              <button
                className="ts-btn"
                onClick={() => fileInputRef.current?.click()}
                style={ghostBtnStyle}
              >
                <Upload size={13} /> Upload .txt
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,text/plain"
                onChange={handleFile}
                style={{ display: "none" }}
              />
            </div>
          </div>
          <textarea
            className="ts-textarea"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (fileName) setFileName("");
            }}
            placeholder="Paste your article, report, or notes here…"
            style={{
              width: "100%",
              minHeight: 320,
              resize: "vertical",
              background: "transparent",
              border: "none",
              color: "#1B2420",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 14.5,
              lineHeight: 1.6,
              padding: "14px 16px",
              boxSizing: "border-box",
            }}
          />
          <div style={panelFooterStyle}>
            <span>{inputWords.toLocaleString()} words</span>
          </div>
        </div>

        {/* Output panel */}
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span style={panelLabelStyle}>Summary</span>
            {summary && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ts-btn" onClick={handleCopy} style={ghostBtnStyle}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button className="ts-btn" onClick={handleDownload} style={ghostBtnStyle}>
                  <Download size={13} /> Save
                </button>
              </div>
            )}
          </div>

          <div style={{ padding: "14px 16px", minHeight: 320, boxSizing: "border-box" }}>
            {!summary && !loading && (
              <div
                style={{
                  height: 280,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  color: "#8A9A90",
                  gap: 10,
                }}
              >
                <FlaskConical size={30} color="#C98A3E" strokeWidth={1.5} />
                <p style={{ margin: 0, fontSize: 13.5, maxWidth: 260, lineHeight: 1.5 }}>
                  Add source text, then click <strong>Distill</strong> to see the summary here.
                </p>
              </div>
            )}

            {loading && (
              <div
                style={{
                  height: 280,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  color: "#8A9A90",
                }}
              >
                <Loader2 className="ts-spin" size={26} color="#C98A3E" />
                <p style={{ margin: 0, fontSize: 13.5 }}>Reducing to the essentials…</p>
              </div>
            )}

            {summary && !loading && (
              <div
                style={{
                  color: "#1B2420",
                  fontSize: 14.5,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {summary}
              </div>
            )}
          </div>

          {/* Compression gauge */}
          <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #DCD4BE" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                color: "#5E6E64",
                marginBottom: 6,
              }}
            >
              <span>{inputWords > 0 ? `${inputWords.toLocaleString()} → ${outputWords.toLocaleString()} words` : "—"}</span>
              <span>{summary ? `${reduction}% shorter` : ""}</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: "#DCD4BE", overflow: "hidden" }}>
              <div
                className="ts-gauge-fill"
                style={{
                  height: "100%",
                  width: summary ? `${Math.max(4, 100 - reduction)}%` : "0%",
                  background: "linear-gradient(90deg, #C98A3E, #4F8C82)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <p style={{ maxWidth: 960, margin: "22px auto 0", fontSize: 12, color: "#5E6E64", textAlign: "center" }}>
        Summaries are generated by Claude and may need a quick check against the source for anything high-stakes.
      </p>
    </div>
  );
}

function ControlSelect({ label, value, onChange, options }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "#9FAFA5" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <select
        className="ts-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "#1D2C25",
          color: "#EFE9DA",
          border: "1px solid #34453B",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 13.5,
          fontFamily: "'IBM Plex Sans', sans-serif",
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const panelStyle = {
  background: "#EFE9DA",
  borderRadius: 12,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
};

const panelHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  borderBottom: "1px solid #DCD4BE",
};

const panelLabelStyle = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontWeight: 600,
  fontSize: 12.5,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#4A5A50",
};

const panelFooterStyle = {
  padding: "8px 16px 12px",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  color: "#6B7A70",
};

const ghostBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  background: "transparent",
  border: "1px solid #B9AF95",
  color: "#4A5A50",
  borderRadius: 6,
  padding: "5px 9px",
  fontSize: 11.5,
  fontFamily: "'IBM Plex Sans', sans-serif",
  cursor: "pointer",
};
