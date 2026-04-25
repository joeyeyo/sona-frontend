import { useState, useRef, useEffect } from "react";

const RAILWAY_URL = "https://sona-production-529e.up.railway.app";

const WORKSTREAMS = [
  {
    id: "marketing", label: "Marketing", icon: "📣", color: "#FF6B35",
    templates: [
      "Write 3 Instagram posts for my event",
      "Generate 3 Instagram image briefs I can make in Canva",
      "Create a posting schedule for the next 3 weeks",
      "Write DM outreach copy for my network",
      "Write an event description for the invite page",
    ],
  },
  {
    id: "vendors", label: "Vendors", icon: "🤝", color: "#00D4FF",
    templates: [
      "Draft a cold email to a photographer",
      "Write outreach to a catering vendor",
      "Draft a venue inquiry email",
      "Compare vendor quotes and recommend one",
    ],
  },
  {
    id: "guests", label: "Guests", icon: "👥", color: "#A8FF3E",
    templates: [
      "Write personalized invitation messages",
      "Draft a WhatsApp blast for my network",
      "Write an RSVP reminder message",
      "Create a waitlist response message",
    ],
  },
  {
    id: "logistics", label: "Logistics", icon: "📋", color: "#FF3E9A",
    templates: [
      "Generate a full planning timeline",
      "Create a day-of run-of-show",
      "Build a vendor confirmation checklist",
      "Write a day-of setup checklist",
    ],
  },
];

const DEFAULT_EVENT = {
  name: "", date: "", venue: "", neighborhood: "",
  city: "Los Angeles", guestCount: "", budget: "", vibe: "",
  audience: "Asian tech founders", hostName: "", hostInstagram: "",
  instagramFollowers: "", additionalContext: "",
};

function buildSystemPrompt(event) {
  const hasEvent = event.name || event.date || event.venue;
  if (!hasEvent) return `You are Sona, an expert AI event planner. No event has been configured yet.`;
  return `You are Sona, an expert AI event planner helping execute a specific upcoming event.

EVENT DETAILS:
- Name: ${event.name || "Untitled Event"}
- Date: ${event.date || "TBD"}
- Venue: ${event.venue || "TBD"}${event.neighborhood ? ` in ${event.neighborhood}` : ""}
- City: ${event.city || "Los Angeles"}
- Expected guests: ${event.guestCount || "~50"}
- Budget: ${event.budget ? `$${event.budget}` : "TBD"}
- Vibe/Theme: ${event.vibe || "Intimate, curated networking"}
- Target audience: ${event.audience || "Asian tech founders"}
- Host: ${event.hostName || "the organizer"}
- Instagram: ${event.hostInstagram ? `@${event.hostInstagram}` : "N/A"} (${event.instagramFollowers || "~900"} followers)
${event.additionalContext ? `- Additional context: ${event.additionalContext}` : ""}

Generate ready-to-use content. Be specific, use actual event details. Write like a founder, not a marketer.
When generating Canva image briefs: Format, Background, Text overlay, Font mood, Color palette, Mood/vibe.`;
}

