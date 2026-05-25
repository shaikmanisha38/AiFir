import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ShieldAlert, Mic, MicOff, Volume2, VolumeX, FileText, Edit, Printer,
  Home, User, Phone, MapPin, Calendar, AlertTriangle, Cpu,
  UserX, EyeOff, ShieldCheck, ArrowRight, Check, Loader,
  Car, Package, Languages
} from "lucide-react";
import { WebSpeechRecognition, WebSpeechSynthesis } from "./utils/speech";
import AudioVisualizer from "./components/AudioVisualizer";
import { detectLanguage, LANG_NAMES, LANG_TTS } from "./utils/language";
import { downloadFIR } from "./utils/pdf";

const API = "http://localhost:8000";

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || "Request failed");
  }
  return res.json();
}

// ─── Constants ───────────────────────────────────────────
const EMPTY_FIR = {
  victim_name: "", victim_contact: "", incident_date_time: "",
  incident_location: "", suspect_details: "", stolen_item: "",
  vehicle_number: "", evidence: "", description: ""
};

const COMPLAINT_TYPES = [
  { name: "Theft / Burglary",          icon: Package,  color: "#3b82f6" },
  { name: "Physical Assault / Threat", icon: AlertTriangle, color: "#f59e0b" },
  { name: "Harassment / Stalking",     icon: EyeOff,   color: "#ec4899" },
  { name: "Cyber Crime / Fraud",       icon: Cpu,      color: "#10b981" },
  { name: "Missing Person",            icon: UserX,    color: "#a855f7" },
  { name: "Vehicle Theft / Accident",  icon: Car,      color: "#f97316" },
  { name: "General / Other",           icon: FileText, color: "#64748b" },
];

const EXTRACTION_FIELDS = [
  { key: "victim_name",        label: "Name",              icon: User,     span: 1 },
  { key: "victim_contact",     label: "Contact",           icon: Phone,    span: 1 },
  { key: "incident_location",  label: "Location",          icon: MapPin,   span: 1 },
  { key: "incident_date_time", label: "Date / Time",       icon: Calendar, span: 1 },
  { key: "suspect_details",    label: "Suspect",           icon: UserX,    span: 2 },
  { key: "stolen_item",        label: "Stolen Item",       icon: Package,  span: 1 },
  { key: "vehicle_number",     label: "Vehicle No.",       icon: Car,      span: 1 },
  { key: "evidence",           label: "Evidence",          icon: EyeOff,   span: 2 },
];

const MIC_STATE = { IDLE: "idle", LISTENING: "listening", SPEAKING: "speaking", PROCESSING: "processing" };

// ─── Client-side extraction helpers ────────────────────────
function extractPhone(t) {
  const wordMap = { zero:"0", one:"1", two:"2", three:"3", four:"4", five:"5", six:"6", seven:"7", eight:"8", nine:"9", oh:"0" };
  let c = t.toLowerCase();
  for (const [w, d] of Object.entries(wordMap)) c = c.replace(new RegExp(`\\b${w}\\b`, "g"), d);
  const digits = c.replace(/\D/g, "");
  const m10 = digits.match(/\d{10}/);
  return m10 ? m10[0] : null;
}

function extractVehicle(t) {
  const m = t.match(/\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{1,4}\b/i);
  return m ? m[0].toUpperCase() : null;
}

function extractName(t) {
  const m = t.match(/(?:my name is|i am|this is|name is)\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)/i);
  return m ? m[1].trim() : null;
}

function extractLocation(t) {
  const m = t.match(/(?:at|in|near|outside|happened at|occurred at|place is)\s+([A-Za-z0-9][A-Za-z0-9\s,]{3,60}?)\s*(?:\.|,|yesterday|today|last|this morning|this evening|at\s+\d|$)/i);
  return m ? m[1].trim() : null;
}

