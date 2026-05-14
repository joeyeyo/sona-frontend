import { useState, useRef, useEffect } from "react";

const RAILWAY_URL = "https://sona-production-529e.up.railway.app";
const OPENCLAW_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' ? '/openclaw' : 'http://127.0.0.1:18789';
const OPENCLAW_TOKEN = import.meta.env.VITE_OPENCLAW_TOKEN || "";

const LINKEDIN_SCRAPE_PROMPT = (linkedin_url) => `Use your browser tools (NOT web fetch or web search) to open ${linkedin_url} in Chrome. You must use the browser relay/CDP to control the actual Chrome browser. Once the page is loaded in Chrome:
1. Scroll down 10 times to lazy-load all sections
2. Click every button that says "Show all experiences", "Show all education", "Show more", "See all skills"
3. Take a snapshot after each scroll to verify content is loading
4. Extract ALL visible text content for experiences, education, and skills

Return ONLY a JSON object with these exact fields:
{
  "full_name": "string",
  "headline": "string", 
  "current_role": "string",
  "current_company": "string",
  "location": "string",
  "summary": "string or null",
  "experiences": [{"title": "string", "company": "string", "dates": "string", "duration": "string", "description": "string or null"}],
  "education": [{"school": "string", "degree": "string or null", "field": "string or null", "description": "string or null"}],
  "skills": ["string"],
  "publications": ["string"],
  "connection_count": null
}
Return ONLY the JSON object, no explanation, no markdown backticks.`;