// ── Gmail Compose Modal ───────────────────────────────────────────────────────
function GmailModal({ vendor, draftContent, onClose }) {
  const [to, setTo] = useState(vendor?.email || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const hasEmail = to.trim().length > 0;

  // Parse draft content into subject + body
  useEffect(() => {
    if (!draftContent) return;
    const lines = draftContent.split("\n");
    let subjectLine = "";
    let bodyStart = 0;

    // Look for Subject: line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().startsWith("subject:")) {
        subjectLine = lines[i].replace(/^subject:\s*/i, "").trim();
        bodyStart = i + 1;
        break;
      }
    }

    if (!subjectLine) {
      // Generate a default subject from vendor name
      subjectLine = `Catering inquiry for our upcoming event`;
    }

    setSubject(subjectLine);
    setBody(lines.slice(bodyStart).join("\n").trim());
  }, [draftContent]);

  const handleSend = async () => {
    if (!hasEmail || sending || sent) return;
    setSending(true);
    setError("");
    try {
      const resp = await fetch(`${RAILWAY_URL}/send-vendor-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          vendor_name: vendor?.name || "vendor",
        }),
      });
      const data = await resp.json();
      if (data.status === "sent") {
        setSent(true);
        setTimeout(onClose, 2000);
      } else {
        setError(data.error || "Failed to send. Try again.");
      }
    } catch (e) {
      setError("Connection error. Check Railway is running.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, backdropFilter: "blur(12px)",
    }}>
      <div style={{
        background: "#0C0C1A",
        border: "1px solid #1E1E35",
        borderRadius: "20px",
        width: "600px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid #1E1E35",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#00D4FF", letterSpacing: "0.12em", marginBottom: "4px" }}>
              ✉ COMPOSE EMAIL
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#E8E8F0" }}>
              {vendor?.name || "Vendor"}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "1px solid #1E1E35",
            borderRadius: "8px", width: "32px", height: "32px",
            color: "#5A5A7A", cursor: "pointer", fontSize: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#FF3E9A44"; e.currentTarget.style.color = "#FF3E9A"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1E1E35"; e.currentTarget.style.color = "#5A5A7A"; }}
          >✕</button>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", padding: "0 24px", overflowY: "auto", flex: 1 }}>

          {/* To field */}
          <div style={{ borderBottom: "1px solid #1E1E35", padding: "14px 0", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", letterSpacing: "0.08em", width: "60px", flexShrink: 0 }}>TO</div>
            <input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="vendor@email.com"
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: hasEmail ? "#E8E8F0" : "#FF3E9A",
                fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
              }}
            />
            {!hasEmail && (
              <div style={{
                fontSize: "10px", fontFamily: "'Space Mono', monospace",
                color: "#FF3E9A", background: "#FF3E9A11",
                border: "1px solid #FF3E9A33", borderRadius: "6px",
                padding: "3px 8px", whiteSpace: "nowrap",
              }}>
                NO EMAIL FOUND
              </div>
            )}
            {hasEmail && (
              <div style={{
                fontSize: "10px", fontFamily: "'Space Mono', monospace",
                color: "#A8FF3E", background: "#A8FF3E11",
                border: "1px solid #A8FF3E33", borderRadius: "6px",
                padding: "3px 8px",
              }}>✓</div>
            )}
          </div>

          {/* Subject field */}
          <div style={{ borderBottom: "1px solid #1E1E35", padding: "14px 0", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", letterSpacing: "0.08em", width: "60px", flexShrink: 0 }}>SUBJECT</div>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject..."
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
              }}
            />
          </div>

          {/* Body */}
          <div style={{ padding: "16px 0", flex: 1 }}>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your email here..."
              rows={12}
              style={{
                width: "100%", background: "transparent", border: "none", outline: "none",
                color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
                lineHeight: "1.7", resize: "vertical", minHeight: "240px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid #1E1E35",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!hasEmail || sending || sent}
            style={{
              background: sent
                ? "linear-gradient(135deg, #A8FF3E, #4ADE80)"
                : hasEmail
                  ? "linear-gradient(135deg, #00D4FF, #0088AA)"
                  : "#1A1A2E",
              border: hasEmail ? "none" : "1px solid #2A2A4A",
              borderRadius: "10px",
              padding: "12px 28px",
              color: sent ? "#07070F" : hasEmail ? "white" : "#3A3A5A",
              fontFamily: "'Space Mono', monospace",
              fontSize: "12px",
              letterSpacing: "0.08em",
              cursor: hasEmail && !sending && !sent ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "8px",
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sent ? "✓ SENT" : sending ? (
              <>
                <span style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                SENDING...
              </>
            ) : "SEND →"}
          </button>

          {!hasEmail && (
            <div style={{ fontSize: "12px", color: "#5A5A7A", fontFamily: "'DM Sans', sans-serif" }}>
              Add an email address above to send
            </div>
          )}

          {error && (
            <div style={{ fontSize: "12px", color: "#FF3E9A", fontFamily: "'Space Mono', monospace" }}>
              {error}
            </div>
          )}

          <div style={{ marginLeft: "auto", fontSize: "11px", color: "#3A3A5A", fontFamily: "'Space Mono', monospace" }}>
            SENDS FROM GMAIL
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vendor Card ───────────────────────────────────────────────────────────────
function VendorCard({ vendor, onDraftEmail }) {
  const stars = "★".repeat(Math.floor(vendor.rating)) + (vendor.rating % 1 >= 0.5 ? "½" : "");
  return (
    <div
      style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "12px", overflow: "hidden", transition: "border-color 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#00D4FF33"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#1A1A2E"}
    >
      {vendor.image_url && (
        <div style={{ height: "120px", overflow: "hidden", position: "relative" }}>
          <img src={vendor.image_url} alt={vendor.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, #0A0A18)" }} />
          <div style={{ position: "absolute", bottom: "8px", left: "12px" }}>
            <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#00D4FF", background: "#0A0A18CC", padding: "2px 6px", borderRadius: "4px" }}>
              {vendor.categories?.[0]}
            </span>
          </div>
        </div>
      )}
      <div style={{ padding: "14px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#E8E8F0", marginBottom: "4px" }}>{vendor.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ color: "#FFB800", fontSize: "12px" }}>{stars}</span>
          <span style={{ fontSize: "12px", color: "#00D4FF", fontWeight: 600 }}>{vendor.rating}</span>
          <span style={{ fontSize: "11px", color: "#5A5A7A" }}>({vendor.review_count} reviews)</span>
          {vendor.price && vendor.price !== "N/A" && <span style={{ fontSize: "11px", color: "#A8FF3E" }}>{vendor.price}</span>}
          {vendor.score && <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FF6B35", marginLeft: "auto" }}>↑{vendor.score}</span>}
        </div>
        {vendor.email && <div style={{ fontSize: "11px", color: "#A8FF3E", marginBottom: "6px" }}>✉ {vendor.email}</div>}
        {vendor.website && !vendor.email && (
          <div style={{ fontSize: "11px", color: "#5A5A7A", marginBottom: "6px" }}>
            🌐 <a href={vendor.website} target="_blank" rel="noopener noreferrer" style={{ color: "#5A5A7A" }}>
              {vendor.website.replace("https://", "").replace("http://", "").split("/")[0]}
            </a>
          </div>
        )}
        {vendor.ai_reason && <div style={{ fontSize: "12px", color: "#8888AA", lineHeight: 1.5, marginBottom: "10px", fontStyle: "italic" }}>"{vendor.ai_reason}"</div>}
        <div style={{ fontSize: "11px", color: "#5A5A7A", marginBottom: "4px" }}>📍 {vendor.address}</div>
        {vendor.phone && vendor.phone !== "N/A" && <div style={{ fontSize: "11px", color: "#5A5A7A", marginBottom: "10px" }}>📞 {vendor.phone}</div>}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => onDraftEmail(vendor)}
            style={{ flex: 1, background: "linear-gradient(135deg, #00D4FF22, #00D4FF11)", border: "1px solid #00D4FF44", borderRadius: "8px", padding: "8px", color: "#00D4FF", fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.05em", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(135deg, #00D4FF33, #00D4FF22)"}
            onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(135deg, #00D4FF22, #00D4FF11)"}
          >✉ DRAFT EMAIL</button>
          <a href={vendor.url} target="_blank" rel="noopener noreferrer"
            style={{ padding: "8px 12px", background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.05em", textDecoration: "none", transition: "all 0.15s", display: "flex", alignItems: "center" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#2A2A4A"; e.currentTarget.style.color = "#E8E8F0"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1A1A2E"; e.currentTarget.style.color = "#5A5A7A"; }}
          >YELP ↗</a>
        </div>
      </div>
    </div>
  );
}

// ── Vendor Search Panel ───────────────────────────────────────────────────────
function VendorSearchPanel({ event, onDraftEmail, vendors, setVendors, summary, setSummary, searched, setSearched }) {
  const [searchParams, setSearchParams] = useState({
    keywords: "asian food", category: "caterers",
    budget: event.budget || "600", guest_count: event.guestCount || "50",
    min_rating: "4.25", location: event.city || "Los Angeles, CA",
  });
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  const search = async () => {
    if (loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch(`${RAILWAY_URL}/search-vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...searchParams,
          budget: parseFloat(searchParams.budget),
          guest_count: parseInt(searchParams.guest_count),
          min_rating: parseFloat(searchParams.min_rating),
          scrape_emails: true,
        }),
      });
      const data = await response.json();
      setVendors(data.vendors || []);
      setSummary({ total: data.total, emails_found: data.emails_found });
      setSearched(true);
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const cancel = () => { if (abortRef.current) abortRef.current.abort(); };
  const handleInputKeyDown = (e) => { if (e.key === "Enter" && !loading) search(); };
  const categories = ["caterers", "photographers", "venues", "florists", "dj", "bartenders", "decorators"];
  const inputStyle = (disabled) => ({
    width: "100%", background: disabled ? "#080810" : "#0F0F1A",
    border: "1px solid #1A1A2E", borderRadius: "8px", padding: "8px 12px",
    color: disabled ? "#5A5A7A" : "#E8E8F0", fontFamily: "'DM Sans', sans-serif",
    fontSize: "13px", outline: "none", boxSizing: "border-box", transition: "all 0.2s",
  });

  return (
    <div style={{ padding: "28px", overflowY: "auto", height: "100%" }}>
      <div style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "16px", padding: "20px", marginBottom: "24px" }}>
        <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#00D4FF", letterSpacing: "0.1em", marginBottom: "16px" }}>
          🔍 VENDOR SEARCH · PRESS ENTER TO SEARCH
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          {[
            { key: "keywords", label: "KEYWORDS", placeholder: "asian food, sushi..." },
            { key: "budget", label: "MAX BUDGET ($)", placeholder: "600" },
            { key: "guest_count", label: "GUEST COUNT", placeholder: "50" },
            { key: "min_rating", label: "MIN RATING", placeholder: "4.25" },
            { key: "location", label: "LOCATION", placeholder: "Los Angeles, CA" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>{label}</div>
              <input value={searchParams[key]} onChange={e => setSearchParams(p => ({ ...p, [key]: e.target.value }))}
                onKeyDown={handleInputKeyDown} placeholder={placeholder} disabled={loading} style={inputStyle(loading)} />
            </div>
          ))}
          <div>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>CATEGORY</div>
            <select value={searchParams.category} onChange={e => setSearchParams(p => ({ ...p, category: e.target.value }))}
              onKeyDown={handleInputKeyDown} disabled={loading} style={inputStyle(loading)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={loading ? undefined : search} disabled={loading} style={{
            flex: 1, background: loading ? "#0A0A18" : "linear-gradient(135deg, #00D4FF, #0088AA)",
            border: loading ? "1px solid #1A1A2E" : "none", borderRadius: "10px", padding: "12px",
            color: loading ? "#3A3A5A" : "white", fontFamily: "'Space Mono', monospace", fontSize: "12px",
            letterSpacing: "0.08em", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
          }}>
            {loading && <span style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid #3A3A5A", borderTopColor: "#00D4FF", display: "inline-block", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />}
            {loading ? "SEARCHING & FINDING EMAILS..." : "SEARCH VENDORS →"}
          </button>
          {loading && (
            <button onClick={cancel} style={{ background: "transparent", border: "1px solid #FF3E9A44", borderRadius: "10px", padding: "12px 18px", color: "#FF3E9A", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.08em", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FF3E9A11"; e.currentTarget.style.borderColor = "#FF3E9A88"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#FF3E9A44"; }}>
              ✕ CANCEL
            </button>
          )}
        </div>
      </div>

      {searched && summary && (
        <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em", marginBottom: "16px", display: "flex", gap: "16px" }}>
          <span style={{ color: "#5A5A7A" }}>{summary.total} VENDORS FOUND</span>
          <span style={{ color: "#A8FF3E" }}>{summary.emails_found} EMAILS FOUND</span>
          <span style={{ color: "#FF6B35" }}>RANKED BY SCORE ↑</span>
        </div>
      )}

      {searched && vendors.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {vendors.map(vendor => <VendorCard key={vendor.id} vendor={vendor} onDraftEmail={onDraftEmail} />)}
        </div>
      )}

      {!searched && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#3A3A5A" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🤝</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.1em" }}>SEARCH FOR VENDORS ABOVE</div>
          <div style={{ fontSize: "13px", color: "#2A2A4A", marginTop: "8px" }}>Type keywords and press Enter, or click Search</div>
        </div>
      )}
    </div>
  );
}