function extractDateTime(t) {
  const m = t.match(/(?:yesterday|today|last night|this morning|this evening|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
  return m ? m[0].trim() : null;
}

function extractSuspect(t) {
  const m = t.match(/(?:suspect|thief|attacker)\s+(?:was|wore|had|is)\s+([^.]{5,80})/i);
  return m ? m[0].trim() : null;
}

function extractStolenItem(t) {
  const m = t.match(/(?:stole|stolen|took|taken|robbe?d|snatched?)\s+(?:my\s+)?([^.]{3,60})/i);
  return m ? m[1].trim() : null;
}

function extractEvidence(t) {
  const m = t.match(/(?:cctv|camera|witness|video|photo|recording|evidence)[^.\n]{0,60}/i);
  return m ? m[0].trim() : null;
}

// ─── Client-side fallback ─────────────────────────────────
function clientSideProcess(text, existing, history, turn, cType) {
  const updated = { ...existing };
  const userMsgs = [...history.filter(m => m.role === "user").map(m => m.content), text];
  const full = userMsgs.join(" ");

  const lang = detectLanguage(text);

  // Last asked field
  const lastBot = [...history].reverse().find(m => m.role === "assistant");
  const lastQ = lastBot?.content?.toLowerCase() || "";

  // Keyword-based extraction from last question
  if (lastQ.includes("name"))       updated.victim_name        ||= text.trim().replace(/\b\w/g, c => c.toUpperCase());
  if (lastQ.includes("contact") || lastQ.includes("phone") || lastQ.includes("number") || lastQ.includes("mobile"))
    updated.victim_contact ||= text.replace(/\D/g, "").slice(0, 10) || text.trim();
  if (lastQ.includes("location") || lastQ.includes("where"))  updated.incident_location  ||= text.trim();
  if (lastQ.includes("date") || lastQ.includes("time"))       updated.incident_date_time ||= text.trim();
  if (lastQ.includes("suspect") || lastQ.includes("thief") || lastQ.includes("attacker"))
    updated.suspect_details ||= text.trim();
  if (lastQ.includes("stolen") || lastQ.includes("items") || lastQ.includes("taken"))
    updated.stolen_item ||= text.trim();
  if (lastQ.includes("vehicle") || lastQ.includes("car") || lastQ.includes("bike"))
    updated.vehicle_number ||= text.trim();
  if (lastQ.includes("evidence") || lastQ.includes("cctv") || lastQ.includes("witness"))
    updated.evidence ||= text.trim();

  // Deep regex extraction from all user speech
  if (!updated.victim_name) {
    const n = extractName(full);
    if (n) updated.victim_name = n.replace(/\b\w/g, c => c.toUpperCase());
  }
  if (!updated.victim_contact) {
    const p = extractPhone(full);
    if (p) updated.victim_contact = p;
  }
  if (!updated.victim_contact && text.trim()) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i]?.role === "assistant" && history[i].content.toLowerCase().match(/(contact|phone|number|mobile)/)) {
        updated.victim_contact = text.trim();
        break;
      }
    }
  }
  if (!updated.incident_location) {
    const l = extractLocation(full);
    if (l) updated.incident_location = l;
  }
  if (!updated.incident_date_time) {
    const d = extractDateTime(full);
    if (d) updated.incident_date_time = d;
  }
  if (!updated.suspect_details) {
    const s = extractSuspect(full);
    if (s) updated.suspect_details = s;
  }
  if (!updated.stolen_item) {
    const s = extractStolenItem(full);
    if (s) updated.stolen_item = s;
  }
  if (!updated.vehicle_number) {
    const v = extractVehicle(full);
    if (v) updated.vehicle_number = v;
  }
  if (!updated.evidence) {
    const e = extractEvidence(full);
    if (e) updated.evidence = e;
  }

  updated.description = full.slice(0, 1000);

  const allFields = ["victim_name","victim_contact","incident_location","incident_date_time","suspect_details","stolen_item","vehicle_number","evidence"];
  const done = turn >= 8 || allFields.every(f => updated[f]);

  const questions = {
    en: [
      ["victim_name",        "To register your complaint, could you please tell me your full name?"],
      ["victim_contact",     "What is your 10-digit contact number?"],
      ["incident_location",  "Where exactly did this incident take place?"],
      ["incident_date_time", "What was the date and approximate time of the incident?"],
      ["suspect_details",    "Can you describe the suspect or attacker?"],
      ["stolen_item",        "What items were stolen or taken? Describe them."],
      ["vehicle_number",     "What is the vehicle number involved?"],
      ["evidence",           "Is there any CCTV, witnesses, or evidence available?"],
    ],
    hi: [
      ["victim_name",        "अपनी शिकायत दर्ज कराने के लिए, कृपया मुझे अपना पूरा नाम बताएं?"],
      ["victim_contact",     "आपका 10 अंकों का संपर्क नंबर क्या है?"],
      ["incident_location",  "घटना कहां हुई? कृपया स्थान या पता बताएं।"],
      ["incident_date_time", "यह घटना कब हुई? तारीख और समय बताएं।"],
      ["suspect_details",    "क्या आप संदिग्ध का वर्णन कर सकते हैं?"],
      ["stolen_item",        "क्या सामान चोरी हुआ? उनका वर्णन करें।"],
      ["vehicle_number",     "वाहन नंबर क्या है?"],
      ["evidence",           "क्या कोई सीसीटीवी या गवाह है?"],
    ],
    te: [
      ["victim_name",        "మీ ఫిర్యాదును నమోదు చేయడానికి, దయచేసి మీ పూర్తి పేరు చెప్పగలరా?"],
      ["victim_contact",     "మీ 10 అంకెల సంప్రదింపు నంబర్ ఏమిటి?"],
      ["incident_location",  "సంఘటన ఎక్కడ జరిగింది? స్థలం లేదా చిరునామా ఇవ్వండి."],
      ["incident_date_time", "ఇది ఎప్పుడు జరిగింది? తేదీ మరియు సమయం చెప్పండి."],
      ["suspect_details",    "మీరు నిందితుడిని వివరించగలరా?"],
      ["stolen_item",        "ఏ వస్తువులు చోరీ అయ్యాయి? వాటిని వివరించండి."],
      ["vehicle_number",     "వాహన నంబర్ ఏమిటి?"],
      ["evidence",           "సీసీటీవీ లేదా సాక్షులు ఉన్నారా?"],
    ],
  };

  const qs = questions[lang] || questions.en;
  const nextQ = done
    ? (lang === "hi" ? "धन्यवाद। आपका FIR फॉर्म तैयार है। कृपया 'Review Form' पर टैप करें।" :
       lang === "te" ? "ధన్యవాదాలు. మీ FIR ఫారమ్ సిద్ధంగా ఉంది. దయచేసి 'Review Form' నొక్కండి." :
       "Thank you. Your FIR form is ready. Please tap 'Review Form' to verify.")
    : (qs.find(([f]) => !updated[f])?.[1] ?? "Any additional details?");

  return { reply: nextQ, extracted: updated, done, lang };
}