const WORKSTREAMS = [
  { id: "dashboard", label: "Dashboard", icon: "📊", color: "#A8FF3E" },
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
  { id: "guests", label: "Guests", icon: "👥", color: "#FF6B35" },
  { id: "matches", label: "Matches", icon: "🤜🤛", color: "#B388FF" },
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

const BUDGET_CATS = [
  { id: "food", label: "Food & Catering", pct: 35, on: true, market: { low: 8, mid: 15, high: 30 }, unit: "/guest", hints: { low: "Below market — consider food truck or buffet.", ok: "Solid catering budget for LA.", high: "Premium plated dinner range." } },
  { id: "venue", label: "Venue", pct: 30, on: true, market: { low: 500, mid: 1500, high: 5000 }, unit: "flat", hints: { low: "Tight for 50 guests in LA.", ok: "Good range for mid-tier LA venues.", high: "Premium venue territory." } },
  { id: "photo", label: "Photography & Video", pct: 15, on: true, market: { low: 500, mid: 1200, high: 3000 }, unit: "flat", hints: { low: "Below typical LA photographer rates.", ok: "Good for a solid photographer.", high: "Photo + video package range." } },
  { id: "music", label: "Music & DJ", pct: 12, on: true, market: { low: 400, mid: 800, high: 2000 }, unit: "flat", hints: { low: "Consider a curated playlist instead.", ok: "Good for a mid-tier DJ.", high: "Premium DJ or live music." } },
  { id: "decor", label: "Decor & Florals", pct: 5, on: true, market: { low: 200, mid: 600, high: 2000 }, unit: "flat", hints: { low: "Minimal — focus on lighting.", ok: "Nice florals + ambient lighting.", high: "Full floral setup." } },
  { id: "marketing", label: "Marketing & Invites", pct: 3, on: true, market: { low: 0, mid: 100, high: 500 }, unit: "flat", hints: { low: "Organic only — Instagram + word of mouth.", ok: "Covers printed materials + small ads.", high: "Paid social + design assets." } },
];

const EVENT_TYPE_PRESETS = {
  networking: [35, 30, 15, 12, 5, 3],
  party: [25, 35, 10, 20, 8, 2],
  dinner: [45, 30, 10, 5, 8, 2],
  conference: [20, 40, 15, 5, 5, 15],
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

Generate ready-to-use content. Be specific, use actual event details. Write like a founder, not a marketer.`;
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ event, sentVendorIds }) {
  const [budget, setBudget] = useState(parseInt(event.budget) || 3000);
  const [guests, setGuests] = useState(parseInt(event.guestCount) || 50);
  const [eventType, setEventType] = useState("networking");
  const [cats, setCats] = useState(BUDGET_CATS.map(c => ({ ...c })));

  useEffect(() => {
    if (event.budget) setBudget(parseInt(event.budget) || 3000);
    if (event.guestCount) setGuests(parseInt(event.guestCount) || 50);
  }, [event.budget, event.guestCount]);

  const activeCats = cats.filter(c => c.on);
  const totalPct = activeCats.reduce((s, c) => s + c.pct, 0);
  const allocated = Math.round(budget * totalPct / 100);
  const remaining = budget - allocated;
  const isOver = remaining < 0;

  const daysUntil = (() => {
    if (!event.date) return null;
    const parts = event.date.match(/(\w+)\s+(\d+),?\s+(\d{4})/);
    if (!parts) return null;
    const target = new Date(`${parts[1]} ${parts[2]}, ${parts[3]}`);
    const diff = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  })();

  const progress = [
    { label: "Event configured", done: !!(event.name && event.date && event.venue) },
    { label: "Vendors searched", done: false },
    { label: `Vendors emailed (${sentVendorIds.size})`, done: sentVendorIds.size > 0 },
    { label: "Guests invited", done: false },
    { label: "Venue confirmed", done: false },
    { label: "Catering confirmed", done: false },
  ];
  const doneCount = progress.filter(p => p.done).length;
  const progressPct = Math.round((doneCount / progress.length) * 100);

  function getBadge(cat, dollarAmt) {
    const perUnit = cat.unit === "/guest" ? dollarAmt / guests : dollarAmt;
    if (perUnit < cat.market.low) return ["warning", "Below market"];
    if (perUnit > cat.market.high) return ["danger", "Above market"];
    return ["success", "Market rate"];
  }

  function toggleCat(id) { setCats(prev => prev.map(c => c.id === id ? { ...c, on: !c.on } : c)); }
  function setPct(id, pct) { setCats(prev => prev.map(c => c.id === id ? { ...c, pct } : c)); }
  function applyPreset(type) {
    setEventType(type);
    const presets = EVENT_TYPE_PRESETS[type];
    setCats(prev => prev.map((c, i) => ({ ...c, pct: presets[i], on: true })));
  }

  const inputStyle = { background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "8px 12px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", outline: "none" };
  const badgeColors = {
    success: { bg: "#A8FF3E18", border: "#A8FF3E44", text: "#A8FF3E" },
    warning: { bg: "#FFB80018", border: "#FFB80044", text: "#FFB800" },
    danger: { bg: "#FF3E9A18", border: "#FF3E9A44", text: "#FF3E9A" },
  };

  return (
    <div style={{ padding: "28px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Days Until Event", value: daysUntil !== null ? daysUntil : "—", sub: daysUntil !== null ? (daysUntil <= 7 ? "This week!" : daysUntil <= 30 ? "Coming up soon" : "Plenty of time") : "Set event date", color: daysUntil !== null && daysUntil <= 14 ? "#FF3E9A" : "#A8FF3E" },
          { label: "Total Budget", value: `$${budget.toLocaleString()}`, sub: `$${Math.round(budget / (parseInt(event.guestCount) || 50))}/guest`, color: "#00D4FF" },
          { label: "Allocated", value: `$${allocated.toLocaleString()}`, sub: isOver ? "Over budget!" : `$${remaining.toLocaleString()} remaining`, color: isOver ? "#FF3E9A" : "#A8FF3E" },
          { label: "Planning Progress", value: `${progressPct}%`, sub: `${doneCount} of ${progress.length} tasks done`, color: progressPct === 100 ? "#A8FF3E" : "#FF6B35" },
        ].map((stat, i) => (
          <div key={i} style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", letterSpacing: "0.1em", marginBottom: "8px" }}>{stat.label.toUpperCase()}</div>
            <div style={{ fontSize: "24px", fontWeight: 600, color: stat.color, marginBottom: "4px", fontFamily: "'Space Mono', monospace" }}>{stat.value}</div>
            <div style={{ fontSize: "11px", color: "#5A5A7A" }}>{stat.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px", alignItems: "start" }}>
        <div style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "16px", padding: "20px" }}>
          <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E", letterSpacing: "0.1em", marginBottom: "16px" }}>💰 BUDGET PLANNER</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
            <div>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>TOTAL BUDGET ($)</div>
              <input type="number" value={budget} onChange={e => setBudget(parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>GUEST COUNT</div>
              <input type="number" value={guests} onChange={e => setGuests(parseInt(e.target.value) || 1)} style={{ ...inputStyle, width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>EVENT TYPE</div>
              <select value={eventType} onChange={e => applyPreset(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
                <option value="networking">Networking</option>
                <option value="party">Party</option>
                <option value="dinner">Dinner</option>
                <option value="conference">Conference</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {cats.map(cat => {
              const dollarAmt = Math.round(budget * cat.pct / 100);
              const perGuest = Math.round(dollarAmt / guests);
              const [badgeType, badgeText] = getBadge(cat, dollarAmt);
              const bc = badgeColors[badgeType];
              const hint = cat.on ? (dollarAmt / (cat.unit === "/guest" ? guests : 1) < cat.market.low ? cat.hints.low : dollarAmt / (cat.unit === "/guest" ? guests : 1) > cat.market.high ? cat.hints.high : cat.hints.ok) : null;
              return (
                <div key={cat.id} style={{ background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "12px", padding: "14px", opacity: cat.on ? 1 : 0.45, transition: "opacity 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: cat.on ? "10px" : 0 }}>
                    <div onClick={() => toggleCat(cat.id)} style={{ width: "36px", height: "20px", borderRadius: "10px", background: cat.on ? "#1D9E75" : "#2A2A4A", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                      <div style={{ position: "absolute", top: "3px", left: cat.on ? "19px" : "3px", width: "14px", height: "14px", borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#E8E8F0", flex: 1 }}>{cat.label}</span>
                    <span style={{ fontSize: "12px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace" }}>{cat.pct}%</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#E8E8F0", fontFamily: "'Space Mono', monospace", minWidth: "70px", textAlign: "right" }}>${dollarAmt.toLocaleString()}</span>
                    <span style={{ fontSize: "11px", color: "#5A5A7A", minWidth: "60px", textAlign: "right" }}>${perGuest}/guest</span>
                    {cat.on && <div style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "6px", background: bc.bg, border: `1px solid ${bc.border}`, color: bc.text, fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>{badgeText}</div>}
                  </div>
                  {cat.on && (<><input type="range" min="1" max="80" step="1" value={cat.pct} onChange={e => setPct(cat.id, parseInt(e.target.value))} style={{ width: "100%", marginBottom: "6px" }} /><div style={{ fontSize: "11px", color: "#5A5A7A", fontStyle: "italic" }}>{hint}</div></>)}
                </div>
              );
            })}
          </div>
          {isOver && <div style={{ marginTop: "12px", background: "#FF3E9A11", border: "1px solid #FF3E9A33", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#FF3E9A", fontFamily: "'Space Mono', monospace" }}>⚠ OVER BUDGET BY ${Math.abs(remaining).toLocaleString()}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FF6B35", letterSpacing: "0.1em", marginBottom: "16px" }}>✓ PLANNING CHECKLIST</div>
            <div style={{ height: "4px", background: "#1A1A2E", borderRadius: "2px", marginBottom: "16px" }}>
              <div style={{ height: "100%", borderRadius: "2px", background: "linear-gradient(90deg, #FF6B35, #A8FF3E)", width: `${progressPct}%`, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {progress.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: item.done ? "#A8FF3E" : "#1A1A2E", border: item.done ? "none" : "1px solid #2A2A4A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {item.done && <span style={{ fontSize: "10px", color: "#07070F", fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: "12px", color: item.done ? "#E8E8F0" : "#5A5A7A" }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#00D4FF", letterSpacing: "0.1em", marginBottom: "16px" }}>📊 BUDGET BREAKDOWN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {cats.filter(c => c.on).map((cat, i) => {
                const colors = ["#FF6B35", "#00D4FF", "#A8FF3E", "#FF3E9A", "#FFB800", "#B388FF"];
                const color = colors[i % colors.length];
                const dollarAmt = Math.round(budget * cat.pct / 100);
                const widthPct = Math.min((cat.pct / 50) * 100, 100);
                return (
                  <div key={cat.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", color: "#8888AA" }}>{cat.label}</span>
                      <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#E8E8F0" }}>${dollarAmt.toLocaleString()}</span>
                    </div>
                    <div style={{ height: "4px", background: "#1A1A2E", borderRadius: "2px" }}>
                      <div style={{ height: "100%", borderRadius: "2px", background: color, width: `${widthPct}%`, transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Guests Tab ────────────────────────────────────────────────────────────────
function GuestsTab() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrapingFor, setScrapingFor] = useState(null);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [scrapeStatus, setScrapeStatus] = useState({});
  const [pasteModal, setPasteModal] = useState(null); // { guest }
  const [relayModal, setRelayModal] = useState(null); // { guest }
  const [jsonImportModal, setJsonImportModal] = useState(null); // { guest }
  const [jsonImportText, setJsonImportText] = useState("");
  const [jsonImportError, setJsonImportError] = useState("");
  const [jsonImporting, setJsonImporting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [addGuestModal, setAddGuestModal] = useState(false);
  const [addGuestForm, setAddGuestForm] = useState({ phone: "", name: "", linkedin_url: "", what_they_do: "", who_they_want_to_meet: "", interests: "", linkedin_json: "" });
  const [addGuestError, setAddGuestError] = useState("");
  const [addGuestSaving, setAddGuestSaving] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null); // phone of guest being edited
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [guestScores, setGuestScores] = useState({});
  const [overrideModal, setOverrideModal] = useState(null); // {phone, name, dimension, scoreBefore}
  const [overrideValue, setOverrideValue] = useState(50);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideCategory, setOverrideCategory] = useState("other");
  const [overrideSaving, setOverrideSaving] = useState(false);

  useEffect(() => { fetchGuests(); fetchGuestScores(); }, []);

  async function fetchGuests() {
    setLoading(true);
    try {
      const resp = await fetch(`${RAILWAY_URL}/guests`);
      const data = await resp.json();
      setGuests(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function scrapeGuest(guest) {
    if (!guest.linkedin_url) return;
    // Show relay setup modal first — user must attach relay before scraping
    setRelayModal(guest);
  }

  async function runOpenClawScrape(guest) {
    setScrapeStatus(s => ({ ...s, [guest.id]: "scraping" }));
    setRelayModal(null);

    // Try OpenClaw browser agent first
    if (OPENCLAW_TOKEN) {
      try {
        console.log("[scrape] Trying OpenClaw for", guest.linkedin_url);
        const resp = await fetch(`${OPENCLAW_URL}/v1/responses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENCLAW_TOKEN}`,
            "x-openclaw-agent-id": "main",
          },
          body: JSON.stringify({
            model: "openclaw",
            input: LINKEDIN_SCRAPE_PROMPT(guest.linkedin_url),
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const text = data.output?.[0]?.content?.[0]?.text || "";
          console.log("[scrape] OpenClaw FULL text:", text);

          let profileJson = null;
          try {
            const clean = text.replace(/```json|```/g, "").trim();
            // Find JSON object in response
            const match = clean.match(/\{[\s\S]+\}/);
            if (match) profileJson = JSON.parse(match[0]);
          } catch (e) {
            console.log("[scrape] JSON parse error:", e.message);
          }

          if (profileJson && profileJson.full_name) {
            // Save to Supabase via Railway
            const patchResp = await fetch(`${RAILWAY_URL}/guests/${encodeURIComponent(guest.phone)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                linkedin_data: profileJson,
                name: profileJson.full_name,
              }),
            });

            if (patchResp.ok) {
              setScrapeStatus(s => ({ ...s, [guest.id]: "done" }));
              setGuests(prev => prev.map(g => g.id === guest.id ? {
                ...g, linkedin_data: profileJson, name: profileJson.full_name,
              } : g));
              console.log("[scrape] OpenClaw success:", profileJson.full_name);
              return;
            }
          }

          // OpenClaw returned something but no usable profile
          // Check if it needs browser relay to be attached
          if (text.includes("relay") || text.includes("attach") || text.includes("toolbar")) {
            setScrapeStatus(s => ({ ...s, [guest.id]: "relay" }));
            return;
          }
        }
      } catch (e) {
        console.log("[scrape] OpenClaw error:", e.message);
      }
    }

    // Fall back to paste modal
    setScrapeStatus(s => ({ ...s, [guest.id]: undefined }));
    window.open(guest.linkedin_url, "_blank");
    setPasteText("");
    setPasteModal(guest);
  }

  async function openRelayAndScrape(guest) {
    // Don't open tab — OpenClaw will navigate there itself
    // Nothing to do here
  }

  async function fetchGuestScores() {
    try {
      const resp = await fetch(`${RAILWAY_URL}/guests/scores`);
      if (resp.ok) {
        const data = await resp.json();
        const map = {};
        data.forEach(s => { map[s.phone] = s; });
        setGuestScores(map);
      }
    } catch(e) { console.error(e); }
  }

  async function scoreGuest(phone) {
    await fetch(`${RAILWAY_URL}/guests/score/${encodeURIComponent(phone)}`, { method: "POST" });
    await fetchGuestScores();
  }

  async function saveOverride() {
    if (!overrideModal || overrideSaving) return;
    setOverrideSaving(true);
    try {
      await fetch(`${RAILWAY_URL}/scoring/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: overrideModal.phone,
          guest_name: overrideModal.name,
          dimension: overrideModal.dimension,
          score_before: overrideModal.scoreBefore,
          score_after: overrideValue,
          reason: overrideReason,
          reason_category: overrideCategory,
        }),
      });
      setGuestScores(prev => ({
        ...prev,
        [overrideModal.phone]: {
          ...(prev[overrideModal.phone] || {}),
          [overrideModal.dimension]: overrideValue,
        }
      }));
      setOverrideModal(null);
      setOverrideReason("");
    } catch(e) { console.error(e); }
    setOverrideSaving(false);
  }

  async function addGuest() {
    if (!addGuestForm.phone.trim()) { setAddGuestError("Phone number is required"); return; }
    setAddGuestSaving(true);
    setAddGuestError("");
    try {
      const phone = addGuestForm.phone.trim().startsWith("whatsapp:")
        ? addGuestForm.phone.trim()
        : `whatsapp:${addGuestForm.phone.trim()}`;

      // Parse LinkedIn JSON if provided
      let linkedin_data = null;
      if (addGuestForm.linkedin_json.trim()) {
        try {
          const clean = addGuestForm.linkedin_json.replace(/```json|```/g, "").trim();
          const match = clean.match(/\{[\s\S]+\}/);
          linkedin_data = JSON.parse(match ? match[0] : clean);
        } catch {
          setAddGuestError("Invalid LinkedIn JSON — check the format");
          setAddGuestSaving(false);
          return;
        }
      }

      const payload = {
        phone,
        ...(addGuestForm.name.trim() && { name: addGuestForm.name.trim() }),
        ...(addGuestForm.linkedin_url.trim() && { linkedin_url: addGuestForm.linkedin_url.trim() }),
        ...(addGuestForm.what_they_do.trim() && { what_they_do: addGuestForm.what_they_do.trim() }),
        ...(addGuestForm.who_they_want_to_meet.trim() && { who_they_want_to_meet: addGuestForm.who_they_want_to_meet.trim() }),
        ...(addGuestForm.interests.trim() && { interests: addGuestForm.interests.trim() }),
        ...(linkedin_data && { linkedin_data }),
        rsvp_status: "confirmed",
        onboarding_complete: true,
      };

      const resp = await fetch(`${RAILWAY_URL}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        await fetchGuests();
        setAddGuestModal(false);
        setAddGuestForm({ phone: "", name: "", linkedin_url: "", what_they_do: "", who_they_want_to_meet: "", interests: "", linkedin_json: "" });
      } else {
        const err = await resp.json();
        setAddGuestError(err.error || "Failed to add guest");
      }
    } catch (e) {
      setAddGuestError("Error: " + e.message);
    } finally {
      setAddGuestSaving(false);
    }
  }

  async function parseAndSave() {
    if (!pasteText.trim() || !pasteModal) return;
    setParsing(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages: [{ role: "user", content: `Parse this LinkedIn profile text and return ONLY a JSON object:\n\nLINKEDIN TEXT:\n${pasteText.slice(0, 8000)}\n\nJSON fields: full_name, headline, current_role, current_company, location, summary (2-3 sentences), experiences (array of {title,company,duration}), education (array of {school,degree}), skills (array), connection_count (null). Return ONLY the JSON.` }] }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      let profileJson = null;
      try { profileJson = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { const m = text.match(/\{[\s\S]+\}/); if (m) try { profileJson = JSON.parse(m[0]); } catch {} }
      if (profileJson) {
        const patchResp = await fetch(`${RAILWAY_URL}/guests/${encodeURIComponent(pasteModal.phone)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linkedin_data: profileJson, name: profileJson.full_name || pasteModal.name }) });
        if (patchResp.ok) { setScrapeStatus(s => ({ ...s, [pasteModal.id]: "done" })); setGuests(prev => prev.map(g => g.id === pasteModal.id ? { ...g, linkedin_data: profileJson, name: profileJson.full_name || g.name } : g)); setPasteModal(null); setPasteText(""); }
        else alert("Failed to save to database.");
      } else alert("Could not parse profile — try selecting more text.");
    } catch (e) { alert("Error: " + e.message); }
    finally { setParsing(false); }
  }



  const rsvpColors = {
    confirmed: { bg: "#A8FF3E18", border: "#A8FF3E44", text: "#A8FF3E" },
    declined: { bg: "#FF3E9A18", border: "#FF3E9A44", text: "#FF3E9A" },
    pending: { bg: "#FFB80018", border: "#FFB80044", text: "#FFB800" },
  };

  const totalGuests = guests.length;
  const confirmed = guests.filter(g => g.rsvp_status === "confirmed").length;
  const pending = guests.filter(g => g.rsvp_status === "pending").length;
  const scraped = guests.filter(g => g.linkedin_data && !g.linkedin_data.error).length;

  return (
    <div style={{ padding: "28px", overflowY: "auto", height: "100%" }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Total Guests", value: totalGuests, color: "#00D4FF" },
          { label: "Confirmed", value: confirmed, color: "#A8FF3E" },
          { label: "Pending", value: pending, color: "#FFB800" },
          { label: "LinkedIn Scraped", value: `${scraped}/${totalGuests}`, color: scraped === totalGuests && totalGuests > 0 ? "#A8FF3E" : "#FF6B35" },
        ].map((stat, i) => (
          <div key={i} style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", letterSpacing: "0.1em", marginBottom: "8px" }}>{stat.label.toUpperCase()}</div>
            <div style={{ fontSize: "28px", fontWeight: 600, color: stat.color, fontFamily: "'Space Mono', monospace" }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", letterSpacing: "0.1em" }}>
          👥 GUEST LIST — CLICK ROW TO VIEW PROFILE
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => { setAddGuestError(""); setAddGuestModal(true); }} style={{ background: "linear-gradient(135deg, #A8FF3E22, #A8FF3E11)", border: "1px solid #A8FF3E44", borderRadius: "8px", padding: "6px 14px", color: "#A8FF3E", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer" }}>+ ADD GUEST</button>
          <button onClick={fetchGuests} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "6px 14px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer" }}>
          ↺ REFRESH
          21ba REFRESH
        </button>
        </div>
      </div>

      {/* Guest table */}
      <div style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "16px", overflow: "hidden" }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 2fr 1fr 1fr 60px 130px 80px", gap: "0", padding: "12px 20px", borderBottom: "1px solid #1A1A2E", background: "#07070F" }}>
          {["NAME / PHONE", "LINKEDIN", "WHAT THEY DO", "MEET", "RSVP", "AGE", "IMPORT", ""].map(h => (
            <div key={h} style={{ fontSize: "9px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", letterSpacing: "0.12em" }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#3A3A5A", fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>
            LOADING GUESTS...
          </div>
        ) : guests.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>👥</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "#3A3A5A", marginBottom: "8px" }}>NO GUESTS YET</div>
            <div style={{ fontSize: "13px", color: "#5A5A7A" }}>Send the Sona WhatsApp link to start onboarding guests</div>
          </div>
        ) : (
          guests.map((guest, idx) => {
            const hasLinkedIn = !!guest.linkedin_url;
            const hasData = !!guest.linkedin_data && !guest.linkedin_data.error;
            const status = scrapeStatus[guest.id];
            const isScrapingThis = status === "scraping";
            const rsvp = guest.rsvp_status || "pending";
            const rc = rsvpColors[rsvp] || rsvpColors.pending;
            const phone = guest.phone?.replace("whatsapp:", "") || "—";
            const ld = guest.linkedin_data;

            return (
              <div
                key={guest.id}
                onClick={() => setSelectedGuest(guest)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.5fr 2fr 1fr 1fr 60px 130px 80px",
                  gap: "0",
                  padding: "14px 20px",
                  borderBottom: idx < guests.length - 1 ? "1px solid #0F0F1A" : "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  alignItems: "center",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#0F0F1A"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Name / Phone */}
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#E8E8F0", marginBottom: "2px" }}>
                    {ld?.full_name || guest.name || "Unknown"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace" }}>{phone}</div>
                </div>

                {/* LinkedIn */}
                <div>
                  {hasLinkedIn ? (
                    <a
                      href={guest.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: "11px", color: "#00D4FF", textDecoration: "none", fontFamily: "'Space Mono', monospace" }}
                    >
                      {guest.linkedin_url.replace("https://", "").replace("www.", "").split("/").slice(0, 3).join("/")}
                    </a>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#3A3A5A" }}>—</span>
                  )}
                </div>

                {/* What they do */}
                <div style={{ fontSize: "12px", color: "#8888AA", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {ld?.summary || guest.what_they_do || <span style={{ color: "#3A3A5A" }}>—</span>}
                </div>

                {/* Who to meet */}
                <div style={{ fontSize: "11px", color: "#8888AA" }}>
                  {guest.who_they_want_to_meet ? guest.who_they_want_to_meet.slice(0, 30) + (guest.who_they_want_to_meet.length > 30 ? "..." : "") : <span style={{ color: "#3A3A5A" }}>—</span>}
                </div>

                {/* RSVP */}
                <div>
                  <div style={{ display: "inline-block", fontSize: "10px", fontFamily: "'Space Mono', monospace", padding: "3px 8px", borderRadius: "6px", background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text }}>
                    {rsvp.toUpperCase()}
                  </div>
                </div>

                {/* Age cell */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  {guest.age ? (
                    <span style={{ fontSize: "12px", color: guest.age_estimated ? "#FFB800" : "#E8E8F0", fontFamily: "'Space Mono', monospace" }}
                      title={guest.age_estimated ? "Estimated from LinkedIn" : "Confirmed age"}>
                      {guest.age}{guest.age_estimated ? "~" : ""}
                    </span>
                  ) : (
                    <span style={{ fontSize: "10px", color: "#3A3A5A" }}>—</span>
                  )}
                </div>

                {/* Import JSON button */}
                <div onClick={e => e.stopPropagation()}>
                  {!hasLinkedIn ? (
                    <div style={{ fontSize: "10px", color: "#3A3A5A", fontFamily: "'Space Mono', monospace" }}>NO URL</div>
                  ) : hasData ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E", background: "#A8FF3E11", border: "1px solid #A8FF3E33", borderRadius: "6px", padding: "3px 8px" }}>✓ IMPORTED</div>
                      <button
                        onClick={() => { setJsonImportText(""); setJsonImportError(""); setJsonImportModal(guest); }}
                        style={{ background: "transparent", border: "1px solid #2A2A4A", borderRadius: "6px", padding: "3px 6px", color: "#3A3A5A", fontFamily: "'Space Mono', monospace", fontSize: "9px", cursor: "pointer" }}
                      >↺</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setJsonImportText(""); setJsonImportError(""); setJsonImportModal(guest); }}
                      style={{
                        background: "linear-gradient(135deg, #A8FF3E22, #A8FF3E11)",
                        border: "1px solid #A8FF3E44",
                        borderRadius: "8px", padding: "6px 12px",
                        color: "#A8FF3E",
                        fontFamily: "'Space Mono', monospace", fontSize: "10px",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
                      }}
                    >
                      📋 IMPORT JSON
                    </button>
                  )}
                </div>

                {/* LinkedIn link */}
                <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center" }}>
                  {hasLinkedIn ? (
                    <a
                      href={guest.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#00D4FF", textDecoration: "none", padding: "4px 8px", border: "1px solid #00D4FF33", borderRadius: "6px", whiteSpace: "nowrap" }}
                    >
                      LI ↗
                    </a>
                  ) : (
                    <span style={{ fontSize: "10px", color: "#3A3A5A" }}>—</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Guest profile modal */}
      {selectedGuest && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(12px)" }}
          onClick={() => setSelectedGuest(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "20px", width: "560px", maxHeight: "80vh", overflowY: "auto", padding: "28px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FF6B35", letterSpacing: "0.1em", marginBottom: "6px" }}>GUEST PROFILE</div>
                {editingGuest === selectedGuest.phone ? (
                  <input value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name" style={{ background: "#0F0F1A", border: "1px solid #A8FF3E44", borderRadius: "8px", padding: "6px 10px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "18px", fontWeight: 600, outline: "none", width: "100%" }} />
                ) : (
                  <div style={{ fontSize: "20px", fontWeight: 600, color: "#E8E8F0" }}>
                    {selectedGuest.linkedin_data?.full_name || selectedGuest.name || "Unknown Guest"}
                  </div>
                )}
                {selectedGuest.linkedin_data?.headline && (
                  <div style={{ fontSize: "13px", color: "#8888AA", marginTop: "4px" }}>{selectedGuest.linkedin_data.headline}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", marginLeft: "12px" }}>
                {editingGuest === selectedGuest.phone ? (
                  <>
                    <button
                      onClick={async () => {
                        setEditSaving(true);
                        try {
                          const resp = await fetch(`${RAILWAY_URL}/guests/${encodeURIComponent(selectedGuest.phone)}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({...editForm, age: editForm.age ? parseInt(editForm.age) : null}),
                          });
                          if (resp.ok) {
                            const updated = { ...selectedGuest, ...editForm };
                            setGuests(prev => prev.map(g => g.phone === selectedGuest.phone ? updated : g));
                            setSelectedGuest(updated);
                            setEditingGuest(null);
                          }
                        } catch(e) { console.error(e); }
                        setEditSaving(false);
                      }}
                      disabled={editSaving}
                      style={{ background: "linear-gradient(135deg,#A8FF3E,#4ADE80)", border: "none", borderRadius: "8px", padding: "6px 14px", color: "#07070F", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer" }}
                    >{editSaving ? "SAVING..." : "✓ SAVE"}</button>
                    <button onClick={() => setEditingGuest(null)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "6px 10px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer" }}>CANCEL</button>
                  </>
                ) : (
                  <button
                    onClick={() => { setEditingGuest(selectedGuest.phone); setEditForm({ name: selectedGuest.name || selectedGuest.linkedin_data?.full_name || "", linkedin_url: selectedGuest.linkedin_url || "", what_they_do: selectedGuest.what_they_do || "", who_they_want_to_meet: selectedGuest.who_they_want_to_meet || "", interests: selectedGuest.interests || "", age: selectedGuest.age || "" }); }}
                    style={{ background: "transparent", border: "1px solid #2A2A4A", borderRadius: "8px", padding: "6px 12px", color: "#8888AA", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer" }}
                  >✏ EDIT</button>
                )}
                <button onClick={() => { setSelectedGuest(null); setEditingGuest(null); }} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", width: "32px", height: "32px", color: "#5A5A7A", cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>
            </div>

            {/* Basic info — editable */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "12px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "4px" }}>PHONE</div>
                <div style={{ fontSize: "13px", color: "#E8E8F0" }}>{selectedGuest.phone?.replace("whatsapp:", "") || "—"}</div>
              </div>
              <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "12px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "4px" }}>RSVP</div>
                <div style={{ fontSize: "13px", color: "#E8E8F0" }}>{selectedGuest.rsvp_status || "pending"}</div>
              </div>
              <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "12px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "4px" }}>LOCATION</div>
                <div style={{ fontSize: "13px", color: "#E8E8F0" }}>{selectedGuest.linkedin_data?.location || selectedGuest.city || "—"}</div>
              </div>
              <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "12px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "4px" }}>COMPANY</div>
                <div style={{ fontSize: "13px", color: "#E8E8F0" }}>{selectedGuest.linkedin_data?.current_company || "—"}</div>
              </div>

              {/* Age — editable with estimate button */}
              <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "12px", gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A" }}>
                    AGE {selectedGuest.age_estimated ? <span style={{ color: "#FFB800" }}>~ ESTIMATED</span> : selectedGuest.age ? <span style={{ color: "#A8FF3E" }}>✓ CONFIRMED</span> : ""}
                  </div>
                  {selectedGuest.linkedin_data && editingGuest !== selectedGuest.phone && (
                    <button
                      onClick={async () => {
                        const resp = await fetch(`${RAILWAY_URL}/guests/estimate-age/${encodeURIComponent(selectedGuest.phone)}`, { method: "POST" });
                        const data = await resp.json();
                        if (data.age) {
                          const updated = { ...selectedGuest, age: data.age, age_estimated: true };
                          setGuests(prev => prev.map(g => g.phone === selectedGuest.phone ? updated : g));
                          setSelectedGuest(updated);
                          alert(`Age estimated: ${data.age} (via ${data.method})`);
                        } else {
                          alert(data.error || "Could not estimate age from LinkedIn data");
                        }
                      }}
                      style={{ background: "#FFB80011", border: "1px solid #FFB80033", borderRadius: "6px", padding: "3px 10px", color: "#FFB800", fontFamily: "'Space Mono', monospace", fontSize: "9px", cursor: "pointer" }}
                    >
                      ✨ ESTIMATE FROM LINKEDIN
                    </button>
                  )}
                </div>
                {editingGuest === selectedGuest.phone ? (
                  <input
                    value={editForm.age || ""}
                    onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))}
                    placeholder="Enter age (overrides estimate)"
                    type="number" min="18" max="100"
                    style={{ background: "#1A1A2E", border: "1px solid #A8FF3E44", borderRadius: "6px", padding: "6px 10px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box" }}
                  />
                ) : (
                  <div style={{ fontSize: "20px", fontWeight: 600, color: selectedGuest.age_estimated ? "#FFB800" : "#E8E8F0", fontFamily: "'Space Mono', monospace" }}>
                    {selectedGuest.age || <span style={{ fontSize: "13px", color: "#3A3A5A" }}>—</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Editable LinkedIn URL */}
            <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "6px" }}>LINKEDIN URL</div>
              {editingGuest === selectedGuest.phone ? (
                <input value={editForm.linkedin_url || ""} onChange={e => setEditForm(f => ({ ...f, linkedin_url: e.target.value }))}
                  placeholder="https://linkedin.com/in/username"
                  style={{ background: "#1A1A2E", border: "1px solid #A8FF3E44", borderRadius: "6px", padding: "6px 10px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box" }} />
              ) : (
                selectedGuest.linkedin_url
                  ? <a href={selectedGuest.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#00D4FF", textDecoration: "none" }}>{selectedGuest.linkedin_url}</a>
                  : <span style={{ fontSize: "13px", color: "#3A3A5A" }}>—</span>
              )}
            </div>

            {/* Success Score Panel */}
            {(() => {
              const sc = guestScores[selectedGuest.phone];
              if (!sc) return (
                <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "11px", color: "#3A3A5A", fontFamily: "'Space Mono', monospace" }}>NO SCORE YET</div>
                  <button onClick={() => scoreGuest(selectedGuest.phone)}
                    style={{ background: "#B388FF22", border: "1px solid #B388FF44", borderRadius: "6px", padding: "5px 12px", color: "#B388FF", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer" }}>
                    ⚡ SCORE NOW
                  </button>
                </div>
              );
              const dims = [
                { key: "success_score", label: "OVERALL", color: "#A8FF3E", big: true },
                { key: "pedigree_score", label: "PEDIGREE", color: "#00D4FF" },
                { key: "accomplishment_score", label: "ACCOMPLISHMENTS", color: "#FFB800" },
                { key: "credibility_score", label: "CREDIBILITY", color: "#FF6B35" },
                { key: "company_score", label: "COMPANY", color: "#B388FF" },
                { key: "value_to_others", label: "VALUE", color: "#FF3E9A" },
              ];
              return (
                <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A" }}>SUCCESS SCORES — CLICK TO OVERRIDE</div>
                    <button onClick={() => scoreGuest(selectedGuest.phone)}
                      style={{ background: "transparent", border: "1px solid #2A2A4A", borderRadius: "6px", padding: "3px 8px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "9px", cursor: "pointer" }}>
                      ↺ RESCORE
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                    {dims.map(({ key, label, color, big }) => (
                      <div key={key}
                        onClick={() => { setOverrideModal({ phone: selectedGuest.phone, name: selectedGuest.name || selectedGuest.linkedin_data?.full_name, dimension: key, scoreBefore: sc[key] }); setOverrideValue(sc[key] || 50); setOverrideReason(""); setOverrideCategory("other"); }}
                        style={{ background: "#0A0A18", borderRadius: "8px", padding: "10px", cursor: "pointer", border: `1px solid ${color}22`, gridColumn: big ? "1 / -1" : "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontSize: "9px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A" }}>{label}</div>
                        <div style={{ fontSize: big ? "24px" : "18px", fontWeight: 700, color, fontFamily: "'Space Mono', monospace" }}>{sc[key] ?? "—"}</div>
                      </div>
                    ))}
                  </div>
                  {sc.score_breakdown?.key_insight && (
                    <div style={{ marginTop: "10px", fontSize: "12px", color: "#8888AA", fontStyle: "italic", lineHeight: 1.5 }}>
                      💡 {sc.score_breakdown?.key_insight || JSON.parse(sc.score_breakdown || "{}").key_insight}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* LinkedIn data — full display */}
            {selectedGuest.linkedin_data && !selectedGuest.linkedin_data.error ? (
              <>
                {selectedGuest.linkedin_data.summary && (
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "8px" }}>SUMMARY</div>
                    <div style={{ fontSize: "13px", color: "#8888AA", lineHeight: 1.6 }}>{selectedGuest.linkedin_data.summary}</div>
                  </div>
                )}

                {selectedGuest.linkedin_data.experiences?.length > 0 && (
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "12px" }}>EXPERIENCE ({selectedGuest.linkedin_data.experiences.length})</div>
                    {selectedGuest.linkedin_data.experiences.map((exp, i) => (
                      <div key={i} style={{ marginBottom: i < selectedGuest.linkedin_data.experiences.length - 1 ? "14px" : 0, paddingBottom: i < selectedGuest.linkedin_data.experiences.length - 1 ? "14px" : 0, borderBottom: i < selectedGuest.linkedin_data.experiences.length - 1 ? "1px solid #1A1A2E" : "none" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#E8E8F0" }}>{exp.title}</div>
                        <div style={{ fontSize: "12px", color: "#00D4FF", marginTop: "2px" }}>{exp.company}</div>
                        <div style={{ fontSize: "11px", color: "#5A5A7A", marginTop: "2px", fontFamily: "'Space Mono', monospace" }}>{exp.dates}{exp.duration ? ` · ${exp.duration}` : ""}</div>
                        {exp.description && <div style={{ fontSize: "12px", color: "#6666AA", marginTop: "6px", lineHeight: 1.5 }}>{exp.description}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {selectedGuest.linkedin_data.education?.length > 0 && (
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "12px" }}>EDUCATION</div>
                    {selectedGuest.linkedin_data.education.map((edu, i) => (
                      <div key={i} style={{ marginBottom: i < selectedGuest.linkedin_data.education.length - 1 ? "12px" : 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#E8E8F0" }}>{edu.school}</div>
                        {(edu.degree || edu.field) && <div style={{ fontSize: "12px", color: "#8888AA", marginTop: "2px" }}>{[edu.degree, edu.field].filter(Boolean).join(" · ")}</div>}
                        {edu.description && <div style={{ fontSize: "11px", color: "#6666AA", marginTop: "4px", lineHeight: 1.5 }}>{edu.description}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {selectedGuest.linkedin_data.publications?.length > 0 && (
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "10px" }}>PUBLICATIONS</div>
                    {selectedGuest.linkedin_data.publications.map((pub, i) => {
                      const title = typeof pub === "string" ? pub : (pub?.name || pub?.title || pub?.description || JSON.stringify(pub));
                      const url = typeof pub === "object" ? pub?.url : null;
                      const publisher = typeof pub === "object" ? pub?.publisher : null;
                      return (
                        <div key={i} style={{ marginBottom: "10px" }}>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#00D4FF", textDecoration: "none", lineHeight: 1.5 }}>📄 {title}</a>
                          ) : (
                            <div style={{ fontSize: "12px", color: "#8888AA", lineHeight: 1.5 }}>📄 {title}</div>
                          )}
                          {publisher && <div style={{ fontSize: "11px", color: "#5A5A7A", marginTop: "2px" }}>{publisher}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedGuest.linkedin_data.skills?.length > 0 && (
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "10px" }}>SKILLS ({selectedGuest.linkedin_data.skills.length})</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {selectedGuest.linkedin_data.skills.map((skill, i) => (
                        <div key={i} style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: "#1A1A2E", color: "#8888AA", fontFamily: "'DM Sans', sans-serif" }}>{skill}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "#3A3A5A", fontFamily: "'Space Mono', monospace", marginBottom: "12px" }}>NO LINKEDIN DATA YET</div>
                <div style={{ fontSize: "12px", color: "#5A5A7A" }}>Use the 📋 IMPORT JSON button in the guest row to add LinkedIn data</div>
              </div>
            )}

            {/* Editable onboarding fields */}
            <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px", marginTop: "12px" }}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "12px" }}>FROM ONBOARDING</div>
              {[
                { key: "what_they_do", label: "WORKING ON", placeholder: "What are they building or working on?" },
                { key: "who_they_want_to_meet", label: "WANTS TO MEET", placeholder: "Who do they want to connect with?" },
                { key: "interests", label: "INTERESTS", placeholder: "Hobbies, passions outside work" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", color: "#3A3A5A", fontFamily: "'Space Mono', monospace", marginBottom: "4px" }}>{label}</div>
                  {editingGuest === selectedGuest.phone ? (
                    <input value={editForm[key] || ""} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ background: "#1A1A2E", border: "1px solid #A8FF3E44", borderRadius: "6px", padding: "6px 10px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box" }} />
                  ) : (
                    <span style={{ fontSize: "13px", color: "#8888AA" }}>{selectedGuest[key] || <span style={{ color: "#3A3A5A" }}>—</span>}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Personalized invite */}
            {selectedGuest.personalized_invite && (
              <div style={{ background: "#FF6B3511", border: "1px solid #FF6B3533", borderRadius: "10px", padding: "14px", marginTop: "12px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FF6B35", marginBottom: "8px" }}>PERSONALIZED INVITE SENT</div>
                <div style={{ fontSize: "13px", color: "#E8E8F0", lineHeight: 1.6, fontStyle: "italic" }}>"{selectedGuest.personalized_invite}"</div>
              </div>
            )}



            {/* Import JSON from OpenClaw */}
            <button
              onClick={() => { setJsonImportText(""); setJsonImportError(""); setJsonImportModal(selectedGuest); setSelectedGuest(null); }}
              style={{ display: "block", width: "100%", marginTop: "10px", textAlign: "center", fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E", background: "#A8FF3E11", padding: "10px", border: "1px solid #A8FF3E33", borderRadius: "10px", cursor: "pointer" }}
            >
              📋 IMPORT JSON FROM OPENCLAW
            </button>
          </div>
        </div>
      )}

      {/* JSON Import Modal */}
      {jsonImportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(12px)" }}
          onClick={() => !jsonImporting && setJsonImportModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "20px", width: "600px", maxHeight: "85vh", overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E", letterSpacing: "0.1em", marginBottom: "6px" }}>📋 IMPORT LINKEDIN JSON</div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#E8E8F0" }}>{jsonImportModal.name || jsonImportModal.phone}</div>
              </div>
              {!jsonImporting && <button onClick={() => setJsonImportModal(null)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", width: "32px", height: "32px", color: "#5A5A7A", cursor: "pointer", fontSize: "16px" }}>✕</button>}
            </div>

            {/* Instructions */}
            <div style={{ background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FFB800", marginBottom: "10px" }}>HOW TO GET THE JSON</div>
              <div style={{ fontSize: "12px", color: "#8888AA", lineHeight: 1.7 }}>
                1. Open OpenClaw console at <span style={{ color: "#00D4FF", fontFamily: "'Space Mono', monospace" }}>127.0.0.1:18789</span><br/>
                2. Make sure Browser Relay is ON on the LinkedIn tab<br/>
                3. Type: <span style={{ color: "#A8FF3E", fontFamily: "'Space Mono', monospace", fontSize: "11px" }}>Go to {jsonImportModal.linkedin_url} in my browser, scroll to the bottom, click all Show More and Show All buttons, extract full profile as JSON with fields: full_name, headline, current_role, current_company, location, summary, experiences, education, skills, publications</span><br/>
                4. Copy the JSON result and paste it below
              </div>
            </div>

            {/* Quick copy prompt button */}
            <button
              onClick={() => {
                const prompt = `Go to ${jsonImportModal.linkedin_url} in my browser, scroll to the bottom, click all Show More and Show All buttons, extract full profile as JSON with fields: full_name, headline, current_role, current_company, location, summary, experiences (array with title/company/dates/duration/description), education (array with school/degree/field), skills (array), publications (array). Return ONLY the JSON.`;
                navigator.clipboard.writeText(prompt);
              }}
              style={{ background: "#0F0F1A", border: "1px solid #A8FF3E33", borderRadius: "10px", padding: "10px", color: "#A8FF3E", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer", textAlign: "left" }}
            >
              📋 COPY OPENCLAW PROMPT TO CLIPBOARD
            </button>

            {/* JSON paste area */}
            <div>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "8px" }}>
                PASTE JSON HERE {jsonImportText.length > 0 ? `— ${jsonImportText.length.toLocaleString()} chars` : ""}
              </div>
              <textarea
                value={jsonImportText}
                onChange={e => { setJsonImportText(e.target.value); setJsonImportError(""); }}
                placeholder='{"full_name": "...", "experiences": [...], ...}'
                rows={8}
                disabled={jsonImporting}
                autoFocus
                style={{
                  width: "100%", background: "#0F0F1A",
                  border: `1px solid ${jsonImportError ? "#FF3E9A44" : jsonImportText.length > 50 ? "#A8FF3E44" : "#1A1A2E"}`,
                  borderRadius: "10px", padding: "12px", color: "#E8E8F0",
                  fontFamily: "'Space Mono', monospace", fontSize: "11px",
                  resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5,
                }}
              />
              {jsonImportError && <div style={{ fontSize: "11px", color: "#FF3E9A", marginTop: "6px", fontFamily: "'Space Mono', monospace" }}>{jsonImportError}</div>}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={async () => {
                  if (!jsonImportText.trim() || jsonImporting) return;
                  setJsonImporting(true);
                  setJsonImportError("");
                  try {
                    // Parse and validate JSON
                    let profile;
                    try {
                      const clean = jsonImportText.replace(/```json|```/g, "").trim();
                      // Try to find JSON object in text
                      const match = clean.match(/\{[\s\S]+\}/);
                      profile = JSON.parse(match ? match[0] : clean);
                    } catch {
                      setJsonImportError("Invalid JSON — make sure you copied the full JSON object from OpenClaw");
                      setJsonImporting(false);
                      return;
                    }
                    if (!profile.full_name) {
                      setJsonImportError("JSON is missing full_name — make sure OpenClaw returned a complete profile");
                      setJsonImporting(false);
                      return;
                    }
                    // Save to Supabase via Railway
                    const patchResp = await fetch(`${RAILWAY_URL}/guests/${encodeURIComponent(jsonImportModal.phone)}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ linkedin_data: profile, name: profile.full_name }),
                    });
                    if (patchResp.ok) {
                      setGuests(prev => prev.map(g => g.id === jsonImportModal.id ? {
                        ...g, linkedin_data: profile, name: profile.full_name,
                      } : g));
                      setScrapeStatus(s => ({ ...s, [jsonImportModal.id]: "done" }));
                      setJsonImportModal(null);
                      setJsonImportText("");
                    } else {
                      setJsonImportError("Failed to save to database — check Railway logs");
                    }
                  } catch (e) {
                    setJsonImportError("Error: " + e.message);
                  } finally {
                    setJsonImporting(false);
                  }
                }}
                disabled={jsonImportText.length < 10 || jsonImporting}
                style={{
                  flex: 1,
                  background: jsonImportText.length >= 10 && !jsonImporting ? "linear-gradient(135deg, #A8FF3E, #4ADE80)" : "#1A1A2E",
                  border: "none", borderRadius: "10px", padding: "13px",
                  color: jsonImportText.length >= 10 && !jsonImporting ? "#07070F" : "#3A3A5A",
                  fontFamily: "'Space Mono', monospace", fontSize: "12px",
                  cursor: jsonImportText.length >= 10 && !jsonImporting ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
              >
                {jsonImporting
                  ? <><span style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid #0A0A18", borderTopColor: "#07070F", display: "inline-block", animation: "spin 0.8s linear infinite" }} />SAVING...</>
                  : "✓ IMPORT & SAVE PROFILE"}
              </button>
              {!jsonImporting && (
                <button onClick={() => setJsonImportModal(null)}
                  style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "10px", padding: "13px 18px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer" }}>
                  CANCEL
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Add Guest Modal */}
      {addGuestModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(12px)" }}
          onClick={() => !addGuestSaving && setAddGuestModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "20px", width: "580px", maxHeight: "85vh", overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "14px" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E", letterSpacing: "0.1em", marginBottom: "6px" }}>+ ADD TEST GUEST</div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: "#E8E8F0" }}>Add guest manually</div>
              </div>
              {!addGuestSaving && <button onClick={() => setAddGuestModal(false)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", width: "32px", height: "32px", color: "#5A5A7A", cursor: "pointer", fontSize: "16px" }}>✕</button>}
            </div>

            {[
              { key: "phone", label: "PHONE NUMBER *", placeholder: "+15550000001 (required, must be unique)" },
              { key: "name", label: "NAME", placeholder: "Jane Smith" },
              { key: "linkedin_url", label: "LINKEDIN URL", placeholder: "https://linkedin.com/in/username" },
              { key: "what_they_do", label: "WHAT THEY DO", placeholder: "Building AI tools for healthcare" },
              { key: "who_they_want_to_meet", label: "WHO THEY WANT TO MEET", placeholder: "Investors, other founders" },
              { key: "interests", label: "INTERESTS", placeholder: "Music, hiking, cooking" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>{label}</div>
                <input
                  value={addGuestForm[key]}
                  onChange={e => setAddGuestForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: "100%", background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "9px 12px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}

            <div>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>LINKEDIN JSON (optional — paste from OpenClaw)</div>
              <textarea
                value={addGuestForm.linkedin_json}
                onChange={e => setAddGuestForm(f => ({ ...f, linkedin_json: e.target.value }))}
                placeholder='{"full_name": "...", "experiences": [...], ...}'
                rows={4}
                style={{ width: "100%", background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "9px 12px", color: "#E8E8F0", fontFamily: "'Space Mono', monospace", fontSize: "11px", outline: "none", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            {addGuestError && <div style={{ fontSize: "12px", color: "#FF3E9A", fontFamily: "'Space Mono', monospace", background: "#FF3E9A11", border: "1px solid #FF3E9A33", borderRadius: "8px", padding: "8px 12px" }}>{addGuestError}</div>}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={addGuest}
                disabled={addGuestSaving}
                style={{ flex: 1, background: addGuestSaving ? "#1A1A2E" : "linear-gradient(135deg, #A8FF3E, #4ADE80)", border: "none", borderRadius: "10px", padding: "13px", color: addGuestSaving ? "#3A3A5A" : "#07070F", fontFamily: "'Space Mono', monospace", fontSize: "12px", cursor: addGuestSaving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                {addGuestSaving ? <><span style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid #3A3A5A", borderTopColor: "#A8FF3E", display: "inline-block", animation: "spin 0.8s linear infinite" }} />SAVING...</> : "✓ ADD GUEST"}
              </button>
              {!addGuestSaving && <button onClick={() => setAddGuestModal(false)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "10px", padding: "13px 18px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer" }}>CANCEL</button>}
            </div>
          </div>
        </div>
      )}

      {/* Score Override Modal */}
      {overrideModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, backdropFilter: "blur(12px)" }}
          onClick={() => !overrideSaving && setOverrideModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#0A0A18", border: "1px solid #B388FF33", borderRadius: "20px", width: "480px", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#B388FF", marginBottom: "6px" }}>✏ OVERRIDE SCORE — YOUR FEEDBACK IMPROVES FUTURE RANKINGS</div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#E8E8F0" }}>{overrideModal.name}</div>
              <div style={{ fontSize: "12px", color: "#5A5A7A", marginTop: "4px" }}>{overrideModal.dimension.replace(/_/g, " ").toUpperCase()}: {overrideModal.scoreBefore} → {overrideValue}</div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A" }}>NEW SCORE</span>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "#B388FF", fontFamily: "'Space Mono', monospace" }}>{overrideValue}</span>
              </div>
              <input type="range" min={0} max={100} value={overrideValue} onChange={e => setOverrideValue(+e.target.value)}
                style={{ width: "100%", accentColor: "#B388FF" }} />
            </div>

            <div>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "8px" }}>REASON CATEGORY</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {[["company_too_low", "Company underrated"], ["company_too_high", "Company overrated"], ["exit_size", "Exit size wrong"], ["pedigree_wrong", "Pedigree wrong"], ["not_founder", "Not actual founder"], ["no_deals_closed", "No deals closed"], ["industry_wrong", "Industry potential wrong"], ["other", "Other"]].map(([val, label]) => (
                  <button key={val} onClick={() => setOverrideCategory(val)}
                    style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${overrideCategory === val ? "#B388FF" : "#2A2A4A"}`, background: overrideCategory === val ? "#B388FF22" : "transparent", color: overrideCategory === val ? "#B388FF" : "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "9px", cursor: "pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>YOUR REASONING (TRAINS FUTURE SCORING)</div>
              <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                placeholder="e.g. Eric's company has Fannie Mae regulatory moat — this should score higher than generic SaaS"
                rows={3}
                style={{ width: "100%", background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "10px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", outline: "none", resize: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={saveOverride} disabled={overrideSaving || !overrideReason.trim()}
                style={{ flex: 1, background: overrideReason.trim() && !overrideSaving ? "linear-gradient(135deg, #B388FF, #7C4DFF)" : "#1A1A2E", border: "none", borderRadius: "10px", padding: "12px", color: overrideReason.trim() && !overrideSaving ? "white" : "#3A3A5A", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: overrideReason.trim() && !overrideSaving ? "pointer" : "not-allowed" }}>
                {overrideSaving ? "SAVING..." : "✓ SAVE OVERRIDE"}
              </button>
              <button onClick={() => setOverrideModal(null)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "10px", padding: "12px 16px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Relay setup modal */}
      {relayModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(12px)" }}
          onClick={() => setRelayModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "20px", width: "520px", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E", letterSpacing: "0.1em", marginBottom: "6px" }}>🦞 OPENCLAW BROWSER SCRAPE</div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#E8E8F0" }}>{relayModal.linkedin_url?.split("/in/")[1]?.replace("/", "") || "LinkedIn Profile"}</div>
              </div>
              <button onClick={() => setRelayModal(null)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", width: "32px", height: "32px", color: "#5A5A7A", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>

            {/* Steps */}
            <div style={{ background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FFB800", marginBottom: "4px" }}>DO THIS FIRST</div>
              {[
                { n: "1", text: "Make sure the OpenClaw Browser Relay icon is ON (green) in Chrome toolbar" },
                { n: "2", text: "Click Scrape Now — OpenClaw will open LinkedIn, scroll it, and extract everything automatically" },
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#A8FF3E22", border: "1px solid #A8FF3E44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E" }}>{step.n}</span>
                  </div>
                  <span style={{ fontSize: "13px", color: "#8888AA", lineHeight: 1.5 }}>{step.text}</span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <button
              onClick={() => runOpenClawScrape(relayModal)}
              style={{ background: "linear-gradient(135deg, #A8FF3E, #4ADE80)", border: "none", borderRadius: "10px", padding: "14px", color: "#07070F", fontFamily: "'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", cursor: "pointer", fontWeight: 700 }}
            >
              🦞 SCRAPE WITH OPENCLAW
            </button>

            <button
              onClick={() => { setRelayModal(null); window.open(relayModal.linkedin_url, "_blank"); setPasteText(""); setPasteModal(relayModal); }}
              style={{ background: "transparent", border: "1px solid #2A2A4A", borderRadius: "10px", padding: "10px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer" }}
            >
              USE PASTE METHOD INSTEAD
            </button>
          </div>
        </div>
      )}

      {/* Paste modal */}
      {pasteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(12px)" }}
          onClick={() => !parsing && setPasteModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "20px", width: "580px", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#00D4FF", letterSpacing: "0.1em", marginBottom: "6px" }}>PASTE LINKEDIN PROFILE</div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#E8E8F0" }}>{pasteModal.linkedin_url?.split("/in/")[1]?.replace("/", "") || "LinkedIn Profile"}</div>
              </div>
              {!parsing && <button onClick={() => setPasteModal(null)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", width: "32px", height: "32px", color: "#5A5A7A", cursor: "pointer", fontSize: "16px" }}>✕</button>}
            </div>
            <div style={{ background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FFB800", marginBottom: "10px" }}>HOW TO DO THIS</div>
              {["1. LinkedIn just opened in a new tab — go to it", "2. Press Cmd+A to select all text on the page", "3. Press Cmd+C to copy", "4. Come back here and paste below (Cmd+V)"].map((step, i) => (
                <div key={i} style={{ fontSize: "12px", color: "#8888AA", marginBottom: "4px" }}>{step}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "8px" }}>
                PASTE HERE {pasteText.length > 0 ? `— ${pasteText.length.toLocaleString()} chars ✓` : "— waiting..."}
              </div>
              <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder="Paste LinkedIn page text here..." rows={6} disabled={parsing} autoFocus
                style={{ width: "100%", background: "#0F0F1A", border: `1px solid ${pasteText.length > 100 ? "#A8FF3E44" : "#1A1A2E"}`, borderRadius: "10px", padding: "12px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "12px", resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.5, transition: "border-color 0.2s" }} />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={parseAndSave} disabled={pasteText.length < 50 || parsing}
                style={{ flex: 1, background: pasteText.length >= 50 && !parsing ? "linear-gradient(135deg, #A8FF3E, #4ADE80)" : "#1A1A2E", border: "none", borderRadius: "10px", padding: "13px", color: pasteText.length >= 50 && !parsing ? "#07070F" : "#3A3A5A", fontFamily: "'Space Mono', monospace", fontSize: "12px", cursor: pasteText.length >= 50 && !parsing ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                {parsing ? <><span style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid #0A0A18", borderTopColor: "#07070F", display: "inline-block", animation: "spin 0.8s linear infinite" }} />PARSING...</> : "✓ PARSE & SAVE"}
              </button>
              {!parsing && <button onClick={() => setPasteModal(null)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "10px", padding: "13px 18px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer" }}>CANCEL</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Matches Tab ───────────────────────────────────────────────────────────────
function MatchesTab() {
  const [guests, setGuests] = useState([]);
  const [matches, setMatches] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [introModal, setIntroModal] = useState(null);
  const [filterMin, setFilterMin] = useState(60);
  const [mode, setMode] = useState("batch"); // "batch" or "pairwise"
  const [pairwiseProgress, setPairwiseProgress] = useState({ done: 0, total: 0 });
  const [guestScores, setGuestScores] = useState({});

  useEffect(() => { loadGuests(); }, []);

  async function loadGuests() {
    const resp = await fetch(`${RAILWAY_URL}/guests`);
    const data = await resp.json();
    setGuests(data.filter(g => g.onboarding_complete || g.linkedin_data));
  }

  function buildProfileSummary(g) {
    const ld = g.linkedin_data || {};
    const exps = (ld.experiences || []).map(e =>
      `  - ${e.title} at ${e.company} (${e.dates || ""} ${e.duration ? "· " + e.duration : ""})${e.description ? ": " + e.description.slice(0, 200) : ""}`
    ).join("\n");
    const edu = (ld.education || []).map(e =>
      `  - ${e.school}${e.degree ? " · " + e.degree : ""}${e.field ? " in " + e.field : ""}${e.description ? " · " + e.description.slice(0, 100) : ""}`
    ).join("\n");
    const honors = (ld.honors || []).join(", ");
    const pubs = (ld.publications || []).map(p => typeof p === "string" ? p : p.title).join(", ");
    const certs = (ld.certifications || []).map(c => c.name).join(", ");
    const langs = (ld.languages || []).join(", ");

    return `=== ${ld.full_name || g.name || "Unknown"} ===
Headline: ${ld.headline || ""}
Current Role: ${ld.current_role || ""} at ${ld.current_company || ""}
Location: ${ld.location || ""}
Connections: ${ld.connection_count || "unknown"} | Followers: ${ld.additional_sections?.follower_count || ld.additional_sections?.followers || "unknown"}

ABOUT:
${ld.summary || "(no summary)"}

WHAT THEY DO (self-described): ${g.what_they_do || "(not provided)"}
WHO THEY WANT TO MEET: ${g.who_they_want_to_meet || "(not provided)"}
PERSONAL INTERESTS: ${g.interests || "(not provided)"}

EXPERIENCE:
${exps || "(none listed)"}

EDUCATION:
${edu || "(none listed)"}

SKILLS: ${(ld.skills || []).join(", ") || "(none listed)"}
HONORS & AWARDS: ${honors || "(none)"}
PUBLICATIONS: ${pubs || "(none)"}
CERTIFICATIONS: ${certs || "(none)"}
LANGUAGES: ${langs || "(none)"}`;
  }

  function buildScoringPrompt(g) {
    return `Score this person on the following dimensions. Return ONLY a JSON object.

PROFILE:
${buildProfileSummary(g)}

Score each dimension 0-100 with a one-sentence justification:

{
  "education_pedigree": { "score": 0-100, "reason": "..." },
  "employer_prestige": { "score": 0-100, "reason": "..." },
  "career_trajectory": { "score": 0-100, "reason": "..." },
  "hard_accomplishments": { "score": 0-100, "reason": "cite specific numbers: revenue, users, team size, raises, exits" },
  "external_validation": { "score": 0-100, "reason": "Forbes, YC, awards, press, patents" },
  "execution_velocity": { "score": 0-100, "reason": "how fast did they scale things?" },
  "network_quality": { "score": 0-100, "reason": "connections, followers, endorsements" },
  "credibility_for_goal": { "score": 0-100, "reason": "does their background actually support what they say they want to do?" },
  "value_to_others": { "score": 0-100, "reason": "what can they realistically offer someone they meet?" },
  "goal_specificity": { "score": 0-100, "reason": "how clear and realistic is their networking ask?" },
  "stage": "pre-idea | idea | early | growth | established | exited",
  "composite_score": 0-100,
  "top_3_value_props": ["string", "string", "string"],
  "red_flags": ["any concerns about credibility or goal alignment"]
}`;
  }

  async function callClaude(prompt, maxTokens) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens || 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await resp.json();
    return data.content?.[0]?.text || "";
  }

  function parseClaudeJSON(text) {
    const clean = text.replace(/```json|```/g, "").trim();
    try { return JSON.parse(clean); } catch(e) {}
    const arr = clean.match(/\[[\s\S]+\]/); if (arr) { try { return JSON.parse(arr[0]); } catch(e) {} }
    const obj = clean.match(/\{[\s\S]+\}/); if (obj) { try { return JSON.parse(obj[0]); } catch(e) {} }
    return null;
  }

  async function scoreGuest(g) {
    const ld = g.linkedin_data || {};
    const exps = (ld.experiences || []).map(e => `${e.title} at ${e.company} (${e.duration || ""}): ${(e.description || "").slice(0, 150)}`).join("\n");
    const edu = (ld.education || []).map(e => `${e.school} - ${e.degree || ""} ${e.field || ""}`).join("\n");
    const prompt = `Score this person's professional profile. Return ONLY a JSON object.

NAME: ${ld.full_name || g.name || "Unknown"}
HEADLINE: ${ld.headline || ""}
SUMMARY: ${(ld.summary || "").slice(0, 400)}
WHAT THEY DO: ${g.what_they_do || ""}
WHO THEY WANT TO MEET: ${g.who_they_want_to_meet || ""}
EXPERIENCE:\n${exps}
EDUCATION:\n${edu}
HONORS: ${(ld.honors || []).join(", ")}
SKILLS: ${(ld.skills || []).slice(0, 15).join(", ")}
CONNECTIONS: ${ld.connection_count || "unknown"}

{"education_pedigree":{"score":0,"reason":""},"employer_prestige":{"score":0,"reason":""},"career_trajectory":{"score":0,"reason":""},"hard_accomplishments":{"score":0,"reason":"cite specific numbers"},"external_validation":{"score":0,"reason":"Forbes YC awards"},"execution_velocity":{"score":0,"reason":""},"network_quality":{"score":0,"reason":""},"credibility_for_goal":{"score":0,"reason":"does background support stated goal?"},"value_to_others":{"score":0,"reason":"what can they offer?"},"goal_specificity":{"score":0,"reason":"how clear is their ask?"},"stage":"pre-idea|idea|early|growth|established|exited","composite_score":0,"top_3_value_props":["","",""],"red_flags":[]}`;
    const text = await callClaude(prompt, 700);
    return parseClaudeJSON(text);
  }

  async function generateMatches() {
    if (guests.length < 2) return;
    setGenerating(true);
    setMatches([]);
    setPairwiseProgress({ done: 0, total: guests.length + 1 });

    // Step 1: Score each guest individually
    const scoredGuests = guests.map(g => ({ ...g }));
    const BATCH = 5;
    for (let i = 0; i < guests.length; i += BATCH) {
      const batch = guests.slice(i, i + BATCH);
      const scores = await Promise.all(batch.map(g => scoreGuest(g)));
      scores.forEach((score, j) => { if (score) scoredGuests[i + j].rubric = score; });
      setPairwiseProgress({ done: Math.min(i + BATCH, guests.length), total: guests.length + 1 });
    }

    // Step 2: Match using rubric context
    const profileBlocks = scoredGuests.map((g, i) => {
      const r = g.rubric || {};
      const ld = g.linkedin_data || {};
      return `[${i}] ${ld.full_name || g.name} | Stage: ${r.stage || "?"} | Score: ${r.composite_score || "?"}/100
  Credibility for goal: ${r.credibility_for_goal?.score || "?"}/100 — ${r.credibility_for_goal?.reason || ""}
  Value to others: ${r.value_to_others?.score || "?"}/100 — ${r.value_to_others?.reason || ""}
  Hard accomplishments: ${r.hard_accomplishments?.score || "?"}/100 — ${r.hard_accomplishments?.reason || ""}
  Top value props: ${(r.top_3_value_props || []).join("; ")}
  Red flags: ${(r.red_flags || []).join("; ") || "none"}
  Wants to meet: ${g.who_they_want_to_meet || "not specified"}
  What they do: ${g.what_they_do || ld.headline || ""}`;
    }).join("\n\n");

    const matchPrompt = `Expert matchmaker for exclusive LA networking event. Guests have been pre-scored on credibility and value.

CRITICAL RULES:
1. VALUE EXCHANGE SYMMETRIC: score = min(value_A_to_B, value_B_to_A). If one gets 90 and other gets 10, exchange = 10.
2. CREDIBILITY MATTERS: credibility_for_goal < 40 means they should NOT be matched with top-tier people in that domain.
3. STAGE: pre-idea with exited founder = usually poor unless very specific reason.
4. BE SPECIFIC: cite actual companies, dollars, goals.

SCORED PROFILES:
${profileBlocks}

Return ONLY a JSON array of top 15-20 matches (score 60+):
[{"a":0,"b":1,"score":0,"match_type":"label","rubric":{"value_a_brings_to_b":0,"value_b_brings_to_a":0,"value_exchange_score":0,"credibility_alignment":0,"stage_alignment":0,"goal_compatibility":0,"interest_overlap":0},"reason_for_a":"specific","reason_for_b":"specific","shared":"common ground","potential_red_flags":"any concerns","intro_hook":"punchy opener"}]`;

    const text = await callClaude(matchPrompt, 5000);
    const parsed = parseClaudeJSON(text);
    if (parsed && Array.isArray(parsed)) {
      const enriched = parsed.map(m => ({
        ...m,
        guestA: scoredGuests[m.a],
        guestB: scoredGuests[m.b],
        nameA: scoredGuests[m.a]?.linkedin_data?.full_name || scoredGuests[m.a]?.name || "Guest A",
        nameB: scoredGuests[m.b]?.linkedin_data?.full_name || scoredGuests[m.b]?.name || "Guest B",
      })).sort((a, b) => b.score - a.score);
      setMatches(enriched);
      const scores = {};
      scoredGuests.forEach(g => { if (g.rubric) scores[g.phone] = g.rubric; });
      setGuestScores(scores);
    }
    setGenerating(false);
  }

  async function generatePairwise() {
    if (guests.length < 2) return;
    setGenerating(true);
    setMatches([]);

    const pairs = [];
    for (let i = 0; i < guests.length; i++) {
      for (let j = i + 1; j < guests.length; j++) {
        pairs.push([i, j]);
      }
    }

    const total = pairs.length;
    setPairwiseProgress({ done: 0, total });

    const results = [];

    // Process in batches of 5 concurrent requests
    const BATCH_SIZE = 5;
    for (let b = 0; b < pairs.length; b += BATCH_SIZE) {
      const batch = pairs.slice(b, b + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async ([i, j]) => {
        const gA = guests[i];
        const gB = guests[j];
        const prompt = `Rate how well these two people would benefit from meeting at a networking event in LA. Be concise.

PERSON A:
${buildProfileSummary(gA)}

PERSON B:
${buildProfileSummary(gB)}

Return ONLY a JSON object:
{
  "score": 0-100,
  "match_type": "brief label e.g. investor+founder, peers, collaborators",
  "reason_for_a": "one sentence why A benefits",
  "reason_for_b": "one sentence why B benefits",
  "shared": "what they have in common",
  "intro_hook": "one punchy opening line for an intro"
}`;

        try {
          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 400,
              messages: [{ role: "user", content: prompt }],
            }),
          });
          const data = await resp.json();
          const text = data.content?.[0]?.text || "";
          const clean = text.replace(/```json|```/g, "").trim();
          const jsonMatch = clean.match(/\{[\s\S]+\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              ...parsed,
              a: i, b: j,
              guestA: gA, guestB: gB,
              nameA: gA.linkedin_data?.full_name || gA.name || "Guest A",
              nameB: gB.linkedin_data?.full_name || gB.name || "Guest B",
            };
          }
        } catch (e) { console.error(e); }
        return null;
      }));

      const valid = batchResults.filter(Boolean);
      results.push(...valid);
      setPairwiseProgress(p => ({ ...p, done: Math.min(b + BATCH_SIZE, total) }));

      // Update matches progressively as results come in
      setMatches([...results].sort((a, b) => b.score - a.score));
    }

    setGenerating(false);
  }

  async function deepAnalyze(match) {
    setDeepLoading(true);
    setSelectedMatch(match);
    const prompt = `Do a deep match analysis for these two people meeting at a networking event:

PERSON A: ${buildProfileSummary(match.guestA)}

PERSON B: ${buildProfileSummary(match.guestB)}

Return a JSON object:
{
  "score": number 0-100,
  "match_type": "string",
  "why_they_should_meet": "2-3 sentences, very specific",
  "what_a_gets": "Specific value A gets from B",
  "what_b_gets": "Specific value B gets from A",
  "conversation_starters": ["3 specific topics they could discuss"],
  "potential_collaborations": ["1-2 concrete ways they could work together"],
  "shared_context": "Any shared companies, schools, industries, locations",
  "intro_message": "A complete WhatsApp intro message from Sona introducing them to each other at the event. Warm, specific, under 100 words."
}`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const jsonMatch = clean.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        const deep = JSON.parse(jsonMatch[0]);
        setSelectedMatch(m => ({ ...m, deep }));
      }
    } catch (e) { console.error(e); }
    setDeepLoading(false);
  }

  const scoreColor = (s) => s >= 85 ? "#A8FF3E" : s >= 70 ? "#FFB800" : "#FF6B35";
  const filtered = matches.filter(m => m.score >= filterMin);

  return (
    <div style={{ padding: "28px", overflowY: "auto", height: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#B388FF", letterSpacing: "0.1em", marginBottom: "4px" }}>🤜🤛 MATCH ENGINE</div>
          <div style={{ fontSize: "13px", color: "#5A5A7A" }}>{guests.length} guests loaded · {matches.length} matches found</div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", background: "#0F0F1A", borderRadius: "8px", padding: "3px" }}>
            {[["batch", "⚡ BATCH"], ["pairwise", "🔬 PAIRWISE"]].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.05em", background: mode === m ? "#B388FF22" : "transparent", color: mode === m ? "#B388FF" : "#5A5A7A", transition: "all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Cost estimate for pairwise */}
          {mode === "pairwise" && guests.length >= 2 && (
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FFB800", background: "#FFB80011", border: "1px solid #FFB80033", borderRadius: "6px", padding: "4px 10px" }}>
              ~{Math.round(guests.length * (guests.length - 1) / 2)} pairs · ~${(guests.length * (guests.length - 1) / 2 * 0.0002).toFixed(2)}
            </div>
          )}

          {/* Progress for pairwise */}
          {generating && mode === "pairwise" && pairwiseProgress.total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "100px", height: "4px", background: "#1A1A2E", borderRadius: "2px" }}>
                <div style={{ height: "100%", borderRadius: "2px", background: "#B388FF", width: `${(pairwiseProgress.done / pairwiseProgress.total) * 100}%`, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#B388FF" }}>{pairwiseProgress.done}/{pairwiseProgress.total}</span>
            </div>
          )}

          {/* Score filter */}
          {matches.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A" }}>MIN</span>
              <input type="range" min={50} max={90} step={5} value={filterMin} onChange={e => setFilterMin(+e.target.value)}
                style={{ width: "70px", accentColor: "#B388FF" }} />
              <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#B388FF" }}>{filterMin}+</span>
            </div>
          )}

          <button
            onClick={mode === "pairwise" ? generatePairwise : generateMatches}
            disabled={generating || guests.length < 2}
            style={{
              background: generating ? "#0A0A18" : "linear-gradient(135deg, #B388FF, #7C4DFF)",
              border: generating ? "1px solid #1A1A2E" : "none",
              borderRadius: "10px", padding: "10px 20px",
              color: generating ? "#3A3A5A" : "white",
              fontFamily: "'Space Mono', monospace", fontSize: "11px",
              cursor: generating || guests.length < 2 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            {generating
              ? <><span style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid #3A3A5A", borderTopColor: "#B388FF", display: "inline-block", animation: "spin 0.8s linear infinite" }} />{mode === "pairwise" ? `SCORING ${pairwiseProgress.done}/${pairwiseProgress.total}...` : `ANALYZING ${guests.length} GUESTS...`}</>
              : matches.length > 0 ? "↺ REGENERATE" : mode === "pairwise" ? "🔬 RUN PAIRWISE" : "⚡ GENERATE MATCHES (with rubric scoring)"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {matches.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {[
            { label: "Total Matches", value: matches.length, color: "#B388FF" },
            { label: "Strong (85+)", value: matches.filter(m => m.score >= 85).length, color: "#A8FF3E" },
            { label: "Good (70-84)", value: matches.filter(m => m.score >= 70 && m.score < 85).length, color: "#FFB800" },
            { label: "Avg Score", value: Math.round(matches.reduce((s, m) => s + m.score, 0) / matches.length), color: "#00D4FF" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: "24px", fontWeight: 600, color: s.color, fontFamily: "'Space Mono', monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Match list */}
      {matches.length === 0 && !generating && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", color: "#3A3A5A" }}>
          <div style={{ fontSize: "48px" }}>🤜🤛</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px" }}>
            {guests.length < 2 ? `NEED AT LEAST 2 GUESTS (have ${guests.length})` : "CLICK GENERATE MATCHES TO START"}
          </div>
          <div style={{ fontSize: "12px", color: "#2A2A4A", textAlign: "center", maxWidth: "400px" }}>
            Claude will analyze all {guests.length} guest profiles and find the best connections based on their goals, background, and interests.
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map((m, i) => (
            <div
              key={i}
              onClick={() => deepAnalyze(m)}
              style={{
                background: "#0A0A18", border: `1px solid ${selectedMatch?.nameA === m.nameA && selectedMatch?.nameB === m.nameB ? "#B388FF44" : "#1A1A2E"}`,
                borderRadius: "12px", padding: "16px 20px",
                cursor: "pointer", transition: "all 0.15s",
                display: "grid", gridTemplateColumns: "60px 1fr 1fr 140px 80px",
                gap: "16px", alignItems: "center",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#B388FF44"}
              onMouseLeave={e => e.currentTarget.style.borderColor = selectedMatch?.nameA === m.nameA && selectedMatch?.nameB === m.nameB ? "#B388FF44" : "#1A1A2E"}
            >
              {/* Score */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: 700, color: scoreColor(m.score), fontFamily: "'Space Mono', monospace" }}>{m.score}</div>
                <div style={{ fontSize: "9px", color: "#3A3A5A", fontFamily: "'Space Mono', monospace" }}>SCORE</div>
              </div>

              {/* Person A */}
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#E8E8F0" }}>{m.nameA}</div>
                <div style={{ fontSize: "11px", color: "#5A5A7A", marginTop: "2px" }}>{m.guestA?.linkedin_data?.headline?.slice(0, 60) || m.guestA?.what_they_do?.slice(0, 60) || "—"}</div>
                <div style={{ fontSize: "11px", color: "#8888AA", marginTop: "4px", fontStyle: "italic" }}>{m.reason_for_a?.slice(0, 80)}...</div>
              </div>

              {/* Person B */}
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#E8E8F0" }}>{m.nameB}</div>
                <div style={{ fontSize: "11px", color: "#5A5A7A", marginTop: "2px" }}>{m.guestB?.linkedin_data?.headline?.slice(0, 60) || m.guestB?.what_they_do?.slice(0, 60) || "—"}</div>
                <div style={{ fontSize: "11px", color: "#8888AA", marginTop: "4px", fontStyle: "italic" }}>{m.reason_for_b?.slice(0, 80)}...</div>
              </div>

              {/* Match type + rubric mini */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#B388FF", background: "#B388FF11", border: "1px solid #B388FF33", borderRadius: "6px", padding: "4px 8px", textAlign: "center" }}>
                  {m.match_type?.toUpperCase()}
                </div>
                {m.rubric && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {[
                      ["VAL EX", m.rubric.value_exchange_score],
                      ["CRED", m.rubric.credibility_alignment],
                      ["STAGE", m.rubric.stage_alignment],
                    ].map(([label, val]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontSize: "8px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", width: "30px" }}>{label}</span>
                        <div style={{ flex: 1, height: "3px", background: "#1A1A2E", borderRadius: "2px" }}>
                          <div style={{ height: "100%", borderRadius: "2px", background: val >= 70 ? "#A8FF3E" : val >= 50 ? "#FFB800" : "#FF6B35", width: `${val || 0}%` }} />
                        </div>
                        <span style={{ fontSize: "8px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A" }}>{val || "?"}</span>
                      </div>
                    ))}
                  </div>
                )}
                {m.potential_red_flags && m.potential_red_flags !== "none" && (
                  <div style={{ fontSize: "9px", color: "#FF6B35", background: "#FF6B3511", borderRadius: "4px", padding: "2px 6px" }}>⚠ {m.potential_red_flags.slice(0, 40)}</div>
                )}
              </div>

              {/* Action */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <button
                  onClick={e => { e.stopPropagation(); setIntroModal(m); }}
                  style={{ background: "transparent", border: "1px solid #A8FF3E33", borderRadius: "6px", padding: "5px 8px", color: "#A8FF3E", fontFamily: "'Space Mono', monospace", fontSize: "9px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  ✉ INTRO
                </button>
                <div style={{ fontSize: "9px", color: "#3A3A5A", fontFamily: "'Space Mono', monospace", textAlign: "center" }}>click for deep</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deep analysis panel */}
      {selectedMatch && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(12px)" }}
          onClick={() => setSelectedMatch(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#0A0A18", border: "1px solid #B388FF33", borderRadius: "20px", width: "620px", maxHeight: "85vh", overflowY: "auto", padding: "28px" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#B388FF", letterSpacing: "0.1em", marginBottom: "6px" }}>DEEP MATCH ANALYSIS</div>
                <div style={{ fontSize: "18px", fontWeight: 600, color: "#E8E8F0" }}>{selectedMatch.nameA} × {selectedMatch.nameB}</div>
                <div style={{ fontSize: "12px", color: "#5A5A7A", marginTop: "4px" }}>{selectedMatch.match_type}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ fontSize: "32px", fontWeight: 700, color: scoreColor(selectedMatch.score), fontFamily: "'Space Mono', monospace" }}>{selectedMatch.score}</div>
                <button onClick={() => setSelectedMatch(null)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", width: "32px", height: "32px", color: "#5A5A7A", cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>
            </div>

            {/* Rubric breakdown from batch scoring */}
            {selectedMatch.rubric && (
              <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "12px" }}>MATCH RUBRIC BREAKDOWN</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    ["Value A → B", selectedMatch.rubric.value_a_brings_to_b],
                    ["Value B → A", selectedMatch.rubric.value_b_brings_to_a],
                    ["Value Exchange", selectedMatch.rubric.value_exchange_score],
                    ["Credibility Match", selectedMatch.rubric.credibility_alignment],
                    ["Stage Alignment", selectedMatch.rubric.stage_alignment],
                    ["Goal Compatibility", selectedMatch.rubric.goal_compatibility],
                    ["Interest Overlap", selectedMatch.rubric.interest_overlap],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A" }}>{label.toUpperCase()}</span>
                        <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: val >= 70 ? "#A8FF3E" : val >= 50 ? "#FFB800" : "#FF6B35" }}>{val || "?"}</span>
                      </div>
                      <div style={{ height: "4px", background: "#1A1A2E", borderRadius: "2px" }}>
                        <div style={{ height: "100%", borderRadius: "2px", background: val >= 70 ? "#A8FF3E" : val >= 50 ? "#FFB800" : "#FF6B35", width: `${val || 0}%`, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  ))}
                </div>
                {selectedMatch.potential_red_flags && selectedMatch.potential_red_flags !== "none" && (
                  <div style={{ marginTop: "10px", fontSize: "11px", color: "#FF6B35", background: "#FF6B3511", border: "1px solid #FF6B3533", borderRadius: "6px", padding: "8px 10px" }}>
                    ⚠ {selectedMatch.potential_red_flags}
                  </div>
                )}
              </div>
            )}

            {/* Individual guest rubrics */}
            {(selectedMatch.guestA?.rubric || selectedMatch.guestB?.rubric) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                {[selectedMatch.guestA, selectedMatch.guestB].map((g, idx) => {
                  const r = g?.rubric;
                  if (!r) return null;
                  return (
                    <div key={idx} style={{ background: "#0F0F1A", borderRadius: "10px", padding: "12px" }}>
                      <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "8px" }}>{idx === 0 ? selectedMatch.nameA : selectedMatch.nameB} PROFILE SCORE</div>
                      <div style={{ fontSize: "20px", fontWeight: 700, color: "#B388FF", fontFamily: "'Space Mono', monospace", marginBottom: "8px" }}>{r.composite_score}/100</div>
                      <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FFB800", marginBottom: "4px" }}>Stage: {r.stage || "?"}</div>
                      {(r.top_3_value_props || []).map((v, i) => (
                        <div key={i} style={{ fontSize: "11px", color: "#8888AA", marginBottom: "3px" }}>✓ {v}</div>
                      ))}
                      {(r.red_flags || []).length > 0 && (
                        <div style={{ marginTop: "6px" }}>
                          {r.red_flags.map((f, i) => (
                            <div key={i} style={{ fontSize: "10px", color: "#FF6B35", marginBottom: "2px" }}>⚠ {f}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {deepLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#B388FF", fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "2px solid #2A2A4A", borderTopColor: "#B388FF", display: "inline-block", animation: "spin 0.8s linear infinite", marginBottom: "12px" }} />
                <div>ANALYZING COMPATIBILITY...</div>
              </div>
            ) : selectedMatch.deep ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

                <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "8px" }}>WHY THEY SHOULD MEET</div>
                  <div style={{ fontSize: "13px", color: "#E8E8F0", lineHeight: 1.6 }}>{selectedMatch.deep.why_they_should_meet}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "8px" }}>{selectedMatch.nameA.toUpperCase()} GETS</div>
                    <div style={{ fontSize: "12px", color: "#8888AA", lineHeight: 1.5 }}>{selectedMatch.deep.what_a_gets}</div>
                  </div>
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "8px" }}>{selectedMatch.nameB.toUpperCase()} GETS</div>
                    <div style={{ fontSize: "12px", color: "#8888AA", lineHeight: 1.5 }}>{selectedMatch.deep.what_b_gets}</div>
                  </div>
                </div>

                {selectedMatch.deep.conversation_starters?.length > 0 && (
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "10px" }}>CONVERSATION STARTERS</div>
                    {selectedMatch.deep.conversation_starters.map((s, i) => (
                      <div key={i} style={{ fontSize: "12px", color: "#8888AA", marginBottom: "6px" }}>💬 {s}</div>
                    ))}
                  </div>
                )}

                {selectedMatch.deep.potential_collaborations?.length > 0 && (
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "10px" }}>POTENTIAL COLLABORATIONS</div>
                    {selectedMatch.deep.potential_collaborations.map((s, i) => (
                      <div key={i} style={{ fontSize: "12px", color: "#8888AA", marginBottom: "6px" }}>🤝 {s}</div>
                    ))}
                  </div>
                )}

                {selectedMatch.deep.shared_context && (
                  <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "8px" }}>SHARED CONTEXT</div>
                    <div style={{ fontSize: "12px", color: "#8888AA" }}>{selectedMatch.deep.shared_context}</div>
                  </div>
                )}

                {selectedMatch.deep.intro_message && (
                  <div style={{ background: "#A8FF3E11", border: "1px solid #A8FF3E33", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E", marginBottom: "8px" }}>SUGGESTED INTRO MESSAGE</div>
                    <div style={{ fontSize: "13px", color: "#E8E8F0", lineHeight: 1.6, fontStyle: "italic" }}>"{selectedMatch.deep.intro_message}"</div>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedMatch.deep.intro_message)}
                      style={{ marginTop: "10px", background: "transparent", border: "1px solid #A8FF3E33", borderRadius: "6px", padding: "6px 12px", color: "#A8FF3E", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer" }}
                    >📋 COPY</button>
                  </div>
                )}

                <button
                  onClick={() => setIntroModal(selectedMatch)}
                  style={{ background: "linear-gradient(135deg, #A8FF3E, #4ADE80)", border: "none", borderRadius: "10px", padding: "12px", color: "#07070F", fontFamily: "'Space Mono', monospace", fontSize: "12px", cursor: "pointer" }}
                >
                  ✉ SEND INTRO VIA WHATSAPP
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px", color: "#5A5A7A", fontSize: "12px" }}>Loading analysis...</div>
            )}
          </div>
        </div>
      )}

      {/* Intro modal */}
      {introModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, backdropFilter: "blur(12px)" }}
          onClick={() => setIntroModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#0A0A18", border: "1px solid #A8FF3E33", borderRadius: "20px", width: "540px", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E", marginBottom: "4px" }}>✉ SEND INTRO</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#E8E8F0" }}>{introModal.nameA} × {introModal.nameB}</div>

            <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "8px" }}>INTRO HOOK</div>
              <div style={{ fontSize: "13px", color: "#E8E8F0", lineHeight: 1.6, fontStyle: "italic" }}>"{introModal.intro_hook}"</div>
            </div>

            <div style={{ background: "#0F0F1A", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", marginBottom: "8px" }}>SEND TO</div>
              <div style={{ fontSize: "13px", color: "#E8E8F0" }}>{introModal.guestA?.phone?.replace("whatsapp:", "")} ({introModal.nameA})</div>
              <div style={{ fontSize: "13px", color: "#E8E8F0", marginTop: "4px" }}>{introModal.guestB?.phone?.replace("whatsapp:", "")} ({introModal.nameB})</div>
            </div>

            <div style={{ fontSize: "12px", color: "#5A5A7A" }}>
              This will send a WhatsApp message via Sona to both guests introducing them to each other. Use the Railway admin endpoint to send.
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={async () => {
                  const msg = introModal.deep?.intro_message || introModal.intro_hook || `Hey! I wanted to introduce you to ${introModal.nameB} — I think you two would really hit it off. ${introModal.shared}`;
                  // Send to both guests via Railway
                  for (const phone of [introModal.guestA?.phone, introModal.guestB?.phone]) {
                    if (phone) {
                      await fetch(`${RAILWAY_URL}/admin/send-message`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ phone, message: msg }),
                      }).catch(() => {});
                    }
                  }
                  alert(`Intro sent to ${introModal.nameA} and ${introModal.nameB}!`);
                  setIntroModal(null);
                }}
                style={{ flex: 1, background: "linear-gradient(135deg, #A8FF3E, #4ADE80)", border: "none", borderRadius: "10px", padding: "13px", color: "#07070F", fontFamily: "'Space Mono', monospace", fontSize: "12px", cursor: "pointer" }}
              >✉ SEND INTRO TO BOTH</button>
              <button onClick={() => setIntroModal(null)} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "10px", padding: "13px 18px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Gmail Compose Modal ───────────────────────────────────────────────────────
function GmailModal({ vendor, draftContent, onClose, onSent }) {
  const [to, setTo] = useState(vendor?.email || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const hasEmail = to.trim().length > 0;

  useEffect(() => {
    if (!draftContent) return;
    const lines = draftContent.split("\n");
    let subjectLine = "";
    let bodyStart = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().startsWith("subject:")) {
        subjectLine = lines[i].replace(/^subject:\s*/i, "").trim();
        bodyStart = i + 1;
        break;
      }
    }
    if (!subjectLine) subjectLine = "Catering inquiry for our upcoming event";
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
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body: body.trim(), vendor_name: vendor?.name || "vendor" }),
      });
      const data = await resp.json();
      if (data.status === "sent") {
        setSent(true);
        onSent(vendor.id);
        setTimeout(onClose, 2000);
      } else {
        setError(data.error || "Failed to send.");
      }
    } catch { setError("Connection error."); }
    finally { setSending(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(12px)" }}>
      <div style={{ background: "#0C0C1A", border: "1px solid #1E1E35", borderRadius: "20px", width: "600px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #1E1E35", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#00D4FF", letterSpacing: "0.12em", marginBottom: "4px" }}>✉ COMPOSE EMAIL</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#E8E8F0" }}>{vendor?.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #1E1E35", borderRadius: "8px", width: "32px", height: "32px", color: "#5A5A7A", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "0 24px", overflowY: "auto", flex: 1 }}>
          <div style={{ borderBottom: "1px solid #1E1E35", padding: "14px 0", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", width: "60px", flexShrink: 0 }}>TO</div>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="vendor@email.com" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: hasEmail ? "#E8E8F0" : "#FF3E9A", fontFamily: "'DM Sans', sans-serif", fontSize: "14px" }} />
            {!hasEmail && <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FF3E9A", background: "#FF3E9A11", border: "1px solid #FF3E9A33", borderRadius: "6px", padding: "3px 8px", whiteSpace: "nowrap" }}>NO EMAIL FOUND</div>}
            {hasEmail && <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#A8FF3E", background: "#A8FF3E11", border: "1px solid #A8FF3E33", borderRadius: "6px", padding: "3px 8px" }}>✓</div>}
          </div>
          <div style={{ borderBottom: "1px solid #1E1E35", padding: "14px 0", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", width: "60px", flexShrink: 0 }}>SUBJECT</div>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "14px" }} />
          </div>
          <div style={{ padding: "16px 0", flex: 1 }}>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "14px", lineHeight: "1.7", resize: "vertical", minHeight: "240px" }} />
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1E1E35", display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={handleSend} disabled={!hasEmail || sending || sent} style={{ background: sent ? "linear-gradient(135deg, #A8FF3E, #4ADE80)" : hasEmail ? "linear-gradient(135deg, #00D4FF, #0088AA)" : "#1A1A2E", border: hasEmail ? "none" : "1px solid #2A2A4A", borderRadius: "10px", padding: "12px 28px", color: sent ? "#07070F" : hasEmail ? "white" : "#3A3A5A", fontFamily: "'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", cursor: hasEmail && !sending && !sent ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "8px" }}>
            {sent ? "✓ SENT" : sending ? <><span style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", display: "inline-block", animation: "spin 0.8s linear infinite" }} />SENDING...</> : "SEND →"}
          </button>
          {error && <div style={{ fontSize: "12px", color: "#FF3E9A" }}>{error}</div>}
          <div style={{ marginLeft: "auto", fontSize: "11px", color: "#3A3A5A", fontFamily: "'Space Mono', monospace" }}>SENDS FROM GMAIL</div>
        </div>
      </div>
    </div>
  );
}

// ── Vendor Card ───────────────────────────────────────────────────────────────
function VendorCard({ vendor, onDraftEmail, generatingFor, sentVendorIds }) {
  const [hoveringBtn, setHoveringBtn] = useState(false);
  const stars = "★".repeat(Math.floor(vendor.rating)) + (vendor.rating % 1 >= 0.5 ? "½" : "");
  const isGenerating = generatingFor === vendor.id;
  const isSent = sentVendorIds.has(vendor.id);
  const btnLabel = isGenerating ? null : isSent ? (hoveringBtn ? "↺ RESEND" : "✓ EMAILED") : "✉ DRAFT EMAIL";
  const btnStyle = { flex: 1, borderRadius: "8px", padding: "8px", background: isGenerating ? "#0A0A18" : isSent ? (hoveringBtn ? "linear-gradient(135deg,#00D4FF22,#00D4FF11)" : "linear-gradient(135deg,#A8FF3E18,#A8FF3E08)") : "linear-gradient(135deg,#00D4FF22,#00D4FF11)", border: isGenerating ? "1px solid #1A1A2E" : isSent ? (hoveringBtn ? "1px solid #00D4FF44" : "1px solid #A8FF3E44") : "1px solid #00D4FF44", color: isGenerating ? "#3A3A5A" : isSent ? (hoveringBtn ? "#00D4FF" : "#A8FF3E") : "#00D4FF", fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.05em", cursor: isGenerating ? "not-allowed" : "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" };
  return (
    <div style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "12px", overflow: "hidden", transition: "border-color 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = "#00D4FF33"} onMouseLeave={e => e.currentTarget.style.borderColor = "#1A1A2E"}>
      {vendor.image_url && (
        <div style={{ height: "120px", overflow: "hidden", position: "relative" }}>
          <img src={vendor.image_url} alt={vendor.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, #0A0A18)" }} />
          <div style={{ position: "absolute", bottom: "8px", left: "12px" }}><span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#00D4FF", background: "#0A0A18CC", padding: "2px 6px", borderRadius: "4px" }}>{vendor.categories?.[0]}</span></div>
          {isSent && <div style={{ position: "absolute", top: "8px", right: "8px", background: "#A8FF3ECC", borderRadius: "6px", padding: "3px 8px", fontSize: "9px", fontFamily: "'Space Mono', monospace", color: "#07070F" }}>✓ EMAILED</div>}
        </div>
      )}
      <div style={{ padding: "14px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#E8E8F0", marginBottom: "4px" }}>{vendor.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ color: "#FFB800", fontSize: "12px" }}>{stars}</span>
          <span style={{ fontSize: "12px", color: "#00D4FF", fontWeight: 600 }}>{vendor.rating}</span>
          <span style={{ fontSize: "11px", color: "#5A5A7A" }}>({vendor.review_count})</span>
          {vendor.price && vendor.price !== "N/A" && <span style={{ fontSize: "11px", color: "#A8FF3E" }}>{vendor.price}</span>}
          {vendor.score && <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#FF6B35", marginLeft: "auto" }}>↑{vendor.score}</span>}
        </div>
        {vendor.email && <div style={{ fontSize: "11px", color: "#A8FF3E", marginBottom: "6px" }}>✉ {vendor.email}</div>}
        {vendor.website && !vendor.email && <div style={{ fontSize: "11px", color: "#5A5A7A", marginBottom: "6px" }}>🌐 {vendor.website.replace("https://", "").replace("http://", "").split("/")[0]}</div>}
        {vendor.ai_reason && <div style={{ fontSize: "12px", color: "#8888AA", lineHeight: 1.5, marginBottom: "10px", fontStyle: "italic" }}>"{vendor.ai_reason}"</div>}
        <div style={{ fontSize: "11px", color: "#5A5A7A", marginBottom: "4px" }}>📍 {vendor.address}</div>
        {vendor.phone && vendor.phone !== "N/A" && <div style={{ fontSize: "11px", color: "#5A5A7A", marginBottom: "10px" }}>📞 {vendor.phone}</div>}
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => onDraftEmail(vendor)} disabled={isGenerating} style={btnStyle} onMouseEnter={() => setHoveringBtn(true)} onMouseLeave={() => setHoveringBtn(false)}>
            {isGenerating ? <><span style={{ width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #3A3A5A", borderTopColor: "#00D4FF", display: "inline-block", animation: "spin 0.8s linear infinite" }} />DRAFTING...</> : btnLabel}
          </button>
          <a href={vendor.url} target="_blank" rel="noopener noreferrer" style={{ padding: "8px 12px", background: "transparent", border: "1px solid #1A1A2E", borderRadius: "8px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "10px", textDecoration: "none", display: "flex", alignItems: "center" }}>YELP ↗</a>
        </div>
      </div>
    </div>
  );
}

// ── Vendor Search Panel ───────────────────────────────────────────────────────
function VendorSearchPanel({ event, onDraftEmail, vendors, setVendors, summary, setSummary, searched, setSearched, generatingFor, sentVendorIds }) {
  const [searchParams, setSearchParams] = useState({ keywords: "asian food", category: "caterers", budget: event.budget || "600", guest_count: event.guestCount || "50", min_rating: "4.25", location: event.city || "Los Angeles, CA" });
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const search = async () => {
    if (loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch(`${RAILWAY_URL}/search-vendors`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ ...searchParams, budget: parseFloat(searchParams.budget), guest_count: parseInt(searchParams.guest_count), min_rating: parseFloat(searchParams.min_rating), scrape_emails: true }) });
      const data = await response.json();
      setVendors(data.vendors || []);
      setSummary({ total: data.total, emails_found: data.emails_found });
      setSearched(true);
    } catch (err) { if (err.name !== "AbortError") console.error(err); }
    finally { setLoading(false); abortRef.current = null; }
  };
  const cancel = () => { if (abortRef.current) abortRef.current.abort(); };
  const handleKey = (e) => { if (e.key === "Enter" && !loading) search(); };
  const categories = ["caterers", "photographers", "venues", "florists", "dj", "bartenders", "decorators"];
  const iStyle = (d) => ({ width: "100%", background: d ? "#080810" : "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "8px 12px", color: d ? "#5A5A7A" : "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", outline: "none", boxSizing: "border-box" });
  const sentCount = vendors.filter(v => sentVendorIds.has(v.id)).length;
  return (
    <div style={{ padding: "28px", overflowY: "auto", height: "100%" }}>
      <div style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "16px", padding: "20px", marginBottom: "24px" }}>
        <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#00D4FF", letterSpacing: "0.1em", marginBottom: "16px" }}>🔍 VENDOR SEARCH · PRESS ENTER TO SEARCH</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          {[{ key: "keywords", label: "KEYWORDS", placeholder: "asian food..." }, { key: "budget", label: "MAX BUDGET ($)", placeholder: "600" }, { key: "guest_count", label: "GUEST COUNT", placeholder: "50" }, { key: "min_rating", label: "MIN RATING", placeholder: "4.25" }, { key: "location", label: "LOCATION", placeholder: "Los Angeles, CA" }].map(({ key, label, placeholder }) => (
            <div key={key}><div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>{label}</div><input value={searchParams[key]} onChange={e => setSearchParams(p => ({ ...p, [key]: e.target.value }))} onKeyDown={handleKey} placeholder={placeholder} disabled={loading} style={iStyle(loading)} /></div>
          ))}
          <div><div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>CATEGORY</div><select value={searchParams.category} onChange={e => setSearchParams(p => ({ ...p, category: e.target.value }))} onKeyDown={handleKey} disabled={loading} style={iStyle(loading)}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={loading ? undefined : search} disabled={loading} style={{ flex: 1, background: loading ? "#0A0A18" : "linear-gradient(135deg,#00D4FF,#0088AA)", border: loading ? "1px solid #1A1A2E" : "none", borderRadius: "10px", padding: "12px", color: loading ? "#3A3A5A" : "white", fontFamily: "'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            {loading && <span style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid #3A3A5A", borderTopColor: "#00D4FF", display: "inline-block", animation: "spin 0.8s linear infinite" }} />}
            {loading ? "SEARCHING..." : "SEARCH VENDORS →"}
          </button>
          {loading && <button onClick={cancel} style={{ background: "transparent", border: "1px solid #FF3E9A44", borderRadius: "10px", padding: "12px 18px", color: "#FF3E9A", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" }}>✕ CANCEL</button>}
        </div>
      </div>
      {searched && summary && (
        <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em", marginBottom: "16px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ color: "#5A5A7A" }}>{summary.total} VENDORS FOUND</span>
          <span style={{ color: "#A8FF3E" }}>{summary.emails_found} EMAILS FOUND</span>
          <span style={{ color: "#FF6B35" }}>RANKED BY SCORE ↑</span>
          {sentCount > 0 && <span style={{ color: "#A8FF3E", background: "#A8FF3E11", border: "1px solid #A8FF3E33", borderRadius: "6px", padding: "1px 8px" }}>✓ {sentCount} EMAILED</span>}
        </div>
      )}
      {searched && vendors.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>{vendors.map(v => <VendorCard key={v.id} vendor={v} onDraftEmail={onDraftEmail} generatingFor={generatingFor} sentVendorIds={sentVendorIds} />)}</div>}
      {!searched && <div style={{ textAlign: "center", padding: "60px 20px", color: "#3A3A5A" }}><div style={{ fontSize: "32px", marginBottom: "12px" }}>🤝</div><div style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>SEARCH FOR VENDORS ABOVE</div></div>}
    </div>
  );
}

// ── Setup Panel ───────────────────────────────────────────────────────────────
function SetupPanel({ event, onSave, onClose }) {
  const [form, setForm] = useState(event);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
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
    { key: "hostInstagram", label: "Instagram Handle", placeholder: "joeyeyo" },
    { key: "instagramFollowers", label: "Instagram Followers", placeholder: "900" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}>
      <div style={{ background: "#0A0A18", border: "1px solid #1A1A2E", borderRadius: "20px", width: "560px", maxHeight: "85vh", overflowY: "auto", padding: "32px" }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "24px", background: "linear-gradient(135deg,#FF6B35,#FF3E9A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.08em" }}>EVENT SETUP</div>
          <div style={{ fontSize: "13px", color: "#5A5A7A", marginTop: "6px" }}>Tell Sona about your event once — every response will be tailored to it.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>{label.toUpperCase()}</div>
              <input type="text" value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} style={{ width: "100%", background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "10px 14px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <div>
            <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", marginBottom: "6px" }}>ADDITIONAL CONTEXT</div>
            <textarea value={form.additionalContext} onChange={e => update("additionalContext", e.target.value)} placeholder="e.g. I want a DJ, open bar..." rows={3} style={{ width: "100%", background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "8px", padding: "10px 14px", color: "#E8E8F0", fontFamily: "'DM Sans', sans-serif", fontSize: "14px", outline: "none", resize: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
          <button onClick={() => { onSave(form); onClose(); }} style={{ flex: 1, background: "linear-gradient(135deg,#FF6B35,#FF3E9A)", border: "none", borderRadius: "10px", padding: "14px", color: "white", fontFamily: "'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", cursor: "pointer" }}>SAVE EVENT →</button>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #1A1A2E", borderRadius: "10px", padding: "14px 20px", color: "#5A5A7A", fontFamily: "'Space Mono', monospace", fontSize: "12px", cursor: "pointer" }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "14px 18px" }}>{[0, 1, 2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#FF6B35", animation: "bounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />)}</div>;
}

function Message({ msg, workstreams }) {
  const ws = workstreams.find(w => w.id === msg.workstream);
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: "12px", alignItems: "flex-start", marginBottom: "24px" }}>
      {msg.role === "assistant" && <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#FF3E9A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>S</div>}
      <div style={{ maxWidth: "75%", position: "relative" }}>
        <div style={{ background: msg.role === "user" ? "#1A1A2E" : "#0F0F1A", border: msg.role === "user" ? "1px solid #2A2A4A" : `1px solid ${ws?.color || "#FF6B35"}22`, borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px", padding: "14px 18px" }}>
          {msg.workstream && msg.role === "assistant" && ws && <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: ws.color, letterSpacing: "0.1em", marginBottom: "8px", textTransform: "uppercase" }}>{ws.icon} {ws.label}</div>}
          <div style={{ fontSize: "14px", lineHeight: "1.7", color: "#E8E8F0", whiteSpace: "pre-wrap", fontFamily: "'DM Sans', sans-serif" }}>{msg.content}</div>
        </div>
        {msg.role === "assistant" && (
          <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ position: "absolute", bottom: "-22px", right: "4px", background: "transparent", border: "none", cursor: "pointer", fontSize: "11px", fontFamily: "'Space Mono', monospace", color: copied ? "#A8FF3E" : "#3A3A5A", padding: "2px 6px" }}>
            {copied ? "COPIED ✓" : "COPY"}
          </button>
        )}
      </div>
    </div>
  );
}

const INITIAL_MESSAGE = (ws) => ({ role: "assistant", content: `Hey — I'm Sona. This is your ${ws} workspace.\n\nSet up your event using the ✦ button, then tell me what you need.`, workstream: ws });
const DEFAULT_ALL_MESSAGES = { marketing: [INITIAL_MESSAGE("marketing")], vendors: [INITIAL_MESSAGE("vendors")], logistics: [INITIAL_MESSAGE("logistics")] };
const DEFAULT_ALL_HISTORY = { marketing: [], vendors: [], logistics: [] };

export default function SonaAgent() {
  const [event, setEvent] = useState(() => { try { const s = localStorage.getItem("sona_event"); return s ? JSON.parse(s) : DEFAULT_EVENT; } catch { return DEFAULT_EVENT; } });
  const [showSetup, setShowSetup] = useState(() => { try { const s = localStorage.getItem("sona_event"); if (!s) return true; return !JSON.parse(s).name; } catch { return true; } });
  const [allMessages, setAllMessages] = useState(() => { try { const s = localStorage.getItem("sona_messages"); return s ? JSON.parse(s) : DEFAULT_ALL_MESSAGES; } catch { return DEFAULT_ALL_MESSAGES; } });
  const [allHistory, setAllHistory] = useState(() => { try { const s = localStorage.getItem("sona_history"); return s ? JSON.parse(s) : DEFAULT_ALL_HISTORY; } catch { return DEFAULT_ALL_HISTORY; } });
  const [sentVendorIds, setSentVendorIds] = useState(() => { try { const s = localStorage.getItem("sona_sent_vendors"); return new Set(s ? JSON.parse(s) : []); } catch { return new Set(); } });
  const [vendorResults, setVendorResults] = useState([]);
  const [vendorSummary, setVendorSummary] = useState(null);
  const [vendorSearched, setVendorSearched] = useState(false);
  const [generatingFor, setGeneratingFor] = useState(null);
  const [gmailModal, setGmailModal] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeWorkstream, setActiveWorkstream] = useState("guests");
  const [vendorView, setVendorView] = useState("search");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const chatWorkstreams = ["marketing", "vendors", "logistics"];
  const messages = allMessages[activeWorkstream] || [];
  const history = allHistory[activeWorkstream] || [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { try { localStorage.setItem("sona_messages", JSON.stringify(allMessages)); } catch {} }, [allMessages]);
  useEffect(() => { try { localStorage.setItem("sona_history", JSON.stringify(allHistory)); } catch {} }, [allHistory]);

  const markVendorSent = (vendorId) => {
    setSentVendorIds(prev => { const next = new Set(prev); next.add(vendorId); try { localStorage.setItem("sona_sent_vendors", JSON.stringify([...next])); } catch {} return next; });
  };

  const saveEvent = (newEvent) => {
    setEvent(newEvent);
    try { localStorage.setItem("sona_event", JSON.stringify(newEvent)); } catch {}
    setAllMessages(DEFAULT_ALL_MESSAGES);
    setAllHistory(DEFAULT_ALL_HISTORY);
    setActiveWorkstream("dashboard");
  };

  const sendMessage = async (text, ws) => {
    const workstream = ws || activeWorkstream;
    const currentHistory = allHistory[workstream] || [];
    const newHistory = [...currentHistory, { role: "user", content: text }];
    setAllMessages(prev => ({ ...prev, [workstream]: [...(prev[workstream] || []), { role: "user", content: text, workstream }] }));
    setAllHistory(prev => ({ ...prev, [workstream]: newHistory }));
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, system: buildSystemPrompt(event) + `\n\nCurrent workstream: ${WORKSTREAMS.find(w => w.id === workstream)?.label || ""}.`, messages: newHistory }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Something went wrong.";
      setAllMessages(prev => ({ ...prev, [workstream]: [...(prev[workstream] || []), { role: "assistant", content: reply, workstream }] }));
      setAllHistory(prev => ({ ...prev, [workstream]: [...(prev[workstream] || []), { role: "assistant", content: reply }] }));
    } catch {
      setAllMessages(prev => ({ ...prev, [workstream]: [...(prev[workstream] || []), { role: "assistant", content: "Error reaching the API.", workstream }] }));
    } finally { setLoading(false); }
  };

  const handleDraftEmail = async (vendor) => {
    setGeneratingFor(vendor.id);
    const emailLine = vendor.email ? `Their email is ${vendor.email}.` : `No email found — phone: ${vendor.phone}.`;
    const prompt = `Draft a professional outreach email to ${vendor.name} (${vendor.address}). ${emailLine} Event: ${event.name || "AI networking night"} on ${event.date || "upcoming"}, ${event.guestCount || "50"} guests, budget under $${event.budget || "600"}. Format:\n\nSubject: [subject]\n\n[body]`;
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, system: buildSystemPrompt(event), messages: [{ role: "user", content: prompt }] }),
      });
      const data = await response.json();
      setGmailModal({ vendor, draftContent: data.content?.[0]?.text || "" });
    } catch (e) { console.error(e); }
    finally { setGeneratingFor(null); }
  };

  const handleClear = () => {
    if (!chatWorkstreams.includes(activeWorkstream)) return;
    const reset = { ...allMessages, [activeWorkstream]: [INITIAL_MESSAGE(activeWorkstream)] };
    const resetHistory = { ...allHistory, [activeWorkstream]: [] };
    setAllMessages(reset);
    setAllHistory(resetHistory);
    if (activeWorkstream === "vendors") { setVendorResults([]); setVendorSummary(null); setVendorSearched(false); setVendorView("search"); }
  };

  const isDashboard = activeWorkstream === "dashboard";
  const isGuests = activeWorkstream === "guests";
  const isMatches = activeWorkstream === "matches";
  const isVendors = activeWorkstream === "vendors";
  const isChatTab = chatWorkstreams.includes(activeWorkstream);
  const ws = WORKSTREAMS.find(w => w.id === activeWorkstream);
  const eventConfigured = event.name || event.date || event.venue;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07070F; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2A2A4A; border-radius: 2px; }
        @keyframes bounce { 0%,80%,100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-6px); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ws-btn { background: transparent; border: 1px solid #1A1A2E; border-radius: 10px; padding: 12px 14px; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; }
        .ws-btn:hover { border-color: #2A2A4A; background: #0F0F1A; }
        .ws-btn.active { background: #0F0F1A; }
        .template-btn { background: #0A0A18; border: 1px solid #1A1A2E; border-radius: 8px; padding: 9px 12px; cursor: pointer; transition: all 0.15s; text-align: left; width: 100%; color: #8888AA; font-family: 'DM Sans',sans-serif; font-size: 12px; line-height: 1.4; }
        .template-btn:hover { background: #12121F; border-color: #2A2A4A; color: #E8E8F0; }
        .setup-btn { background: transparent; border: 1px solid #1A1A2E; border-radius: 10px; padding: 10px 14px; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; }
        .setup-btn:hover { border-color: #FF6B3544; background: #0F0F1A; }
        .send-btn { background: linear-gradient(135deg,#FF6B35,#FF3E9A); border: none; border-radius: 10px; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.2s; font-size: 16px; color: white; }
        .send-btn:hover { opacity: 0.85; } .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .msg-animate { animation: fadeIn 0.3s ease forwards; }
        .input-box { background: #0F0F1A; border: 1px solid #1A1A2E; border-radius: 14px; padding: 14px 14px 14px 18px; display: flex; align-items: flex-end; gap: 12px; cursor: text; }
        .clear-btn { background: transparent; border: 1px solid #1A1A2E; border-radius: 8px; padding: 8px; cursor: pointer; font-size: 11px; font-family: 'Space Mono',monospace; color: #3A3A5A; letter-spacing: 0.05em; transition: all 0.15s; width: 100%; }
        .clear-btn:hover { border-color: #FF3E9A44; color: #FF3E9A; }
        textarea, input, select { background: transparent; border: none; outline: none; color: #E8E8F0; font-family: 'DM Sans',sans-serif; font-size: 14px; resize: none; width: 100%; line-height: 1.5; }
        input::placeholder, textarea::placeholder { color: #3A3A5A; }
        select option { background: #0F0F1A; }
        input[type=range] { accent-color: #00D4FF; }
      `}</style>

      {showSetup && <SetupPanel event={event} onSave={saveEvent} onClose={() => setShowSetup(false)} />}
      {gmailModal && <GmailModal vendor={gmailModal.vendor} draftContent={gmailModal.draftContent} onClose={() => setGmailModal(null)} onSent={markVendorSent} />}

      <div style={{ display: "flex", height: "100vh", background: "#07070F", fontFamily: "'DM Sans',sans-serif" }}>
        {/* Sidebar */}
        <div style={{ width: "260px", flexShrink: 0, borderRight: "1px solid #0F0F1A", display: "flex", flexDirection: "column", padding: "24px 16px", gap: "8px", overflowY: "auto" }}>
          <div style={{ marginBottom: "20px", paddingLeft: "4px" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "42px", letterSpacing: "0.12em", background: "linear-gradient(135deg,#FF6B35,#FF3E9A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1, filter: "drop-shadow(0 0 20px #FF6B3566)" }}>SONA</div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "9px", color: "#FF6B3566", letterSpacing: "0.2em", marginTop: "4px" }}>EVENT INTELLIGENCE</div>
          </div>

          <button className="setup-btn" onClick={() => setShowSetup(true)} style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono',monospace", color: "#3A3A5A", letterSpacing: "0.1em", marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
              <span>ACTIVE EVENT</span><span style={{ color: "#FF6B35" }}>✦ EDIT</span>
            </div>
            {eventConfigured ? (
              <><div style={{ fontSize: "13px", fontWeight: 600, color: "#E8E8F0", lineHeight: 1.3 }}>{event.name || "Untitled Event"}</div><div style={{ fontSize: "11px", color: "#5A5A7A", marginTop: "4px" }}>{[event.date, event.venue, event.guestCount ? `${event.guestCount} guests` : null].filter(Boolean).join(" · ")}</div></>
            ) : <div style={{ fontSize: "13px", color: "#FF6B35" }}>+ Set up your event</div>}
          </button>

          <div style={{ fontSize: "10px", fontFamily: "'Space Mono',monospace", color: "#3A3A5A", letterSpacing: "0.1em", marginBottom: "6px", paddingLeft: "4px" }}>WORKSTREAMS</div>

          {WORKSTREAMS.map(w => (
            <button key={w.id} className={`ws-btn ${activeWorkstream === w.id ? "active" : ""}`} onClick={() => setActiveWorkstream(w.id)} style={{ borderColor: activeWorkstream === w.id ? w.color + "44" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{w.icon}</span>
                <div style={{ fontSize: "13px", fontWeight: 500, color: activeWorkstream === w.id ? w.color : "#8888AA", transition: "color 0.2s" }}>{w.label}</div>
              </div>
            </button>
          ))}

          {isChatTab && ws?.templates && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "10px", fontFamily: "'Space Mono',monospace", color: "#3A3A5A", letterSpacing: "0.1em", marginBottom: "8px", paddingLeft: "4px" }}>QUICK PROMPTS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {ws.templates.map((t, i) => <button key={i} className="template-btn" onClick={() => sendMessage(t, ws.id)} disabled={loading}>{t}</button>)}
              </div>
            </div>
          )}

          {isChatTab && (
            <button className="clear-btn" onClick={handleClear} style={{ marginTop: "auto" }}>
              RESET {activeWorkstream.toUpperCase()} ↺
            </button>
          )}
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: "16px 28px", borderBottom: "1px solid #0F0F1A", display: "flex", alignItems: "center", gap: "12px" }}>
            {ws && (
              <>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ws.color, boxShadow: `0 0 8px ${ws.color}` }} />
                <span style={{ fontSize: "13px", fontFamily: "'Space Mono',monospace", color: ws.color, letterSpacing: "0.08em" }}>{ws.label.toUpperCase()}</span>
                <span style={{ color: "#2A2A4A" }}>·</span>
                <span style={{ fontSize: "13px", color: "#5A5A7A" }}>
                  {isDashboard && "Budget · Countdown · Progress"}
                  {isGuests && "Onboarded guests · LinkedIn scraping · RSVP status"}
                  {isMatches && "AI-powered matchmaking · Deep analysis · Intro messages"}
                  {activeWorkstream === "marketing" && "Instagram, DMs, event copy"}
                  {isVendors && "Find & contact vendors"}
                  {activeWorkstream === "logistics" && "Timelines, checklists, run-of-show"}
                </span>
                {isVendors && (
                  <div style={{ marginLeft: "auto", display: "flex", gap: "4px", background: "#0F0F1A", borderRadius: "8px", padding: "4px" }}>
                    {["search", "chat"].map(v => (
                      <button key={v} onClick={() => setVendorView(v)} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.08em", background: vendorView === v ? "#00D4FF22" : "transparent", color: vendorView === v ? "#00D4FF" : "#5A5A7A", transition: "all 0.15s" }}>
                        {v.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Content */}
          {isDashboard ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <DashboardTab event={event} sentVendorIds={sentVendorIds} />
            </div>
          ) : isGuests ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <GuestsTab />
            </div>
          ) : isMatches ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <MatchesTab />
            </div>
          ) : isVendors && vendorView === "search" ? (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <VendorSearchPanel event={event} onDraftEmail={handleDraftEmail} vendors={vendorResults} setVendors={setVendorResults} summary={vendorSummary} setSummary={setVendorSummary} searched={vendorSearched} setSearched={setVendorSearched} generatingFor={generatingFor} sentVendorIds={sentVendorIds} />
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "28px" }}>
                {messages.map((msg, i) => <div key={i} className="msg-animate"><Message msg={msg} workstreams={WORKSTREAMS} /></div>)}
                {loading && (
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "24px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#FF3E9A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>S</div>
                    <div style={{ background: "#0F0F1A", border: "1px solid #FF6B3522", borderRadius: "4px 18px 18px 18px" }}><TypingIndicator /></div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #0F0F1A" }}>
                <div className="input-box" onClick={() => textareaRef.current?.focus()}>
                  <textarea ref={textareaRef} rows={1} value={input}
                    onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim() && !loading) sendMessage(input.trim()); } }}
                    placeholder={`Ask Sona about ${ws?.label.toLowerCase() || "your event"}...`}
                    style={{ maxHeight: "120px", alignSelf: "stretch" }} />
                  <button className="send-btn" onClick={() => input.trim() && !loading && sendMessage(input.trim())} disabled={!input.trim() || loading}>↑</button>
                </div>
                <div style={{ fontSize: "11px", fontFamily: "'Space Mono',monospace", color: "#2A2A4A", textAlign: "center", marginTop: "10px", letterSpacing: "0.05em" }}>SHIFT+ENTER FOR NEW LINE · ENTER TO SEND</div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