// ── Setup Panel ───────────────────────────────────────────────────────────────
function SetupPanel({ event, onSave, onClose }) {
  const [form, setForm] = useState(event);
  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const fields = [
    { key: "name", label: "Event Name", placeholder: "Sona AI Night" },
    { key: "date", label: "Date", placeholder: "May 15, 2026" },
    { key: "venue", label: "Venue Name", placeholder: "The Highlight Room" },
    { key: "neighborhood", label: "Neighborhood", placeholder: "Hollywood" },
    { key: "city", label: "City", placeholder: "Los Angeles" },
    { key: "guestCount", label: "Expected Guests", placeholder: "50" },
    { key: "budget", label: "Total Budget ($)", placeholder: "3000" },
    { key: "vibe", label: "Vibe / Theme", placeholder: "Intimate founder salon" },
    { key: "audience", label: "Target Audience", placeholder: "Asian early-stage tech founders" },
    { key: "hostName", label: "Your Name", placeholder: "Joe" },
    { key: "hostInstagram", label: "Your Instagram Handle", placeholder: "joeyeyo" },
    { key: "instagramFollowers", label: "Instagram Followers", placeholder: "900" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}>
      <div style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "20px", width: "560px", maxHeight: "85vh", overflowY: "auto", padding: "32px" }}>
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "24px", background: "linear-gradient(135deg, #FF6B35, #FF3E9A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.08em" }}>EVENT SETUP</div>
          <div style={{ fontSize: "13px", color: "#5A5A7A", marginTop: "6px", fontFamily: "'DM Sans', sans-serif" }}>Tell Sona about your event once. Every response will be tailored to your specific details.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", letterSpacing: "0.08em", marginBottom: "6px" }}>{label.toUpperCase()}</div>
              <input type="text" value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder}
                style={{ width: "100%", background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "10px 14px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <div>
            <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", letterSpacing: "0.08em", marginBottom: "6px" }}>ANYTHING ELSE SONA SHOULD KNOW</div>
            <textarea value={form.additionalContext} onChange={e => update("additionalContext", e.target.value)} placeholder="e.g. I want a DJ, no formal speeches, open bar..." rows={3}
              style={{ width: "100%", background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "10px 14px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "14px", outline: "none", resize: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
          <button onClick={() => { onSave(form); onClose(); }}
            style={{ flex: 1, background: "linear-gradient(135deg, #FF6B35, #FF3E9A)", border: "none", borderRadius: "10px", padding: "14px", color: "white", fontFamily: "'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", cursor: "pointer" }}>
            SAVE EVENT →
          </button>
          <button onClick={onClose}
            style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "10px", padding: "14px 20px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "12px", cursor: "pointer" }}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "14px 18px" }}>
      {[0, 1, 2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FF6B35", animation: "bounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />)}
    </div>
  );
}

function Message({ msg, workstreams }) {
  const ws = workstreams.find(w => w.id === msg.workstream);
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: "12px", alignItems: "flex-start", marginBottom: "24px" }}>
      {msg.role === "assistant" && (
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #FF6B35, #FF3E9A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0, marginTop: "2px" }}>S</div>
      )}
      <div style={{ maxWidth: "75%", position: "relative" }}>
        <div style={{ background: msg.role === "user" ? "#1A1A2E" : "#0F0F1A", border: msg.role === "user" ? "1px solid #2A2A4A" : `1px solid ${ws?.color || "#FF6B35"}22`, borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px", padding: "14px 18px" }}>
          {msg.workstream && msg.role === "assistant" && ws && (
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: ws.color, letterSpacing: "0.1em", marginBottom: "8px", textTransform: "uppercase" }}>{ws.icon} {ws.label}</div>
          )}
          <div style={{ fontSize: "14px", lineHeight: "1.7", color: "#E8E8F0", whiteSpace: "pre-wrap", fontFamily: "'DM Sans', sans-serif" }}>{msg.content}</div>
        </div>
        {msg.role === "assistant" && (
          <button onClick={copy} style={{ position: "absolute", bottom: "-22px", right: "4px", background: "transparent", border: "none", cursor: "pointer", fontSize: "11px", fontFamily: "'Space Mono', monospace", color: copied ? "#A8FF3E" : "#3A3A5A", letterSpacing: "0.05em", padding: "2px 6px" }}>
            {copied ? "COPIED ✓" : "COPY"}
          </button>
        )}
      </div>
    </div>
  );
}