// ══════════════════════════════════════════════════════════════
// APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  // ── Navigation ───────────────────────────────────────────
  const [view, setView] = useState("welcome");

  // ── System ───────────────────────────────────────────────
  const [sysStatus, setSysStatus] = useState({ backend: false });

  // ── Language ─────────────────────────────────────────────
  const [speechLang, setSpeechLang] = useState("en-IN");
  const [detectedLang, setDetectedLang] = useState("en");

  // ── Session ──────────────────────────────────────────────
  const [sessionId,      setSessionId]      = useState("");
  const [complaintType,  setComplaintType]  = useState("");
  const [transcript,     setTranscript]     = useState([]);
  const [extractedData,  setExtractedData]  = useState({ ...EMPTY_FIR });
  const [chatFinished,   setChatFinished]   = useState(false);
  const [currentTurn,    setCurrentTurn]    = useState(0);

  // ── Voice ────────────────────────────────────────────────
  const [micState,       setMicState]       = useState(MIC_STATE.IDLE);
  const [liveText,       setLiveText]       = useState("");
  const [isMuted,        setIsMuted]        = useState(false);
  const [voiceError,     setVoiceError]     = useState("");

  // ── History / Preview ────────────────────────────────────
  const [savedFirs,  setSavedFirs]  = useState([]);
  const [selectedFir, setSelectedFir] = useState(null);

  // ── Refs ─────────────────────────────────────────────────
  const sttRef           = useRef(null);
  const ttsRef           = useRef(null);
  const chatEndRef       = useRef(null);
  const autoMicTimer     = useRef(null);
  const micPermitted     = useRef(false);
  const startListenRef   = useRef(null);
  const sendMsgRef       = useRef(null);
  const extractedDataRef = useRef({ ...EMPTY_FIR });
  const transcriptRef    = useRef([]);
  const currentTurnRef   = useRef(0);

  // ── Init ─────────────────────────────────────────────────
  useEffect(() => {
    sttRef.current = new WebSpeechRecognition();
    ttsRef.current = new WebSpeechSynthesis();
    checkStatus();
    const iv = setInterval(checkStatus, 12000);
    return () => { clearInterval(iv); clearAutoMic(); };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // ── Status check ─────────────────────────────────────────
  const checkStatus = async () => {
    try {
      const d = await apiFetch("/api/status");
      setSysStatus({ backend: true });
    } catch { setSysStatus({ backend: false }); }
  };

  // ── Sync STT/TTS language when speechLang changes ────────
  useEffect(() => {
    sttRef.current?.setLanguage(speechLang);
    ttsRef.current?.setLanguage(speechLang);
  }, [speechLang]);

  // Keep refs in sync with state for stale-closure-safe access
  useEffect(() => { extractedDataRef.current = extractedData; }, [extractedData]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { currentTurnRef.current = currentTurn; }, [currentTurn]);

  // ── Speak then auto-start mic ────────────────────────────
  const speakAndListen = useCallback((text, lang) => {
    if (isMuted || chatFinished) return;
    const ttsLang = LANG_TTS[lang] || speechLang;
    sttRef.current?.setLanguage(ttsLang);
    ttsRef.current?.setLanguage(ttsLang);
    setMicState(MIC_STATE.SPEAKING);
    ttsRef.current.speak(
      text,
      () => setMicState(MIC_STATE.SPEAKING),
      () => {
        setMicState(MIC_STATE.IDLE);
        clearAutoMic();
        autoMicTimer.current = setTimeout(() => {
          if (!chatFinished) startListenRef.current?.();
        }, 700);
      },
      () => setMicState(MIC_STATE.IDLE)
    );
  }, [isMuted, chatFinished, speechLang]);

  const clearAutoMic = () => {
    if (autoMicTimer.current) { clearTimeout(autoMicTimer.current); autoMicTimer.current = null; }
  };

  // ── Microphone permission ────────────────────────────────
  const requestMicPermission = useCallback(async () => {
    if (micPermitted.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      micPermitted.current = true;
      return true;
    } catch (err) {
      console.error("Mic permission error:", err.name, err.message);
      const name = err.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setVoiceError("Microphone access denied. Click the 🔒 icon in the address bar, enable Microphone, then reload.");
      } else if (name === "NotFoundError") {
        setVoiceError("No microphone found. Connect a mic or check your input device settings.");
      } else if (name === "NotReadableError") {
        setVoiceError("Microphone is busy (another app may be using it). Close other apps and retry.");
      } else {
        setVoiceError(`Microphone error: ${err.message}. Tap mic to retry.`);
      }
      return false;
    }
  }, []);

  // ── Speech Recognition ───────────────────────────────────
  const startListening = useCallback(async () => {
    if (!sttRef.current?.supported) {
      setVoiceError("Speech Recognition not supported. Use Chrome or Edge."); return;
    }
    const hasPerm = await requestMicPermission();
    if (!hasPerm) {
      setMicState(MIC_STATE.IDLE);
      return;
    }
    setVoiceError(""); setLiveText(""); setMicState(MIC_STATE.LISTENING);

    sttRef.current.start(
      (text) => {
        setLiveText(text); setMicState(MIC_STATE.PROCESSING); sendMsgRef.current?.(text);
      },
      (err) => {
        setMicState(MIC_STATE.IDLE);
        if (err === "not-allowed") micPermitted.current = false;
        setVoiceError(err === "not-allowed"
          ? "Microphone blocked. Check browser site permissions (🔒 → Microphone → Allow)."
          : `Microphone error: ${err}. Tap mic to retry.`);
      },
      () => setMicState(MIC_STATE.IDLE)
    );
  }, [requestMicPermission]);

  // Keep ref in sync so timers always call the latest version
  startListenRef.current = startListening;

  const stopListening = () => { sttRef.current?.stop(); setMicState(MIC_STATE.IDLE); clearAutoMic(); };

  const toggleMic = () => {
    if (micState === MIC_STATE.LISTENING) stopListening();
    else if (micState === MIC_STATE.IDLE) { ttsRef.current?.stop(); startListening(); }
  };

  // ── Language toggle ──────────────────────────────────────
  const cycleLanguage = () => {
    const langs = ["en-IN", "hi-IN", "te-IN"];
    const idx = langs.indexOf(speechLang);
    const next = langs[(idx + 1) % langs.length];
    setSpeechLang(next);
    sttRef.current?.setLanguage(next);
    ttsRef.current?.setLanguage(next);
  };

  // ── Send message ─────────────────────────────────────────
  const sendMessage = async (text) => {
    if (!text?.trim()) { setMicState(MIC_STATE.IDLE); return; }

    // Use refs to always read the latest state (avoids stale closure bugs)
    const curExtracted = extractedDataRef.current;
    const curTranscript = transcriptRef.current;
    const curTurn = currentTurnRef.current;

    setTranscript(prev => {
      const next = [...prev, { role: "user", content: text }];
      transcriptRef.current = next;
      return next;
    });

    const userLang = detectLanguage(text);
    setDetectedLang(userLang);

    let reply, data = null;

    if (sysStatus.backend) {
      try {
        data = await apiFetch("/api/chat/message", {
          method: "POST",
          body: JSON.stringify({
            session_id: sessionId,
            message: text,
            complaint_type: complaintType,
            language: userLang,
          }),
        });
      } catch {
        setSysStatus({ backend: false });
      }
    }

    if (!data) {
      const result = clientSideProcess(text, curExtracted, curTranscript, curTurn, complaintType);
      reply = result.reply;
      data = { extracted_data: result.extracted, finished: result.done, language: result.lang };
      extractedDataRef.current = result.extracted;
      setExtractedData(result.extracted);
      currentTurnRef.current = curTurn + 1;
      setCurrentTurn(curTurn + 1);
      if (result.done) setChatFinished(true);
      setDetectedLang(result.lang);
    } else {
      reply = data.message;
      extractedDataRef.current = data.extracted_data;
      setExtractedData(data.extracted_data);
      currentTurnRef.current = data.current_turn;
      setCurrentTurn(data.current_turn);
      if (data.finished) setChatFinished(true);
      if (data.language) setDetectedLang(data.language);
    }

    setTranscript(prev => {
      const next = [...prev, { role: "assistant", content: reply }];
      transcriptRef.current = next;
      return next;
    });
    setMicState(MIC_STATE.IDLE);

    const replyLang = data.language || userLang;
    if (!data.finished) {
      speakAndListen(reply, replyLang);
    } else {
      ttsRef.current?.speak(reply);
    }
  };

  sendMsgRef.current = sendMessage;

  // ── Start Session ────────────────────────────────────────
  const startSession = async (type) => {
    const sid = `session_${Date.now()}`;
    setSessionId(sid); setComplaintType(type);
    setTranscript([]); setExtractedData({ ...EMPTY_FIR });
    setChatFinished(false); setCurrentTurn(0);
    setLiveText(""); setVoiceError(""); setView("chat");

    let greeting, respLang = "en";
    try {
      if (sysStatus.backend) {
        const d = await apiFetch("/api/chat/message", {
          method: "POST",
          body: JSON.stringify({ session_id: sid, complaint_type: type }),
        });
        greeting = d.message;
        if (d.language) respLang = d.language;
      } else {
        greeting = `Hello! I am your AI police assistant. I will help you file a FIR for '${type}'. Speak in English, Hindi, or Telugu.`;
      }
    } catch {
      greeting = `Hello! I will help you file a FIR for '${type}'. Speak when the microphone is active.`;
    }

    setTranscript([{ role: "assistant", content: greeting }]);
    setTimeout(() => speakAndListen(greeting, respLang), 500);
  };

  // ── Save FIR ─────────────────────────────────────────────
  const saveFIR = async () => {
    const report = {
      complaint_type: complaintType, ...extractedData,
      status: "Submitted",
      transcript_json: JSON.stringify(transcript),
      language: detectedLang,
    };

    try {
      if (sysStatus.backend) {
        const saved = await apiFetch("/api/fir/save", { method: "POST", body: JSON.stringify(report) });
        setSelectedFir(saved);
      } else {
        const list = JSON.parse(localStorage.getItem("local_firs") || "[]");
        const mock = { ...report, _id: String(Date.now()), createdAt: new Date().toISOString() };
        list.push(mock);
        localStorage.setItem("local_firs", JSON.stringify(list));
        setSelectedFir(mock);
      }
      setView("preview");
    } catch (err) { alert("Save failed: " + err.message); }
  };

  // ── Load History ─────────────────────────────────────────
  const loadHistory = async () => {
    try {
      if (sysStatus.backend) {
        setSavedFirs(await apiFetch("/api/fir/list"));
      } else {
        setSavedFirs(JSON.parse(localStorage.getItem("local_firs") || "[]"));
      }
    } catch { setSavedFirs(JSON.parse(localStorage.getItem("local_firs") || "[]")); }
    setView("history");
  };

  // ── Update language from chat language display ───────────
  const langDisplay = LANG_NAMES[detectedLang] || "English";
  const langCode = LANG_TTS[detectedLang] || "en-IN";

  const micLabel = {
    [MIC_STATE.IDLE]:       { text: "Tap to Speak",  cls: "gray"  },
    [MIC_STATE.LISTENING]:  { text: "Listening...",   cls: "green" },
    [MIC_STATE.SPEAKING]:   { text: "AI Speaking...", cls: "blue"  },
    [MIC_STATE.PROCESSING]: { text: "Processing...",  cls: "blue"  },
  }[micState];

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand" onClick={() => { ttsRef.current?.stop(); setView("welcome"); }}>
          <div className="header-brand-icon"><ShieldAlert size={20} color="#fff" /></div>
          <div>
            <h1>AI FIR PORTAL</h1>
            <p>PRIVACY-FIRST POLICE ASSISTANT</p>
          </div>
        </div>

        <div className="header-right">
          <span className={`status-badge ${sysStatus.backend ? "badge-online" : "badge-offline"}`}>
            <span className="dot" />
            {sysStatus.backend ? "API ONLINE" : "OFFLINE MODE"}
          </span>

          <span className="status-badge badge-online">
            <Languages size={10} /> {langDisplay}
          </span>

          <button className="btn btn-ghost" style={{ padding: "0.4rem 0.7rem" }} onClick={loadHistory}>
            <FileText size={15} />
          </button>
        </div>
      </header>

      {/* ══ WELCOME ══════════════════════════════════════════ */}
      {view === "welcome" && (
        <div className="panel" style={{ maxWidth: 780, margin: "1.5rem auto", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
              AI FIR Filing Portal
            </h2>
            <p style={{ color: "var(--text-2)", fontSize: "1rem" }}>
              File your First Information Report using voice. Speak in <strong>English</strong>, <strong>हिन्दी</strong>, or <strong>తెలుగు</strong>.
              No login required — all data stays local.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { icon: Mic, label: "Voice-First", color: "#10b981" },
              { icon: ShieldCheck, label: "100% Private", color: "#3b82f6" },
              { icon: Languages, label: "3 Languages", color: "#a855f7" },
            ].map(f => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 600, color: f.color }}>
                <f.icon size={16} />{f.label}
              </div>
            ))}
          </div>

          {/* Language selector */}
          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
            {["en-IN", "hi-IN", "te-IN"].map(l => (
              <button key={l} className={`btn ${speechLang === l ? "btn-primary" : "btn-ghost"}`}
                style={{ fontSize: "0.82rem", padding: "0.4rem 0.9rem" }}
                onClick={() => setSpeechLang(l)}>
                {LANG_NAMES[l === "en-IN" ? "en" : l === "hi-IN" ? "hi" : "te"]}
              </button>
            ))}
          </div>

          <div>
            <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
              Select Complaint Category
            </p>
            <div className="welcome-grid">
              {COMPLAINT_TYPES.map(ct => (
                <div key={ct.name} className="complaint-card" onClick={() => startSession(ct.name)}>
                  <div className="complaint-card-icon"><ct.icon size={22} style={{ color: ct.color }} /></div>
                  <div className="complaint-card-label">
                    <span>{ct.name}</span>
                    <ArrowRight size={15} style={{ color: "var(--text-3)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ VOICE CHAT ════════════════════════════════════════ */}
      {view === "chat" && (
        <div className="interview-layout" style={{ flex: 1 }}>
          <div className="panel convo-pane">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem" }}>Voice Interview — {complaintType}</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                  Turn {currentTurn} · {langDisplay} · Speak when mic is green
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-ghost" style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                  onClick={cycleLanguage} title="Change language">
                  <Languages size={14} /> <span style={{ marginLeft: 4 }}>{langDisplay}</span>
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem" }}
                  onClick={() => { ttsRef.current?.stop(); setIsMuted(m => !m); }}>
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span style={{ marginLeft: 4 }}>{isMuted ? "Muted" : "Audio"}</span>
                </button>
              </div>
            </div>

            <div className="convo-messages">
              {transcript.map((msg, i) => (
                <div key={i} className={`msg msg-${msg.role === "user" ? "user" : "bot"}`}>
                  <div>
                    <div className="msg-label">
                      {msg.role === "user" ? "You said" : "AI Assistant"}
                    </div>
                    <div className="msg-bubble">{msg.content}</div>
                  </div>
                </div>
              ))}
              {micState === MIC_STATE.PROCESSING && (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", color: "var(--text-3)", fontSize: "0.82rem" }}>
                  <Loader size={14} className="spin" /> Analyzing...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="voice-controls">
              <div className="visualizer-wrap">
                <AudioVisualizer isRecording={micState === MIC_STATE.LISTENING} />
              </div>

              <div className={`live-text-box ${liveText ? "has-text" : ""}`}>
                {liveText || (
                  micState === MIC_STATE.LISTENING ? "🎤 Listening — speak now..." :
                  micState === MIC_STATE.SPEAKING   ? "🔊 AI is speaking..." :
                  micState === MIC_STATE.PROCESSING  ? "⚙️ Processing..." :
                  "Tap the microphone to speak"
                )}
              </div>

              {voiceError && (
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start",
                  color: "#fca5a5", fontSize: "0.8rem", background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)", borderRadius: "0.4rem", padding: "0.5rem 0.75rem" }}>
                  <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{voiceError}</span>
                </div>
              )}

              <button className={`mic-btn ${micState}`} onClick={toggleMic}
                disabled={micState === MIC_STATE.PROCESSING} title={micLabel.text}>
                {micState === MIC_STATE.LISTENING
                  ? <MicOff size={34} />
                  : micState === MIC_STATE.PROCESSING || micState === MIC_STATE.SPEAKING
                    ? <Loader size={30} className="spin" />
                    : <Mic size={34} />
                }
              </button>

              <span className={`mic-status-label ${micLabel.cls}`}>{micLabel.text}</span>

              <div style={{ display: "flex", gap: "0.75rem", width: "100%", justifyContent: "space-between" }}>
                <button className="btn btn-ghost btn-danger"
                  style={{ fontSize: "0.82rem", padding: "0.45rem 0.9rem" }}
                  onClick={() => { ttsRef.current?.stop(); stopListening(); setView("welcome"); }}>
                  Cancel
                </button>
                <button className="btn btn-primary"
                  style={{ fontSize: "0.82rem", padding: "0.45rem 0.9rem" }}
                  onClick={() => { ttsRef.current?.stop(); stopListening(); setView("editor"); }}>
                  Review Form <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Extraction sidebar */}
          <div className="panel extraction-pane">
            <h3 style={{ fontSize: "0.85rem", borderBottom: "1px solid var(--border)",
              paddingBottom: "0.45rem", marginBottom: "0.25rem" }}>
              Live Extraction
            </h3>
            {EXTRACTION_FIELDS.map(f => (
              <div key={f.key} className="ext-field" style={f.span === 2 ? { gridColumn: "span 2" } : {}}>
                <div className="ext-label"><f.icon size={11} />{f.label}</div>
                <div className={`ext-value ${extractedData[f.key] ? "filled" : "empty"}`}>
                  {extractedData[f.key] || "—"}
                </div>
              </div>
            ))}
            <div style={{ fontSize: "0.72rem", color: "var(--text-3)", lineHeight: 1.5,
              background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.1)",
              borderRadius: "0.4rem", padding: "0.6rem", marginTop: "auto" }}>
              Fields auto-extract from speech. Edit on the next page.
            </div>
          </div>
        </div>
      )}

      {/* ══ EDITOR ════════════════════════════════════════════ */}
      {view === "editor" && (
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
            <h2 style={{ fontSize: "1.2rem" }}>Review & Edit FIR Draft</h2>
            <p style={{ color: "var(--text-2)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
              Verify extracted details. Correct errors before generating the official document.
            </p>
          </div>

          <div className="editor-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Complainant Name</label>
                  <input className="form-input" type="text"
                    value={extractedData.victim_name || ""}
                    onChange={e => setExtractedData(d => ({ ...d, victim_name: e.target.value }))}
                    placeholder="Full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Number</label>
                  <input className="form-input" type="text"
                    value={extractedData.victim_contact || ""}
                    onChange={e => setExtractedData(d => ({ ...d, victim_contact: e.target.value }))}
                    placeholder="10-digit number" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Date & Time</label>
                  <input className="form-input" type="text"
                    value={extractedData.incident_date_time || ""}
                    onChange={e => setExtractedData(d => ({ ...d, incident_date_time: e.target.value }))}
                    placeholder="e.g. 23/05/2026 09:30 PM" />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" type="text"
                    value={extractedData.incident_location || ""}
                    onChange={e => setExtractedData(d => ({ ...d, incident_location: e.target.value }))}
                    placeholder="Address / landmark" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Suspect Details</label>
                <input className="form-input" type="text"
                  value={extractedData.suspect_details || ""}
                  onChange={e => setExtractedData(d => ({ ...d, suspect_details: e.target.value }))}
                  placeholder="Height, clothing, name..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Stolen Item</label>
                  <input className="form-input" type="text"
                    value={extractedData.stolen_item || ""}
                    onChange={e => setExtractedData(d => ({ ...d, stolen_item: e.target.value }))}
                    placeholder="Items stolen" />
                </div>
                <div className="form-group">
                  <label className="form-label">Vehicle Number</label>
                  <input className="form-input" type="text"
                    value={extractedData.vehicle_number || ""}
                    onChange={e => setExtractedData(d => ({ ...d, vehicle_number: e.target.value }))}
                    placeholder="e.g. AP12AB3456" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Evidence / Witnesses</label>
                <input className="form-input" type="text"
                  value={extractedData.evidence || ""}
                  onChange={e => setExtractedData(d => ({ ...d, evidence: e.target.value }))}
                  placeholder="CCTV, photos, witness names..." />
              </div>
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column" }}>
              <label className="form-label">Full Incident Description</label>
              <textarea className="form-textarea" style={{ flex: 1, minHeight: 280 }}
                value={extractedData.description || ""}
                onChange={e => setExtractedData(d => ({ ...d, description: e.target.value }))}
                placeholder="Complete narrative of the incident..." />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-ghost" onClick={() => setView("chat")}>
                ← Back to Voice
              </button>
              <button className="btn btn-ghost btn-danger" onClick={() => setExtractedData({ ...EMPTY_FIR })}>
                Clear All
              </button>
            </div>
            <button className="btn btn-accent" onClick={saveFIR}>
              <Check size={16} /> Save & Generate FIR
            </button>
          </div>
        </div>
      )}

      {/* ══ PREVIEW ═══════════════════════════════════════════ */}
      {view === "preview" && selectedFir && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem" }}>FIR Saved</h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.82rem" }}>
                Review below, then Print or Download as PDF.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button className="btn btn-ghost" onClick={() => setView("editor")}><Edit size={15} /> Edit</button>
              <button className="btn btn-primary" onClick={() => downloadFIR("fir-preview-doc")}>
                <FileText size={15} /> Download PDF
              </button>
              <button className="btn btn-ghost" onClick={() => window.print()}>
                <Printer size={15} /> Print
              </button>
              <button className="btn btn-ghost" onClick={() => setView("welcome")}>
                <Home size={15} /> Home
              </button>
            </div>
          </div>

          <div className="fir-preview-doc" id="fir-preview-doc">
            <div className="fir-doc-header">
              <h1>First Information Report</h1>
              <p>Under Section 154 Cr.P.C. — AI-Generated Draft</p>
            </div>
            <div className="fir-meta-grid">
              <div><strong>Reference:</strong> AI-FIR-{selectedFir._id || selectedFir.id}</div>
              <div><strong>Type:</strong> {selectedFir.complaint_type}</div>
              <div><strong>Date:</strong> {new Date(selectedFir.createdAt || selectedFir.created_at).toLocaleString()}</div>
              <div><strong>Status:</strong> {selectedFir.status}</div>
            </div>
            <div className="fir-section-title">1. Complainant / Victim Details</div>
            <div className="fir-detail-grid">
              <strong>Name:</strong>     <span>{selectedFir.victim_name}</span>
              <strong>Contact:</strong>  <span>{selectedFir.victim_contact}</span>
            </div>
            <div className="fir-section-title">2. Incident Details</div>
            <div className="fir-detail-grid">
              <strong>Date/Time:</strong> <span>{selectedFir.incident_date_time}</span>
              <strong>Location:</strong>  <span>{selectedFir.incident_location}</span>
              <strong>Suspect:</strong>   <span>{selectedFir.suspect_details}</span>
              <strong>Stolen Item:</strong> <span>{selectedFir.stolen_item || "N/A"}</span>
              <strong>Vehicle No.:</strong> <span>{selectedFir.vehicle_number || "N/A"}</span>
              <strong>Evidence:</strong>  <span>{selectedFir.evidence}</span>
            </div>
            <div className="fir-section-title">3. Incident Narrative</div>
            <div className="fir-narrative">{selectedFir.description}</div>
            <div className="fir-sigs">
              <div className="fir-sig-block"><div className="fir-sig-line">Signature of Complainant</div></div>
              <div className="fir-sig-block"><div className="fir-sig-line">IO Stamp & Signature</div></div>
            </div>
          </div>
        </div>
      )}

      {/* ══ HISTORY ═══════════════════════════════════════════ */}
      {view === "history" && (
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
            <div>
              <h2 style={{ fontSize: "1.1rem" }}>Saved FIR Records</h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.82rem" }}>All records stored locally.</p>
            </div>
            <button className="btn btn-ghost" onClick={() => setView("welcome")}><Home size={15} /> Home</button>
          </div>

          {savedFirs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-3)" }}>
              <FileText size={44} style={{ opacity: 0.3, marginBottom: "1rem" }} />
              <p>No FIR records found.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>ID</th><th>Date</th><th>Category</th>
                    <th>Name</th><th>Contact</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {savedFirs.map(fir => (
                    <tr key={fir._id || fir.id} onClick={() => { setSelectedFir(fir); setView("preview"); }}>
                      <td><strong>AI-FIR-{String(fir._id || fir.id).slice(-6)}</strong></td>
                      <td>{new Date(fir.createdAt || fir.created_at).toLocaleDateString()}</td>
                      <td>{fir.complaint_type}</td>
                      <td>{fir.victim_name}</td>
                      <td>{fir.victim_contact}</td>
                      <td>
                        <span style={{ padding: "0.2rem 0.6rem", borderRadius: "12px", fontSize: "0.75rem",
                          background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                          {fir.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ PRINT LAYOUT ══════════════════════════════════════ */}
      {selectedFir && (
        <div className="print-only">
          <div className="print-watermark">CONFIDENTIAL</div>
          <div className="print-header">
            <h1>First Information Report</h1>
            <p>Under Section 154 of the Code of Criminal Procedure (Cr.P.C.)</p>
          </div>
          <div className="print-meta">
            <div><strong>Ref:</strong> AI-FIR-{String(selectedFir._id || selectedFir.id).slice(-6)}</div>
            <div><strong>Date:</strong> {new Date(selectedFir.createdAt || selectedFir.created_at).toLocaleString()}</div>
            <div><strong>Category:</strong> {selectedFir.complaint_type}</div>
            <div><strong>Status:</strong> {selectedFir.status}</div>
          </div>
          <div className="print-section">
            <h2>1. Complainant / Victim Details</h2>
            <div className="print-detail">
              <strong>Name:</strong>    <span>{selectedFir.victim_name}</span>
              <strong>Contact:</strong> <span>{selectedFir.victim_contact}</span>
            </div>
          </div>
          <div className="print-section">
            <h2>2. Incident Details</h2>
            <div className="print-detail">
              <strong>Date/Time:</strong>  <span>{selectedFir.incident_date_time}</span>
              <strong>Location:</strong>   <span>{selectedFir.incident_location}</span>
              <strong>Suspect:</strong>    <span>{selectedFir.suspect_details}</span>
              <strong>Stolen Item:</strong> <span>{selectedFir.stolen_item || "N/A"}</span>
              <strong>Vehicle No.:</strong> <span>{selectedFir.vehicle_number || "N/A"}</span>
              <strong>Evidence:</strong>   <span>{selectedFir.evidence}</span>
            </div>
          </div>
          <div className="print-section">
            <h2>3. Incident Narrative</h2>
            <div className="print-narrative">{selectedFir.description}</div>
          </div>
          <div className="print-sigs">
            <div className="print-sig"><div className="print-sig-line">Signature of Complainant</div></div>
            <div className="print-sig"><div className="print-sig-line">IO Stamp & Signature</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
