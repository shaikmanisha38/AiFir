import { useState, useEffect, useRef } from "react";
import {
  Mic, MicOff, Send, Volume2, VolumeX, FileText, Check, Edit, Printer,
  Home, History, User, Phone, MapPin, Calendar, AlertTriangle, Cpu,
  DollarSign, UserX, EyeOff, Lock, ShieldCheck, ArrowRight,
  ChevronRight, ShieldAlert, Loader, LogIn, LogOut, Eye
} from "lucide-react";

import { WebSpeechRecognition, WebSpeechSynthesis } from "./utils/speech";
import AudioVisualizer from "./components/AudioVisualizer";
import { registerUser, loginUser } from "./utils/userStore";
import { t } from "./utils/translations";

const API_BASE = "http://localhost:8000";

export default function App() {
  const [view, setView] = useState("login");

  const [sysStatus, setSysStatus] = useState({
    backend_running: false, database_connected: false,
    ollama_connected: false, ollama_model: null, standalone_mode: false
  });

  const [sessionId, setSessionId] = useState("");
  const [complaintType, setComplaintType] = useState("");
  const [currentTurn, setCurrentTurn] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [extractedData, setExtractedData] = useState({
    victim_name: "", victim_contact: "", incident_date_time: "",
    incident_location: "", suspect_details: "", evidence: "", witness: "", description: ""
  });

  const [isRecording, setIsRecording] = useState(false);
  const [recognitionError, setRecognitionError] = useState("");
  const [inputText, setInputText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedFirs, setSavedFirs] = useState([]);
  const [selectedFir, setSelectedFir] = useState(null);

  const [authToken, setAuthToken] = useState(() => localStorage.getItem("auth_token") || "");
  const [authUser, setAuthUser] = useState(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [authView, setAuthView] = useState("register");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const lang = "en";
  const isAuthenticated = !!authToken && !!authUser;

  const extractionFields = [
    { label: "Victim Name", key: "victim_name", icon: User },
    { label: "Contact Details", key: "victim_contact", icon: Phone },
    { label: "Incident Location", key: "incident_location", icon: MapPin },
    { label: "Date & Time", key: "incident_date_time", icon: Calendar },
    { label: "Suspect Details", key: "suspect_details", icon: UserX },
    { label: "Evidence", key: "evidence", icon: EyeOff },
    { label: "Witnesses", key: "witness", icon: FileText }
  ];

  const speechRecognitionRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    speechRecognitionRef.current = new WebSpeechRecognition();
    speechSynthesisRef.current = new WebSpeechSynthesis();
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (res.ok) {
          const data = await res.json();
          setSysStatus({ backend_running: true, database_connected: data.database_connected, ollama_connected: data.ollama_connected, ollama_model: data.ollama_model, standalone_mode: false });
        } else throw new Error();
      } catch { setSysStatus({ backend_running: false, database_connected: true, ollama_connected: false, ollama_model: null, standalone_mode: true }); }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (transcript.length > 0 && !isMuted) {
      const lastMsg = transcript[transcript.length - 1];
      if (lastMsg.role === "assistant") speechSynthesisRef.current.speak(lastMsg.content);
    }
  }, [transcript, isMuted]);

  const handleRegister = async (e) => {
    e.preventDefault(); setAuthError(""); setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: authName, email: authEmail, phone: authPhone, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.detail || "Registration failed"); return; }
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      setAuthToken(data.access_token); setAuthUser(data.user); setView("welcome");
    } catch {
      const result = registerUser(authName, authEmail, authPhone, authPassword);
      if (!result.ok) { setAuthError(result.error); return; }
      localStorage.setItem("auth_token", result.access_token);
      localStorage.setItem("auth_user", JSON.stringify(result.user));
      setAuthToken(result.access_token); setAuthUser(result.user); setView("welcome");
    } finally { setAuthLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setAuthError(""); setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        const result = loginUser(authEmail, authPassword);
        if (result.ok) {
          localStorage.setItem("auth_token", result.access_token);
          localStorage.setItem("auth_user", JSON.stringify(result.user));
          setAuthToken(result.access_token); setAuthUser(result.user); setView("welcome");
          return;
        }
        setAuthError(result.error); return;
      }
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      setAuthToken(data.access_token); setAuthUser(data.user); setView("welcome");
    } catch {
      const result = loginUser(authEmail, authPassword);
      if (result.ok) {
        localStorage.setItem("auth_token", result.access_token);
        localStorage.setItem("auth_user", JSON.stringify(result.user));
        setAuthToken(result.access_token); setAuthUser(result.user); setView("welcome");
        return;
      }
      setAuthError(result.error);
    }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token"); localStorage.removeItem("auth_user");
    setAuthToken(""); setAuthUser(null); setView("login"); speechSynthesisRef.current.stop();
  };

  const startNewSession = async (type) => {
    const sId = "session_" + crypto.randomUUID();
    setSessionId(sId); setComplaintType(type); setCurrentTurn(0);
    setIsRecording(false); setTranscript([]);
    setExtractedData({ victim_name: "", victim_contact: "", incident_date_time: "", incident_location: "", suspect_details: "", evidence: "", witness: "", description: "" });
    setView("chat"); setIsProcessing(true);
    if (sysStatus.backend_running && !sysStatus.standalone_mode) {
      try {
        const res = await fetch(`${API_BASE}/api/chat/message`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sId, complaint_type: type, user_id: authUser?.id || null, language: lang })
        });
        if (res.ok) { const data = await res.json(); setTranscript([{ role: "assistant", content: data.message }]); }
      } catch (err) { console.error(err); startSessionClient(type); }
      finally { setIsProcessing(false); }
    } else { startSessionClient(type); setIsProcessing(false); }
  };

  const startSessionClient = (type) => {
    const greeting = `Hello, I am your digital police assistant. I will help you file a First Information Report (FIR) for the '${type}' incident. Please describe what happened in your own words, and I will extract the details.`;
    setTranscript([{ role: "assistant", content: greeting }]);
  };

  function extractName(text) {
    const patterns = [
      /(?:my name is|i am|this is)\s+([A-Za-z]+(?:[\s'][A-Za-z]+){0,3})/i,
      /(?:name is|myself)\s+([A-Za-z]+(?:[\s'][A-Za-z]+){0,3})/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].trim();
    }
    return null;
  }

  function extractPhone(text) {
    const patterns = [
      /(?:\+91[\s-]?)?(\d{10})(?:\s|$|\.)/,
      /(?:phone|contact|number|reach|call|mobile|whatsapp)(?:\s*(?:number|no|is|:))?\s*[:]?\s*((?:\+91[\s-]?)?\d{5,}[\s-]?\d{5,})/i,
      /(\d{5}[\s-]\d{5})/
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].replace(/[\s-]+/g, "");
    }
    return null;
  }

  function extractLocation(text) {
    const patterns = [
      /(?:at|in|near|outside|inside|from)\s+([A-Za-z0-9\s,.'-]{4,40})(?:\s+(?:yesterday|today|on|at|around|when|i\b|the\b|and|with|$))/i,
      /(?:place of occurrence|incident (?:location|place)|happened at|occurred at|took place)\s*(?::|at|in|on)?\s*([A-Za-z0-9\s,.'-]{4,40})/i,
      /(?:address is|location is)\s*[:]?\s*([A-Za-z0-9\s,.'-]{4,40})/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].trim();
    }
    return null;
  }

  function extractDateTime(text) {
    const patterns = [
      /(?:yesterday|today|last night|last week|last month|day before yesterday)/i,
      /(?:on\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\d{0,4})/i,
      /(?:on\s+)?(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
      /\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\b/,
      /(?:at\s+)?(\d{1,2}\s*(?:AM|PM|am|pm))/i,
      /(?:morning|evening|afternoon|night|midnight|noon|dawn|dusk)/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[0] || m[1];
    }
    return null;
  }

  function extractSuspect(text) {
    const patterns = [
      /(?:suspect|accused|person|man|woman|guy|thief|robber|attacker)(?:\s+(?:was|is|wearing|had|wore|appeared|looked|name))?\s+([^.?!]{5,60})/i,
      /(?:he|she)\s+(?:was|is|wore|wearing|had|looked|appeared)\s+([^.?!]{4,50})/i,
      /(?:description of|describe)\s+(?:the\s+)?(?:suspect|person|accused)\s*(?::|is|was)?\s*([^.?!]{5,50})/i,
      /(?:suspect details|suspect description)\s*(?::|is)?\s*([^.?!]{5,60})/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let val = m[1].trim();
        if (val.length > 4) return val;
      }
    }
    return null;
  }

  function extractEvidence(text) {
    const patterns = [
      /(?:there is|there are|i have|we have|there was)\s+([^.?!]{5,80})/i,
      /(?:evidence|proof|cctv|camera|recording|video|photo|picture|footage|document|screenshot)\s*(?::|is|was)?\s*([^.?!]{5,80})/i,
      /(?:i have|have a|has a)\s+(?:video|photo|picture|recording|cctv|camera|evidence|proof|document|screenshot)\s+([^.?!]{5,80})/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let val = (m[1] || m[0]).trim();
        if (val.length > 4) return val;
      }
    }
    return null;
  }

  function extractWitness(text) {
    const patterns = [
      /(?:witness(?:es)?)\s*(?::|are|is|was|name|names)?\s*([A-Za-z\s,]{4,60})/i,
      /(?:there (?:is|are|was|were)\s+(?:a\s+)?witness(?:\s+(?:named|called|by\s+the\s+name\s+))?)\s+([A-Za-z\s,]{4,50})/i,
      /(?:witness saw|witness told|witness said|witness gave|witness name|witnesses are)\s+([^.?!]{5,60})/i,
      /(\d+\s*(?:people|persons?|men|women|neighbors?|bystanders?|passersby)\s+(?:saw|witnessed|watched|observed|saw everything))/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        let val = (m[1] || m[0]).trim();
        if (val.length > 4) return val;
      }
    }
    return null;
  }

  const processMessageClient = (userText) => {
    const history = [...transcript, { role: "user", content: userText }];
    setTranscript(history);
    const updated = { ...extractedData };
    const lastUser = userText;

    // Extract only the field that was just asked about (sequential chain)
    if (!updated.victim_name) {
      const v = extractName(lastUser);
      if (v) updated.victim_name = v;
      else if (lastUser.length >= 2) updated.victim_name = lastUser.trim();
    } else if (!updated.victim_contact) {
      const v = extractPhone(lastUser);
      if (v) updated.victim_contact = v;
      else if (lastUser.length >= 2) updated.victim_contact = lastUser.trim();
    } else if (!updated.incident_location) {
      const v = extractLocation(lastUser);
      if (v) updated.incident_location = v;
      else if (lastUser.length >= 3) updated.incident_location = lastUser.trim().replace(/[.,;]+$/, "");
    } else if (!updated.incident_date_time) {
      const v = extractDateTime(lastUser);
      if (v) updated.incident_date_time = v;
      else if (lastUser.length >= 3) updated.incident_date_time = lastUser.trim();
    } else if (!updated.suspect_details && ["Theft","Burglary","Assault","Harassment","Cyber Crime","Missing Person"].includes(complaintType)) {
      const v = extractSuspect(lastUser);
      if (v) updated.suspect_details = v;
      else if (lastUser.length >= 3) updated.suspect_details = lastUser.trim().replace(/[.!?]+$/, "");
    } else if (!updated.evidence) {
      const v = extractEvidence(lastUser);
      if (v) updated.evidence = v;
      else if (lastUser.length >= 3) updated.evidence = lastUser.trim().replace(/[.!?]+$/, "");
    } else if (!updated.witness) {
      if (lastUser.length >= 3) updated.witness = lastUser.trim().replace(/[.!?]+$/, "");
    } else if (!updated.description) {
      if (lastUser.length >= 3) updated.description = lastUser.trim();
    }

    setExtractedData(updated);
    const nextTurn = currentTurn + 1;
    setCurrentTurn(nextTurn);
    let nextQ = "";
    if (!updated.victim_name) nextQ = t("ask.name", lang);
    else if (!updated.victim_contact) nextQ = t("ask.contact", lang, { name: updated.victim_name });
    else if (!updated.incident_location) nextQ = t("ask.location", lang);
    else if (!updated.incident_date_time) nextQ = t("ask.datetime", lang);
    else if (!updated.suspect_details && ["Theft","Burglary","Assault","Harassment","Cyber Crime","Missing Person"].includes(complaintType)) nextQ = t("ask.suspect", lang);
    else if (!updated.evidence) nextQ = t("ask.evidence", lang);
    else if (!updated.witness) nextQ = t("ask.witness", lang);
    else if (!updated.description) nextQ = t("ask.description", lang);
    else nextQ = t("ask.done", lang);
    setTimeout(() => setTranscript(prev => [...prev, { role: "assistant", content: nextQ }]), 600);
  };

  const sendMessage = async (messageText) => {
    if (!messageText.trim()) return;
    setInputText(""); setRecognitionError(""); setIsProcessing(true);
    speechSynthesisRef.current.stop();
    if (sysStatus.backend_running && !sysStatus.standalone_mode) {
      setTranscript(prev => [...prev, { role: "user", content: messageText }]);
      try {
        const res = await fetch(`${API_BASE}/api/chat/message`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, message: messageText, language: lang })
        });
        if (res.ok) { const d = await res.json(); setTranscript(prev => [...prev, { role: "assistant", content: d.message }]); setExtractedData(d.extracted_data); setCurrentTurn(d.current_turn); }
        else throw new Error("Message failed");
      } catch (err) { console.error(err); processMessageClient(messageText); }
      finally { setIsProcessing(false); }
    } else { processMessageClient(messageText); setIsProcessing(false); }
  };

  const toggleRecording = () => {
    if (isRecording) { speechRecognitionRef.current.stop(); setIsRecording(false); }
    else {
      setRecognitionError(""); setIsRecording(true);
      speechRecognitionRef.current.setLanguage("en-IN");
      speechRecognitionRef.current.start(
        (t) => { setIsRecording(false); sendMessage(t); },
        (e) => { setIsRecording(false); setRecognitionError(`Speech: ${e}`); },
        () => setIsRecording(false)
      );
    }
  };

  const saveFIR = async () => {
    setIsProcessing(true);
    const report = {
      complaint_type: complaintType, victim_name: extractedData.victim_name || "Unknown",
      victim_contact: extractedData.victim_contact || "Unknown", incident_date_time: extractedData.incident_date_time || "Unknown",
      incident_location: extractedData.incident_location || "Unknown", suspect_details: extractedData.suspect_details || "No details provided",
      evidence: (extractedData.evidence || "") + (extractedData.witness ? ` | Witnesses: ${extractedData.witness}` : "") || "None specified",
      description: extractedData.description || "No description provided",
      status: "Submitted", transcript_json: JSON.stringify(transcript), user_id: authUser?.id || null
    };
    if (sysStatus.backend_running && !sysStatus.standalone_mode) {
      try {
        const res = await fetch(`${API_BASE}/api/fir/save`, {
          method: "POST", headers: { "Content-Type": "application/json", ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}) },
          body: JSON.stringify(report)
        });
        if (res.ok) { setSelectedFir(await res.json()); setView("preview"); }
      } catch (err) { console.error(err); saveFIRLocal(report); }
      finally { setIsProcessing(false); }
    } else { saveFIRLocal(report); setIsProcessing(false); }
  };

  const saveFIRLocal = (report) => {
    const list = JSON.parse(localStorage.getItem("local_firs") || "[]");
    const mr = { ...report, id: Date.now(), created_at: new Date().toISOString() };
    list.push(mr); localStorage.setItem("local_firs", JSON.stringify(list));
    setSelectedFir(mr); setView("preview");
  };

  const loadFIRHistory = async () => {
    setIsProcessing(true);
    if (sysStatus.backend_running && !sysStatus.standalone_mode) {
      try { const res = await fetch(`${API_BASE}/api/fir/list`); if (res.ok) setSavedFirs(await res.json()); }
      catch (err) { console.error(err); loadFIRHistoryLocal(); }
      finally { setIsProcessing(false); }
    } else { loadFIRHistoryLocal(); setIsProcessing(false); }
    setView("history");
  };

  const loadFIRHistoryLocal = () => setSavedFirs(JSON.parse(localStorage.getItem("local_firs") || "[]"));
  const handlePrint = () => window.print();
  const cancelSession = () => { speechSynthesisRef.current.stop(); setView("welcome"); };
  const micState = isRecording ? "listening" : isProcessing ? "processing" : "idle";
  const isBackendOnline = sysStatus.backend_running && !sysStatus.standalone_mode;

  return (
    <div className="app-shell">
      {/* ═══ HEADER ═══ */}
      <header className="app-header">
        <div className="header-brand" onClick={() => isAuthenticated ? setView("welcome") : setView("login")}>
          <div className="header-brand-icon"><ShieldAlert size={20} /></div>
          <div>
            <h1>{t("app.title", lang)}</h1>
            <p>{t("app.subtitle", lang)}</p>
          </div>
        </div>
        <div className="header-right">
          {isAuthenticated && (
            <div className="user-chip">
              <div className="avatar">{authUser?.full_name?.charAt(0)?.toUpperCase() || "U"}</div>
              <span>{authUser?.full_name || authUser?.email}</span>
            </div>
          )}
          <span className={`status-badge ${sysStatus.standalone_mode ? "badge-warn" : isBackendOnline ? "badge-online" : "badge-offline"}`}>
            <span className="dot" />
            {sysStatus.standalone_mode ? t("status.standalone", lang) : isBackendOnline ? t("status.api_online", lang) : t("status.api_offline", lang)}
          </span>
          <span className={`status-badge ${sysStatus.ollama_connected ? "badge-online" : "badge-warn"}`}>
            <Cpu size={12} />
            {sysStatus.ollama_connected ? t("status.ollama", lang) : t("status.no_llm", lang)}
          </span>
          {isAuthenticated ? (
            <>
              <button className="btn btn-ghost" style={{ padding: "0.5rem 0.75rem" }} onClick={loadFIRHistory}>
                <History size={15} /> {t("app.records", lang)}
              </button>
              <button className="btn btn-danger" style={{ padding: "0.5rem 0.75rem" }} onClick={handleLogout}>
                <LogOut size={15} /> {t("app.logout", lang)}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" style={{ padding: "0.5rem 0.75rem" }} onClick={() => setView("login")}>
              <LogIn size={15} /> {t("app.login", lang)}
            </button>
          )}
        </div>
      </header>

      {/* ═══ STEP INDICATOR ═══ */}
      {isAuthenticated && view !== "login" && view !== "chat" && (
        <div className="step-indicator">
          <div className={`step ${view === "welcome" ? "active" : "done"}`}><span className="step-num">1</span><span className="step-label">{t("welcome.select_category", lang)}</span></div>
          <div className="step-line" />
          <div className={`step ${view === "chat" ? "active" : view === "editor" || view === "preview" ? "done" : ""}`}><span className="step-num">{view === "welcome" ? "2" : view === "chat" ? "2" : "✓"}</span><span className="step-label">{t("chat.title", lang)}</span></div>
          <div className="step-line" />
          <div className={`step ${view === "editor" ? "active" : view === "preview" ? "done" : ""}`}><span className="step-num">{view === "preview" ? "✓" : "3"}</span><span className="step-label">{t("editor.title", lang)}</span></div>
          <div className="step-line" />
          <div className={`step ${view === "preview" ? "active" : ""}`}><span className="step-num">4</span><span className="step-label">{t("preview.print", lang)}</span></div>
        </div>
      )}

      {/* ═══ MAIN ═══ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ── LOGIN / REGISTER ── */}
        {view === "login" && (
          <div className="auth-root">
            <div className="auth-card">
              <div className="auth-logo">
                <div className="auth-logo-icon"><ShieldAlert size={30} /></div>
                <h1>{t("app.title", lang)}</h1>
                <p>{authView === "login" ? t("auth.signin_title", lang) : t("auth.register_title", lang)}</p>
              </div>

              <div className="auth-tabs">
                <button className={`auth-tab ${authView === "login" ? "active" : ""}`} onClick={() => { setAuthView("login"); setAuthError(""); }}>
                  <LogIn size={14} style={{ marginRight: 6 }} />{t("auth.signin", lang)}
                </button>
                <button className={`auth-tab ${authView === "register" ? "active" : ""}`} onClick={() => { setAuthView("register"); setAuthError(""); }}>
                  <User size={14} style={{ marginRight: 6 }} />{t("auth.register", lang)}
                </button>
              </div>

              <form className="auth-form" onSubmit={authView === "login" ? handleLogin : handleRegister}>
                {authView === "register" && (
                  <>
                    <div className="field">
                      <label>{t("auth.full_name", lang)}</label>
                      <input type="text" placeholder={t("auth.full_name_placeholder", lang)} value={authName} onChange={e => setAuthName(e.target.value)} required />
                    </div>
                    <div className="field">
                      <label>{t("auth.phone", lang)}</label>
                      <input type="tel" placeholder={t("auth.phone_placeholder", lang)} value={authPhone} onChange={e => setAuthPhone(e.target.value)} />
                    </div>
                  </>
                )}
                <div className="field">
                  <label>{t("auth.email", lang)}</label>
                  <input type="email" placeholder={t("auth.email_placeholder", lang)} value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
                </div>
                <div className="field">
                  <label>{t("auth.password", lang)}</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input type={showPassword ? "text" : "password"} placeholder={t("auth.password_placeholder", lang)} value={authPassword} onChange={e => setAuthPassword(e.target.value)} required style={{ paddingRight: "2.5rem" }} />
                    <button type="button" className="btn btn-ghost" style={{ padding: "0.5rem" }} onClick={() => setShowPassword(!showPassword)}><Eye size={16} /></button>
                  </div>
                </div>
                {authError && <div className="auth-error"><AlertTriangle size={14} />{authError}</div>}
                <button className="btn btn-primary btn-full" type="submit" disabled={authLoading}>
                  {authLoading ? <><Loader size={16} className="spin" /> {t("auth.processing", lang)}</> : <><LogIn size={16} /> {authView === "login" ? t("auth.signin_btn", lang) : t("auth.create_account", lang)}</>}
                </button>
              </form>

              {authView === "login" && (
                <p style={{ fontSize: "0.85rem", color: "var(--text-3)", textAlign: "center" }}>
                  {t("auth.no_account", lang)}{" "}
                  <button style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontWeight: 600, textDecoration: "underline", fontSize: "0.85rem" }}
                    onClick={() => { setAuthView("register"); setAuthError(""); }}>{t("auth.register_here", lang)}</button>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── WELCOME ── */}
        {view === "welcome" && (
          <div className="panel" style={{ maxWidth: 780, margin: "2rem auto", textAlign: "center", display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div>
              <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>{t("welcome.title", lang)}</h2>
              <p style={{ color: "var(--text-2)", fontSize: "1rem" }}>
                {t("welcome.desc", lang)}
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "2rem", fontSize: "0.85rem", fontWeight: 600 }}>
              <span style={{ color: "var(--accent)" }}><ShieldCheck size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />{t("welcome.zero_leak", lang)}</span>
              <span style={{ color: "var(--primary)" }}><Lock size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />{t("welcome.local_encrypt", lang)}</span>
            </div>
            <div style={{ textAlign: "left" }}>
              <h3 style={{ fontSize: "1.1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.6rem", marginBottom: "1rem" }}>
                {t("welcome.select_category", lang)}
              </h3>
              <div className="welcome-grid">
                {[
                  { key: "theft", name: "Theft / Burglary", icon: DollarSign, color: "var(--primary)" },
                  { key: "assault", name: "Physical Assault / Threat", icon: AlertTriangle, color: "#f59e0b" },
                  { key: "harassment", name: "Harassment / Stalking", icon: EyeOff, color: "#ec4899" },
                  { key: "cyber", name: "Cyber Crime / Fraud", icon: Cpu, color: "var(--accent)" },
                  { key: "missing", name: "Missing Person", icon: UserX, color: "#a855f7" },
                  { key: "general", name: "General / Other", icon: FileText, color: "var(--text-3)" }
                ].map(item => (
                  <div key={item.name} className="complaint-card" onClick={() => startNewSession(item.name)}>
                    <div className="complaint-card-icon"><item.icon size={22} style={{ color: item.color }} /></div>
                    <div className="complaint-card-label">
                      <span>{t(`cat.${item.key}`, lang)}</span>
                      <ChevronRight size={15} style={{ color: "var(--text-3)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CHAT ── */}
        {view === "chat" && (
          <div className="interview-layout">
            <div className="panel convo-pane">
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <h3 style={{ fontSize: "1rem" }}>{t("chat.title", lang)}</h3>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>{t("chat.turn_info", lang, { turn: currentTurn })}</p>
                </div>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <button className="btn btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem" }} onClick={() => setIsMuted(!isMuted)}>
                    {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    <span>{isMuted ? t("chat.unmute", lang) : t("chat.mute", lang)}</span>
                  </button>
                </div>
              </div>

              <div className="convo-messages">
                {transcript.map((msg, i) => (
                  <div key={i} className={`msg ${msg.role === "user" ? "msg-user" : "msg-bot"}`}>
                    <div className="msg-bubble">
                      <div className="msg-label">{msg.role === "user" ? t("chat.your_speech", lang) : t("chat.assistant", lang)}</div>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", color: "var(--text-2)", fontSize: "0.85rem" }}>
                    <Loader size={15} className="spin" /> {t("chat.analyzing", lang)}
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              <div className="voice-controls">
                <AudioVisualizer isRecording={isRecording} />

                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", width: "100%" }}>
                  <div style={{ textAlign: "center", flex: "0 0 auto" }}>
                    <button className={`mic-btn ${micState}`} onClick={toggleRecording} disabled={isProcessing}>
                      {isRecording ? <MicOff size={30} /> : <Mic size={30} />}
                    </button>
                    <div className={`mic-status-label ${isRecording ? "green" : isProcessing ? "gray" : "gray"}`}>
                      {isRecording ? t("chat.listening", lang) : t("chat.tap_to_speak", lang)}
                    </div>
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {recognitionError && <div className="auth-error" style={{ margin: 0 }}><AlertTriangle size={12} />{recognitionError}</div>}
                    <form onSubmit={e => { e.preventDefault(); sendMessage(inputText); }} style={{ display: "flex", gap: "0.5rem" }}>
                      <input type="text" className="form-input" placeholder={t("chat.type_placeholder", lang)} value={inputText}
                        onChange={e => setInputText(e.target.value)} disabled={isProcessing} style={{ margin: 0 }} />
                      <button className="btn btn-primary" type="submit" disabled={isProcessing || !inputText.trim()}><Send size={16} /></button>
                    </form>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <button className="btn btn-danger" style={{ padding: "0.5rem 1rem" }} onClick={cancelSession}>{t("chat.cancel", lang)}</button>
                  <button className="btn btn-accent" style={{ padding: "0.5rem 1rem" }} onClick={() => setView("editor")}>
                    {t("chat.proceed", lang)} <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Extraction Sidebar */}
            <div className="panel extraction-pane">
              <h3 style={{ fontSize: "0.95rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>{t("chat.live_extraction", lang)}</h3>
              {extractionFields.map(item => (
                <div key={item.key} className="ext-field">
                  <span className="ext-label"><item.icon size={11} />{t(`field.${item.key}`, lang)}</span>
                  <div className={`ext-value ${extractedData[item.key] ? "filled" : "empty"}`}>
                    {extractedData[item.key] || t("chat.not_extracted", lang)}
                  </div>
                </div>
              ))}
              <div className="turn-bar">
                {extractionFields.map((f, i) => <div key={f.key} className={`turn-dot ${extractedData[f.key] ? "done" : ""}`} style={{ transitionDelay: `${i * 0.05}s` }} />)}
              </div>
              <div style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: "var(--radius-sm)", padding: "0.6rem", fontSize: "0.72rem", color: "var(--text-2)", marginTop: "auto" }}>
                {t("chat.extraction_hint", lang)}
              </div>
            </div>
          </div>
        )}

        {/* ── EDITOR ── */}
        {view === "editor" && (
          <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              <h2>{t("editor.title", lang)}</h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>{t("editor.desc", lang)}</p>
            </div>
            <div className="editor-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group">
                    <label className="form-label">{t("editor.victim_label", lang)}</label>
                    <input type="text" className="form-input" value={extractedData.victim_name || ""}
                      onChange={e => setExtractedData({ ...extractedData, victim_name: e.target.value })} placeholder={t("editor.victim_placeholder", lang)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t("editor.contact_label", lang)}</label>
                    <input type="text" className="form-input" value={extractedData.victim_contact || ""}
                      onChange={e => setExtractedData({ ...extractedData, victim_contact: e.target.value })} placeholder={t("editor.contact_placeholder", lang)} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="form-group">
                    <label className="form-label">{t("editor.datetime_label", lang)}</label>
                    <input type="text" className="form-input" value={extractedData.incident_date_time || ""}
                      onChange={e => setExtractedData({ ...extractedData, incident_date_time: e.target.value })} placeholder={t("editor.datetime_placeholder", lang)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t("editor.location_label", lang)}</label>
                    <input type="text" className="form-input" value={extractedData.incident_location || ""}
                      onChange={e => setExtractedData({ ...extractedData, incident_location: e.target.value })} placeholder={t("editor.location_placeholder", lang)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t("editor.suspect_label", lang)}</label>
                  <input type="text" className="form-input" value={extractedData.suspect_details || ""}
                    onChange={e => setExtractedData({ ...extractedData, suspect_details: e.target.value })} placeholder={t("editor.suspect_placeholder", lang)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("editor.evidence_label", lang)}</label>
                  <input type="text" className="form-input" value={extractedData.evidence || ""}
                    onChange={e => setExtractedData({ ...extractedData, evidence: e.target.value })} placeholder={t("editor.evidence_placeholder", lang)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t("editor.witness_label", lang)}</label>
                  <input type="text" className="form-input" value={extractedData.witness || ""}
                    onChange={e => setExtractedData({ ...extractedData, witness: e.target.value })} placeholder={t("editor.witness_placeholder", lang)} />
                </div>
              </div>
              <div className="form-group" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <label className="form-label">{t("editor.narrative_label", lang)}</label>
                <textarea className="form-textarea" style={{ flex: 1, resize: "none" }} value={extractedData.description || ""}
                  onChange={e => setExtractedData({ ...extractedData, description: e.target.value })} placeholder={t("editor.narrative_placeholder", lang)} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-ghost" onClick={() => setView("chat")}>{t("editor.back_to_voice", lang)}</button>
                <button className="btn btn-ghost" style={{ color: "var(--danger)" }} onClick={() => setExtractedData({ victim_name: "", victim_contact: "", incident_date_time: "", incident_location: "", suspect_details: "", evidence: "", witness: "", description: "" })}>
                  {t("editor.clear_all", lang)}
                </button>
              </div>
              <button className="btn btn-accent" onClick={saveFIR} disabled={isProcessing}>
                <Check size={17} /> {t("editor.save_preview", lang)}
              </button>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {view === "preview" && selectedFir && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2>{t("preview.title", lang)}</h2>
                <p style={{ color: "var(--text-2)", fontSize: "0.82rem" }}>{t("preview.desc", lang)}</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-ghost" onClick={() => setView("editor")}><Edit size={15} /> {t("preview.modify", lang)}</button>
                <button className="btn btn-primary" onClick={handlePrint}><Printer size={15} /> {t("preview.print", lang)}</button>
                <button className="btn btn-ghost" onClick={() => setView("welcome")}><Home size={15} /> {t("preview.home", lang)}</button>
              </div>
            </div>

            <div className="fir-preview-doc">
              <div className="fir-doc-header">
                <h1>{t("fir.title", lang)}</h1>
                <p>{t("fir.subtitle", lang)}</p>
              </div>
              <div className="fir-meta-grid">
                <div><strong>{t("fir.complaint_type", lang)}:</strong> {selectedFir.complaint_type}</div>
                <div><strong>{t("fir.report_id", lang)}:</strong> AI-FIR-{selectedFir.id}</div>
                <div><strong>{t("fir.date", lang)}:</strong> {new Date(selectedFir.created_at).toLocaleString()}</div>
                <div><strong>{t("fir.status", lang)}:</strong> {selectedFir.status}</div>
              </div>

              <div className="fir-section-title">{t("fir.section1", lang)}</div>
              <div className="fir-detail-grid">
                <div><strong>{t("fir.name", lang)}:</strong></div><div>{selectedFir.victim_name}</div>
                <div><strong>{t("fir.contact", lang)}:</strong></div><div>{selectedFir.victim_contact}</div>
              </div>

              <div className="fir-section-title">{t("fir.section2", lang)}</div>
              <div className="fir-detail-grid">
                <div><strong>{t("fir.date_time", lang)}:</strong></div><div>{selectedFir.incident_date_time}</div>
                <div><strong>{t("fir.location", lang)}:</strong></div><div>{selectedFir.incident_location}</div>
                <div><strong>{t("fir.suspect", lang)}:</strong></div><div>{selectedFir.suspect_details}</div>
                <div><strong>{t("fir.evidence", lang)}:</strong></div><div>{selectedFir.evidence}</div>
              </div>

              <div className="fir-section-title">{t("fir.section3", lang)}</div>
              <div className="fir-narrative">{selectedFir.description}</div>

              <div className="fir-sigs">
                <div className="fir-sig-block">
                  <div className="fir-sig-line">{t("fir.sig_complainant", lang)}</div>
                </div>
                <div className="fir-sig-block">
                  <div className="fir-sig-line">{t("fir.sig_authority", lang)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {view === "history" && (
          <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              <div>
                <h2>{t("history.title", lang)}</h2>
                <p style={{ color: "var(--text-2)", fontSize: "0.82rem" }}>{t("history.desc", lang)}</p>
              </div>
              <button className="btn btn-ghost" onClick={() => setView("welcome")}><Home size={15} /> {t("app.home", lang)}</button>
            </div>
            {savedFirs.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-3)" }}>
                <FileText size={48} style={{ opacity: 0.3, margin: "0 auto 1rem", display: "block" }} />
                <p>{t("history.empty", lang)}</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="history-table">
                  <thead><tr>
                    <th>{t("history.col_id", lang)}</th><th>{t("history.col_date", lang)}</th><th>{t("history.col_category", lang)}</th><th>{t("history.col_name", lang)}</th><th>{t("history.col_contact", lang)}</th><th>{t("history.col_actions", lang)}</th>
                  </tr></thead>
                  <tbody>
                    {savedFirs.map(fir => (
                      <tr key={fir.id} onClick={() => { setSelectedFir(fir); setView("preview"); }}>
                        <td style={{ fontWeight: 700 }}>AI-FIR-{fir.id}</td>
                        <td>{new Date(fir.created_at).toLocaleDateString()}</td>
                        <td>{fir.complaint_type}</td>
                        <td>{fir.victim_name}</td>
                        <td>{fir.victim_contact}</td>
                        <td>
                          <button className="btn btn-ghost" style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
                            onClick={e => { e.stopPropagation(); setSelectedFir(fir); setView("preview"); }}>{t("history.open", lang)}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── PRINT LAYOUT ── */}
      {selectedFir && (
        <div className="print-only">
          <div className="print-watermark">{t("print.confidential", lang)}</div>
          <div className="print-header">
            <h1>{t("print.title", lang)}</h1>
            <p>{t("print.subtitle", lang)}</p>
          </div>
          <div className="print-meta">
            <div><strong>1. {t("print.district", lang)}:</strong> LOCAL INCIDENT PORTAL</div>
            <div><strong>2. {t("fir.date", lang)}:</strong> {new Date(selectedFir.created_at).toLocaleString()}</div>
            <div><strong>3. {t("print.fir_ref", lang)}:</strong> AI-FIR-{selectedFir.id}</div>
            <div><strong>4. {t("print.category", lang)}:</strong> {selectedFir.complaint_type}</div>
          </div>
          <div className="print-section">
            <h2>{t("print.section5", lang)}</h2>
            <div className="print-detail">
              <div><strong>{t("print.full_name", lang)}:</strong> {selectedFir.victim_name}</div>
              <div><strong>{t("print.contact_no", lang)}:</strong> {selectedFir.victim_contact}</div>
            </div>
          </div>
          <div className="print-section">
            <h2>{t("print.section6", lang)}</h2>
            <div className="print-detail">
              <div><strong>{t("print.place", lang)}:</strong> {selectedFir.incident_location}</div>
              <div><strong>{t("print.date_time", lang)}:</strong> {selectedFir.incident_date_time}</div>
              <div><strong>{t("print.suspect", lang)}:</strong> {selectedFir.suspect_details}</div>
              <div><strong>{t("print.evidence", lang)}:</strong> {selectedFir.evidence}</div>
            </div>
          </div>
          <div className="print-section">
            <h2>{t("print.section7", lang)}</h2>
            <div className="print-narrative">{selectedFir.description}</div>
          </div>
          <div className="print-sigs">
            <div className="print-sig"><div className="print-sig-line">{t("print.sig_complainant", lang)}</div></div>
            <div className="print-sig"><div className="print-sig-line">{t("print.sig_authority", lang)}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
