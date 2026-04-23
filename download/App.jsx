import { useState, useRef, useEffect } from "react";

const WORKSTREAMS = [
  {
    id: "marketing",
    label: "Marketing",
    icon: "📣",
    color: "#FF6B35",
    templates: [
      "Write 3 Instagram posts for my event",
      "Create a posting schedule for the next 3 weeks",
      "Write DM outreach copy for my network",
      "Write an event description for the invite page",
    ],
  },
  {
    id: "vendors",
    label: "Vendors",
    icon: "🤝",
    color: "#00D4FF",
    templates: [
      "Draft a cold email to a photographer",
      "Write outreach to a catering vendor",
      "Draft a venue inquiry email",
      "Compare vendor quotes and recommend one",
    ],
  },
  {
    id: "guests",
    label: "Guests",
    icon: "👥",
    color: "#A8FF3E",
    templates: [
      "Write personalized invitation messages",
      "Draft a WhatsApp blast for my network",
      "Write an RSVP reminder message",
      "Create a waitlist response message",
    ],
  },
  {
    id: "logistics",
    label: "Logistics",
    icon: "📋",
    color: "#FF3E9A",
    templates: [
      "Generate a full planning timeline",
      "Create a day-of run-of-show",
      "Build a vendor confirmation checklist",
      "Write a day-of setup checklist",
    ],
  },
];

const DEFAULT_EVENT = {
  name: "",
  date: "",
  venue: "",
  neighborhood: "",
  city: "Los Angeles",
  guestCount: "",
  budget: "",
  vibe: "",
  audience: "Asian tech founders",
  hostName: "",
  hostInstagram: "",
  instagramFollowers: "",
  additionalContext: "",
};