const INITIAL_MESSAGE = (ws) => ({
  role: "assistant",
  content: `Hey — I'm Sona. This is your ${ws} workspace.\n\nSet up your event using the ✦ button, then tell me what you need.`,
  workstream: ws,
});

const DEFAULT_ALL_MESSAGES = {
  marketing: [INITIAL_MESSAGE("marketing")],
  vendors: [INITIAL_MESSAGE("vendors")],
  guests: [INITIAL_MESSAGE("guests")],
  logistics: [INITIAL_MESSAGE("logistics")],
};

const DEFAULT_ALL_HISTORY = { marketing: [], vendors: [], guests: [], logistics: [] };

export default function SonaAgent() {
  const [event, setEvent] = useState(() => {
    try { const s = localStorage.getItem("sona_event"); return s ? JSON.parse(s) : DEFAULT_EVENT; } catch { return DEFAULT_EVENT; }
  });
  const [showSetup, setShowSetup] = useState(() => {
    try { const s = localStorage.getItem("sona_event"); if (!s) return true; return !JSON.parse(s).name; } catch { return true; }
  });
  const [allMessages, setAllMessages] = useState(() => {
    try { const s = localStorage.getItem("sona_messages"); return s ? JSON.parse(s) : DEFAULT_ALL_MESSAGES; } catch { return DEFAULT_ALL_MESSAGES; }
  });
  const [allHistory, setAllHistory] = useState(() => {
    try { const s = localStorage.getItem("sona_history"); return s ? JSON.parse(s) : DEFAULT_ALL_HISTORY; } catch { return DEFAULT_ALL_HISTORY; }
  });

  const [vendorResults, setVendorResults] = useState([]);
  const [vendorSummary, setVendorSummary] = useState(null);
  const [vendorSearched, setVendorSearched] = useState(false);

  // Gmail modal state
  const [gmailModal, setGmailModal] = useState(null); // { vendor, draftContent }

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeWorkstream, setActiveWorkstream] = useState("marketing");
  const [vendorView, setVendorView] = useState("search");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const messages = allMessages[activeWorkstream];
  const history = allHistory[activeWorkstream];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { try { localStorage.setItem("sona_messages", JSON.stringify(allMessages)); } catch {} }, [allMessages]);
  useEffect(() => { try { localStorage.setItem("sona_history", JSON.stringify(allHistory)); } catch {} }, [allHistory]);

  const saveEvent = (newEvent) => {
    setEvent(newEvent);
    try { localStorage.setItem("sona_event", JSON.stringify(newEvent)); } catch {}
    const welcomeMsg = { role: "assistant", content: `Event saved! I now know everything about ${newEvent.name || "your event"}${newEvent.date ? ` on ${newEvent.date}` : ""}${newEvent.venue ? ` at ${newEvent.venue}` : ""}.\n\nEvery response from here will be tailored to your actual event. What do you need first?`, workstream: "marketing" };
    const newMessages = { ...DEFAULT_ALL_MESSAGES, marketing: [welcomeMsg] };
    setAllMessages(newMessages);
    setAllHistory(DEFAULT_ALL_HISTORY);
    try { localStorage.setItem("sona_messages", JSON.stringify(newMessages)); } catch {}
    try { localStorage.setItem("sona_history", JSON.stringify(DEFAULT_ALL_HISTORY)); } catch {}
  };

  const sendMessage = async (text, workstreamId) => {
    const ws = workstreamId || activeWorkstream;
    const currentHistory = allHistory[ws];
    const userMsg = { role: "user", content: text, workstream: ws };
    const newHistory = [...currentHistory, { role: "user", content: text }];
    setAllMessages(prev => ({ ...prev, [ws]: [...prev[ws], userMsg] }));
    setAllHistory(prev => ({ ...prev, [ws]: newHistory }));
    setInput("");
    setLoading(true);
    if (ws === "vendors") setVendorView("chat");
    const wsLabel = WORKSTREAMS.find(w => w.id === ws)?.label || "";
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(event) + `\n\nCurrent workstream: ${wsLabel}.`,
          messages: newHistory,
        }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Something went wrong.";
      const assistantMsg = { role: "assistant", content: reply, workstream: ws };
      setAllMessages(prev => ({ ...prev, [ws]: [...prev[ws], assistantMsg] }));
      setAllHistory(prev => ({ ...prev, [ws]: [...prev[ws], { role: "assistant", content: reply }] }));
    } catch {
      setAllMessages(prev => ({ ...prev, [ws]: [...prev[ws], { role: "assistant", content: "Error reaching the API.", workstream: ws }] }));
    } finally {
      setLoading(false);
    }
  };

  // When user clicks "Draft Email" on a vendor card:
  // 1. Generate draft via Claude in the chat
  // 2. Open Gmail modal with the draft pre-populated
  const handleDraftEmail = async (vendor) => {
    setVendorView("chat");
    const emailLine = vendor.email ? `Their email is ${vendor.email}.` : `No email found — use their phone ${vendor.phone}.`;
    const prompt = `Draft a professional outreach email to ${vendor.name} (located at ${vendor.address}). ${emailLine} I'm looking for catering for my event with ${event.guestCount || "50"} guests, budget under $${event.budget || "600"}. The event is ${event.name || "an AI networking night"} on ${event.date || "upcoming"}. Make it friendly, specific, and ask about their availability and pricing. Format your response as:

Subject: [subject line here]

[email body here]`;

    // Send to chat
    const ws = "vendors";
    const currentHistory = allHistory[ws];
    const userMsg = { role: "user", content: prompt, workstream: ws };
    const newHistory = [...currentHistory, { role: "user", content: prompt }];
    setAllMessages(prev => ({ ...prev, [ws]: [...prev[ws], userMsg] }));
    setAllHistory(prev => ({ ...prev, [ws]: newHistory }));
    setLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(event) + "\n\nCurrent workstream: Vendors.",
          messages: newHistory,
        }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "";
      const assistantMsg = { role: "assistant", content: reply, workstream: ws };
      setAllMessages(prev => ({ ...prev, [ws]: [...prev[ws], assistantMsg] }));
      setAllHistory(prev => ({ ...prev, [ws]: [...prev[ws], { role: "assistant", content: reply }] }));

      // Open Gmail modal with the draft
      setGmailModal({ vendor, draftContent: reply });
    } catch {
      setAllMessages(prev => ({ ...prev, [ws]: [...prev[ws], { role: "assistant", content: "Error generating draft.", workstream: ws }] }));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    const reset = { ...allMessages, [activeWorkstream]: [INITIAL_MESSAGE(activeWorkstream)] };
    const resetHistory = { ...allHistory, [activeWorkstream]: [] };
    setAllMessages(reset);
    setAllHistory(resetHistory);
    try { localStorage.setItem("sona_messages", JSON.stringify(reset)); } catch {}
    try { localStorage.setItem("sona_history", JSON.stringify(resetHistory)); } catch {}
    if (activeWorkstream === "vendors") {
      setVendorResults([]);
      setVendorSummary(null);
      setVendorSearched(false);
      setVendorView("search");
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim() && !loading) sendMessage(input.trim()); }
  };

  const eventConfigured = event.name || event.date || event.venue;
  const isVendors = activeWorkstream === "vendors";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07070F; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A2A4A; border-radius: 2px; }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-6px); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ws-btn { background: transparent; border: 1px solid #1A1A2E; border-radius: 10px; padding: 12px 14px; cursor: pointer; transition: all 0.2s ease; text-align: left; width: 100%; }
        .ws-btn:hover { border-color: #2A2A4A; background: #0F0F1A; }
        .ws-btn.active { background: #0F0F1A; }
        .template-btn { background: #0A0A18; border: 1px solid #1A1A2E; border-radius: 8px; padding: 9px 12px; cursor: pointer; transition: all 0.15s ease; text-align: left; width: 100%; color: #8888AA; font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.4; }
        .template-btn:hover { background: #12121F; border-color: #2A2A4A; color: #E8E8F0; }
        .setup-btn { background: transparent; border: 1px solid #1A1A2E; border-radius: 10px; padding: 10px 14px; cursor: pointer; transition: all 0.2s ease; text-align: left; width: 100%; }
        .setup-btn:hover { border-color: #FF6B3544; background: #0F0F1A; }
        .send-btn { background: linear-gradient(135deg, #FF6B35, #FF3E9A); border: none; border-radius: 10px; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.2s; font-size: 16px; }
        .send-btn:hover { opacity: 0.85; }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .msg-animate { animation: fadeIn 0.3s ease forwards; }
        .input-box { background: #0F0F1A; border: 1px solid #1A1A2E; border-radius: 14px; padding: 14px 14px 14px 18px; display: flex; align-items: flex-end; gap: 12px; cursor: text; }
        .clear-btn { background: transparent; border: 1px solid #1A1A2E; border-radius: 8px; padding: 8px; cursor: pointer; font-size: 11px; font-family: 'Space Mono', monospace; color: #3A3A5A; letter-spacing: 0.05em; transition: all 0.15s; width: 100%; }
        .clear-btn:hover { border-color: #FF3E9A44; color: #FF3E9A; }
        textarea, input, select { background: transparent; border: none; outline: none; color: #E8E8F0; font-family: 'DM Sans', sans-serif; font-size: 14px; resize: none; width: 100%; line-height: 1.5; }
        input::placeholder, textarea::placeholder { color: #3A3A5A; }
        select option { background: #0F0F1A; }
      `}</style>

      {showSetup && <SetupPanel event={event} onSave={saveEvent} onClose={() => setShowSetup(false)} />}
      {gmailModal && <GmailModal vendor={gmailModal.vendor} draftContent={gmailModal.draftContent} onClose={() => setGmailModal(null)} />}

      <div style={{ display: "flex", height: "100vh", background: "#07070F", fontFamily: "'DM Sans', sans-serif" }}>
        {/* Sidebar */}
        <div style={{ width: "260px", flexShrink: 0, borderRight: "1px solid #0F0F1A", display: "flex", flexDirection: "column", padding: "24px 16px", gap: "8px", overflowY: "auto" }}>
          <div style={{ marginBottom: "20px", paddingLeft: "4px" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "42px", letterSpacing: "0.12em", background: "linear-gradient(135deg, #FF6B35, #FF3E9A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1, filter: "drop-shadow(0 0 20px #FF6B3566)" }}>SONA</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "#FF6B3566", letterSpacing: "0.2em", marginTop: "4px" }}>EVENT INTELLIGENCE</div>
          </div>

          <button className="setup-btn" onClick={() => setShowSetup(true)} style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", letterSpacing: "0.1em", marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
              <span>ACTIVE EVENT</span><span style={{ color: "#FF6B35" }}>✦ EDIT</span>
            </div>
            {eventConfigured ? (
              <>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#E8E8F0", lineHeight: 1.3 }}>{event.name || "Untitled Event"}</div>
                <div style={{ fontSize: "11px", color: "#5A5A7A", marginTop: "4px" }}>{[event.date, event.venue, event.guestCount ? `${event.guestCount} guests` : null].filter(Boolean).join(" · ")}</div>
              </>
            ) : <div style={{ fontSize: "13px", color: "#FF6B35" }}>+ Set up your event</div>}
          </button>

          <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", letterSpacing: "0.1em", marginBottom: "6px", paddingLeft: "4px" }}>WORKSTREAMS</div>

          {WORKSTREAMS.map(ws => (
            <button key={ws.id} className={`ws-btn ${activeWorkstream === ws.id ? "active" : ""}`}
              onClick={() => setActiveWorkstream(ws.id)}
              style={{ borderColor: activeWorkstream === ws.id ? ws.color + "44" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{ws.icon}</span>
                <div style={{ fontSize: "13px", fontWeight: 500, color: activeWorkstream === ws.id ? ws.color : "#8888AA", transition: "color 0.2s" }}>{ws.label}</div>
              </div>
            </button>
          ))}

          {(() => {
            const ws = WORKSTREAMS.find(w => w.id === activeWorkstream);
            return ws ? (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", letterSpacing: "0.1em", marginBottom: "8px", paddingLeft: "4px" }}>QUICK PROMPTS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {ws.templates.map((t, i) => <button key={i} className="template-btn" onClick={() => sendMessage(t, ws.id)} disabled={loading}>{t}</button>)}
                </div>
              </div>
            ) : null;
          })()}

          <button className="clear-btn" onClick={handleClear} style={{ marginTop: "auto" }}>
            RESET {activeWorkstream.toUpperCase()} ↺
          </button>
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "16px 28px", borderBottom: "1px solid #0F0F1A", display: "flex", alignItems: "center", gap: "12px" }}>
            {(() => {
              const ws = WORKSTREAMS.find(w => w.id === activeWorkstream);
              return ws ? (
                <>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ws.color, boxShadow: `0 0 8px ${ws.color}` }} />
                  <span style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace", color: ws.color, letterSpacing: "0.08em" }}>{ws.label.toUpperCase()}</span>
                  <span style={{ color: "#2A2A4A" }}>·</span>
                  <span style={{ fontSize: "13px", color: "#5A5A7A" }}>
                    {ws.id === "marketing" && "Instagram, DMs, event copy"}
                    {ws.id === "vendors" && "Find & contact vendors"}
                    {ws.id === "guests" && "Invitations, RSVPs, reminders"}
                    {ws.id === "logistics" && "Timelines, checklists, run-of-show"}
                  </span>
                  {isVendors && (
                    <div style={{ marginLeft: "auto", display: "flex", gap: "4px", background: "#0F0F1A", borderRadius: "8px", padding: "4px" }}>
                      {["search", "chat"].map(v => (
                        <button key={v} onClick={() => setVendorView(v)}
                          style={{ padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", background: vendorView === v ? "#00D4FF22" : "transparent", color: vendorView === v ? "#00D4FF" : "#5A5A7A", transition: "all 0.15s" }}>
                          {v.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isVendors && eventConfigured && (
                    <>
                      <span style={{ color: "#2A2A4A", marginLeft: "auto" }}>·</span>
                      <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A" }}>{event.name}</span>
                    </>
                  )}
                </>
              ) : null;
            })()}
          </div>

          {isVendors && vendorView === "search" ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <VendorSearchPanel
                event={event} onDraftEmail={handleDraftEmail}
                vendors={vendorResults} setVendors={setVendorResults}
                summary={vendorSummary} setSummary={setVendorSummary}
                searched={vendorSearched} setSearched={setVendorSearched}
              />
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "28px" }}>
                {messages.map((msg, i) => <div key={i} className="msg-animate"><Message msg={msg} workstreams={WORKSTREAMS} /></div>)}
                {loading && (
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "24px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #FF6B35, #FF3E9A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>S</div>
                    <div style={{ background: "#0F0F1A", border: "1px solid #FF6B3522", borderRadius: "4px 18px 18px 18px" }}><TypingIndicator /></div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #0F0F1A" }}>
                <div className="input-box" onClick={() => textareaRef.current?.focus()}>
                  <textarea ref={textareaRef} rows={1} value={input}
                    onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                    onKeyDown={handleKey}
                    placeholder={`Ask Sona about ${WORKSTREAMS.find(w => w.id === activeWorkstream)?.label.toLowerCase()}...`}
                    style={{ maxHeight: "120px", alignSelf: "stretch" }} />
                  <button className="send-btn" onClick={() => input.trim() && !loading && sendMessage(input.trim())} disabled={!input.trim() || loading}>↑</button>
                </div>
                <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#2A2A4A", textAlign: "center", marginTop: "10px", letterSpacing: "0.05em" }}>
                  SHIFT+ENTER FOR NEW LINE · ENTER TO SEND
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