function buildSystemPrompt(event) {
  const hasEvent = event.name || event.date || event.venue;
  if (!hasEvent) {
    return `You are Sona, an expert AI event planner specializing in curated networking events for tech founders. No event has been configured yet — if the user asks about planning, gently remind them to set up their event details first using the setup panel.`;
  }

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
- Instagram: ${event.hostInstagram ? `@${event.hostInstagram}` : "N/A"} (${event.instagramFollowers || "~900"} followers, mostly entrepreneurs)
${event.additionalContext ? `- Additional context: ${event.additionalContext}` : ""}

YOUR ROLE:
Generate ready-to-use content the host can copy and send immediately with minimal editing. Be specific, use the actual event name, date, and venue in your outputs. Write like a founder, not a marketer — authentic, punchy, no corporate speak. When writing Instagram content, make it feel personal and real. Always reference the specific event details above.`;
}

function SetupPanel({ event, onSave, onClose }) {
  const [form, setForm] = useState(event);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const fields = [
    { key: "name", label: "Event Name", placeholder: "Sona AI Night" },
    { key: "date", label: "Date", placeholder: "May 15, 2026" },
    { key: "venue", label: "Venue Name", placeholder: "The Highlight Room" },
    { key: "neighborhood", label: "Neighborhood", placeholder: "Hollywood" },
    { key: "city", label: "City", placeholder: "Los Angeles" },
    { key: "guestCount", label: "Expected Guests", placeholder: "50" },
    { key: "budget", label: "Total Budget ($)", placeholder: "3000" },
    { key: "vibe", label: "Vibe / Theme", placeholder: "Intimate founder salon, dark academia meets tech" },
    { key: "audience", label: "Target Audience", placeholder: "Asian early-stage tech founders" },
    { key: "hostName", label: "Your Name", placeholder: "Joe" },
    { key: "hostInstagram", label: "Your Instagram Handle", placeholder: "joeyeyo" },
    { key: "instagramFollowers", label: "Instagram Followers", placeholder: "900" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, backdropFilter: "blur(8px)",
    }}>
      <div style={{
        background: "#0A0A18", border: "1px solid #1A1A2E",
        borderRadius: "20px", width: "560px", maxHeight: "85vh",
        overflowY: "auto", padding: "32px",
      }}>
        <div style={{ marginBottom: "28px" }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: "24px",
            background: "linear-gradient(135deg, #FF6B35, #FF3E9A)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            letterSpacing: "0.08em",
          }}>EVENT SETUP</div>
          <div style={{ fontSize: "13px", color: "#5A5A7A", marginTop: "6px", fontFamily: "'DM Sans', sans-serif" }}>
            Tell Sona about your event once. Every response will be tailored to your specific details.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", letterSpacing: "0.08em", marginBottom: "6px" }}>
                {label.toUpperCase()}
              </div>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={placeholder}
                style={{
                  width: "100%", background: "#0F0F1A", border: "1px solid #1A1A2E",
                  borderRadius: "8px", padding: "10px 14px", color: "#E8E8F0",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "14px", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}

          <div>
            <div style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#5A5A7A", letterSpacing: "0.08em", marginBottom: "6px" }}>
              ANYTHING ELSE SONA SHOULD KNOW
            </div>
            <textarea
              value={form.additionalContext}
              onChange={(e) => update("additionalContext", e.target.value)}
              placeholder="e.g. I want a DJ, no formal speeches, open bar, targeting Series A founders..."
              rows={3}
              style={{
                width: "100%", background: "#0F0F1A", border: "1px solid #1A1A2E",
                borderRadius: "8px", padding: "10px 14px", color: "#E8E8F0",
                fontFamily: "'DM Sans', sans-serif", fontSize: "14px", outline: "none",
                resize: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
          <button
            onClick={() => { onSave(form); onClose(); }}
            style={{
              flex: 1, background: "linear-gradient(135deg, #FF6B35, #FF3E9A)",
              border: "none", borderRadius: "10px", padding: "14px",
              color: "white", fontFamily: "'Space Mono', monospace",
              fontSize: "12px", letterSpacing: "0.08em", cursor: "pointer",
            }}
          >
            SAVE EVENT →
          </button>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid #1A1A2E",
              borderRadius: "10px", padding: "14px 20px",
              color: "#5A5A7A", fontFamily: "'Space Mono', monospace",
              fontSize: "12px", cursor: "pointer",
            }}
          >
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
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: "#FF6B35", animation: "bounce 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function Message({ msg, workstreams }) {
  const ws = workstreams.find((w) => w.id === msg.workstream);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row",
      gap: "12px", alignItems: "flex-start", marginBottom: "24px",
    }}>
      {msg.role === "assistant" && (
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%",
          background: "linear-gradient(135deg, #FF6B35, #FF3E9A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "14px", flexShrink: 0, marginTop: "2px",
        }}>S</div>
      )}
      <div style={{ maxWidth: "75%", position: "relative" }}>
        <div style={{
          background: msg.role === "user" ? "#1A1A2E" : "#0F0F1A",
          border: msg.role === "user" ? "1px solid #2A2A4A" : `1px solid ${ws?.color || "#FF6B35"}22`,
          borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
          padding: "14px 18px",
        }}>
          {msg.workstream && msg.role === "assistant" && ws && (
            <div style={{
              fontSize: "10px", fontFamily: "'Space Mono', monospace",
              color: ws.color, letterSpacing: "0.1em", marginBottom: "8px", textTransform: "uppercase",
            }}>
              {ws.icon} {ws.label}
            </div>
          )}
          <div style={{
            fontSize: "14px", lineHeight: "1.7", color: "#E8E8F0",
            whiteSpace: "pre-wrap", fontFamily: "'DM Sans', sans-serif",
          }}>
            {msg.content}
          </div>
        </div>
        {msg.role === "assistant" && (
          <button onClick={copy} style={{
            position: "absolute", bottom: "-22px", right: "4px",
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: "11px", fontFamily: "'Space Mono', monospace",
            color: copied ? "#A8FF3E" : "#3A3A5A", letterSpacing: "0.05em",
            padding: "2px 6px",
          }}>
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

export default function SonaAgent() {
  const [event, setEvent] = useState(() => {
    try {
      const saved = localStorage.getItem("sona_event");
      return saved ? JSON.parse(saved) : DEFAULT_EVENT;
    } catch { return DEFAULT_EVENT; }
  });

  const [showSetup, setShowSetup] = useState(() => {
    try {
      const saved = localStorage.getItem("sona_event");
      if (!saved) return true;
      const e = JSON.parse(saved);
      return !e.name;
    } catch { return true; }
  });

  const [allMessages, setAllMessages] = useState({
    marketing: [INITIAL_MESSAGE("marketing")],
    vendors: [INITIAL_MESSAGE("vendors")],
    guests: [INITIAL_MESSAGE("guests")],
    logistics: [INITIAL_MESSAGE("logistics")],
  });

  const [allHistory, setAllHistory] = useState({
    marketing: [], vendors: [], guests: [], logistics: [],
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeWorkstream, setActiveWorkstream] = useState("marketing");
  const bottomRef = useRef(null);

  const messages = allMessages[activeWorkstream];
  const history = allHistory[activeWorkstream];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const saveEvent = (newEvent) => {
    setEvent(newEvent);
    try { localStorage.setItem("sona_event", JSON.stringify(newEvent)); } catch {}
    setAllMessages({
      marketing: [{ role: "assistant", content: `Event saved! I now know everything about ${newEvent.name || "your event"}${newEvent.date ? ` on ${newEvent.date}` : ""}${newEvent.venue ? ` at ${newEvent.venue}` : ""}.\n\nEvery response from here will be tailored to your actual event. What do you need first?`, workstream: "marketing" }],
      vendors: [INITIAL_MESSAGE("vendors")],
      guests: [INITIAL_MESSAGE("guests")],
      logistics: [INITIAL_MESSAGE("logistics")],
    });
    setAllHistory({ marketing: [], vendors: [], guests: [], logistics: [] });
  };

  const sendMessage = async (text, workstreamId) => {
    const ws = workstreamId || activeWorkstream;
    const currentHistory = allHistory[ws];
    const userMsg = { role: "user", content: text, workstream: ws };
    const newHistory = [...currentHistory, { role: "user", content: text }];

    setAllMessages((prev) => ({ ...prev, [ws]: [...prev[ws], userMsg] }));
    setAllHistory((prev) => ({ ...prev, [ws]: newHistory }));
    setInput("");
    setLoading(true);

    const wsLabel = WORKSTREAMS.find((w) => w.id === ws)?.label || "";

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
          system: buildSystemPrompt(event) + `\n\nCurrent workstream: ${wsLabel}. Tailor your response to this area.`,
          messages: newHistory,
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || "Something went wrong. Try again.";
      const assistantMsg = { role: "assistant", content: reply, workstream: ws };

      setAllMessages((prev) => ({ ...prev, [ws]: [...prev[ws], assistantMsg] }));
      setAllHistory((prev) => ({ ...prev, [ws]: [...prev[ws], { role: "assistant", content: reply }] }));
    } catch (err) {
      setAllMessages((prev) => ({
        ...prev,
        [ws]: [...prev[ws], { role: "assistant", content: "Error reaching the API. Check your connection.", workstream: ws }],
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !loading) sendMessage(input.trim());
    }
  };

  const eventConfigured = event.name || event.date || event.venue;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07070F; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A2A4A; border-radius: 2px; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ws-btn {
          background: transparent; border: 1px solid #1A1A2E;
          border-radius: 10px; padding: 12px 14px; cursor: pointer;
          transition: all 0.2s ease; text-align: left; width: 100%;
        }
        .ws-btn:hover { border-color: #2A2A4A; background: #0F0F1A; }
        .ws-btn.active { background: #0F0F1A; }
        .template-btn {
          background: #0A0A18; border: 1px solid #1A1A2E; border-radius: 8px;
          padding: 9px 12px; cursor: pointer; transition: all 0.15s ease;
          text-align: left; width: 100%; color: #8888AA;
          font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.4;
        }
        .template-btn:hover { background: #12121F; border-color: #2A2A4A; color: #E8E8F0; }
        .setup-btn {
          background: transparent; border: 1px solid #1A1A2E; border-radius: 10px;
          padding: 10px 14px; cursor: pointer; transition: all 0.2s ease; text-align: left; width: 100%;
        }
        .setup-btn:hover { border-color: #FF6B3544; background: #0F0F1A; }
        .send-btn {
          background: linear-gradient(135deg, #FF6B35, #FF3E9A); border: none;
          border-radius: 10px; width: 40px; height: 40px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: opacity 0.2s; font-size: 16px;
        }
        .send-btn:hover { opacity: 0.85; }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .msg-animate { animation: fadeIn 0.3s ease forwards; }
        textarea, input {
          background: transparent; border: none; outline: none;
          color: #E8E8F0; font-family: 'DM Sans', sans-serif;
          font-size: 14px; resize: none; width: 100%; line-height: 1.5;
        }
        input::placeholder, textarea::placeholder { color: #3A3A5A; }
      `}</style>

      {showSetup && (
        <SetupPanel event={event} onSave={saveEvent} onClose={() => setShowSetup(false)} />
      )}

      <div style={{ display: "flex", height: "100vh", background: "#07070F", fontFamily: "'DM Sans', sans-serif" }}>
        {/* Sidebar */}
        <div style={{
          width: "260px", flexShrink: 0, borderRight: "1px solid #0F0F1A",
          display: "flex", flexDirection: "column", padding: "24px 16px",
          gap: "8px", overflowY: "auto",
        }}>
          <div style={{ marginBottom: "20px", paddingLeft: "4px" }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: "28px",
              letterSpacing: "0.08em",
              background: "linear-gradient(135deg, #FF6B35, #FF3E9A)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1,
            }}>SONA</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "#3A3A5A", letterSpacing: "0.15em", marginTop: "3px" }}>
              EVENT INTELLIGENCE
            </div>
          </div>

          <button className="setup-btn" onClick={() => setShowSetup(true)} style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", letterSpacing: "0.1em", marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
              <span>ACTIVE EVENT</span>
              <span style={{ color: "#FF6B35" }}>✦ EDIT</span>
            </div>
            {eventConfigured ? (
              <>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#E8E8F0", lineHeight: 1.3 }}>
                  {event.name || "Untitled Event"}
                </div>
                <div style={{ fontSize: "11px", color: "#5A5A7A", marginTop: "4px" }}>
                  {[event.date, event.venue, event.guestCount ? `${event.guestCount} guests` : null].filter(Boolean).join(" · ")}
                </div>
              </>
            ) : (
              <div style={{ fontSize: "13px", color: "#FF6B35" }}>+ Set up your event</div>
            )}
          </button>

          <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", letterSpacing: "0.1em", marginBottom: "6px", paddingLeft: "4px" }}>
            WORKSTREAMS
          </div>

          {WORKSTREAMS.map((ws) => (
            <button
              key={ws.id}
              className={`ws-btn ${activeWorkstream === ws.id ? "active" : ""}`}
              onClick={() => setActiveWorkstream(ws.id)}
              style={{ borderColor: activeWorkstream === ws.id ? ws.color + "44" : undefined }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{ws.icon}</span>
                <div style={{
                  fontSize: "13px", fontWeight: 500,
                  color: activeWorkstream === ws.id ? ws.color : "#8888AA",
                  transition: "color 0.2s",
                }}>{ws.label}</div>
              </div>
            </button>
          ))}

          {(() => {
            const ws = WORKSTREAMS.find((w) => w.id === activeWorkstream);
            return ws ? (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A", letterSpacing: "0.1em", marginBottom: "8px", paddingLeft: "4px" }}>
                  QUICK PROMPTS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {ws.templates.map((t, i) => (
                    <button key={i} className="template-btn" onClick={() => sendMessage(t, ws.id)} disabled={loading}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          <button
            onClick={() => {
              setAllMessages((prev) => ({ ...prev, [activeWorkstream]: [INITIAL_MESSAGE(activeWorkstream)] }));
              setAllHistory((prev) => ({ ...prev, [activeWorkstream]: [] }));
            }}
            style={{
              marginTop: "auto", background: "transparent", border: "1px solid #1A1A2E",
              borderRadius: "8px", padding: "8px", cursor: "pointer",
              fontSize: "11px", fontFamily: "'Space Mono', monospace",
              color: "#3A3A5A", letterSpacing: "0.05em",
            }}
          >
            CLEAR CHAT
          </button>
        </div>

        {/* Main chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "20px 28px", borderBottom: "1px solid #0F0F1A", display: "flex", alignItems: "center", gap: "12px" }}>
            {(() => {
              const ws = WORKSTREAMS.find((w) => w.id === activeWorkstream);
              return ws ? (
                <>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ws.color, boxShadow: `0 0 8px ${ws.color}` }} />
                  <span style={{ fontSize: "13px", fontFamily: "'Space Mono', monospace", color: ws.color, letterSpacing: "0.08em" }}>
                    {ws.label.toUpperCase()}
                  </span>
                  <span style={{ color: "#2A2A4A", fontSize: "13px" }}>·</span>
                  <span style={{ fontSize: "13px", color: "#5A5A7A" }}>
                    {ws.id === "marketing" && "Instagram, DMs, event copy"}
                    {ws.id === "vendors" && "Photographers, catering, venues"}
                    {ws.id === "guests" && "Invitations, RSVPs, reminders"}
                    {ws.id === "logistics" && "Timelines, checklists, run-of-show"}
                  </span>
                  {eventConfigured && (
                    <>
                      <span style={{ color: "#2A2A4A", fontSize: "13px", marginLeft: "auto" }}>·</span>
                      <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#3A3A5A" }}>
                        {event.name}
                      </span>
                    </>
                  )}
                </>
              ) : null;
            })()}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "28px" }}>
            {messages.map((msg, i) => (
              <div key={i} className="msg-animate">
                <Message msg={msg} workstreams={WORKSTREAMS} />
              </div>
            ))}
            {loading && activeWorkstream === activeWorkstream && (
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "24px" }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #FF6B35, #FF3E9A)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", flexShrink: 0,
                }}>S</div>
                <div style={{ background: "#0F0F1A", border: "1px solid #FF6B3522", borderRadius: "4px 18px 18px 18px" }}>
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: "16px 28px 24px", borderTop: "1px solid #0F0F1A" }}>
            <div style={{
              background: "#0F0F1A", border: "1px solid #1A1A2E", borderRadius: "14px",
              padding: "14px 14px 14px 18px", display: "flex", alignItems: "flex-end", gap: "12px",
            }}>
              <textarea
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKey}
                placeholder={`Ask Sona about ${WORKSTREAMS.find(w => w.id === activeWorkstream)?.label.toLowerCase()}...`}
                style={{ maxHeight: "120px" }}
              />
              <button
                className="send-btn"
                onClick={() => input.trim() && !loading && sendMessage(input.trim())}
                disabled={!input.trim() || loading}
              >↑</button>
            </div>
            <div style={{
              fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#2A2A4A",
              textAlign: "center", marginTop: "10px", letterSpacing: "0.05em",
            }}>
              SHIFT+ENTER FOR NEW LINE · ENTER TO SEND
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
