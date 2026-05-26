import { getQuestion, QUESTIONS } from "./language.mjs";

const EXTRACTION_FIELDS = [
  "victim_name", "victim_contact", "incident_location",
  "incident_date_time", "suspect_details", "stolen_item",
  "vehicle_number", "evidence"
];

const ESSENTIAL_FIELDS = [
  "victim_name", "victim_contact", "incident_location", "incident_date_time"
];

// --- Phone extraction ---
function extractPhone(text) {
  const wordMap = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", oh: "0" };
  let conv = text.toLowerCase();
  for (const [w, d] of Object.entries(wordMap)) conv = conv.replace(new RegExp(`\\b${w}\\b`, "g"), d);
  const digits = conv.replace(/\D/g, "");
  const m10 = digits.match(/\d{10}/);
  if (m10) return m10[0];
  const any = digits.match(/\d{6,}/);
  if (any) return any[0];
  return null;
}

// --- Vehicle number extraction (Indian format) ---
function extractVehicle(text) {
  const m = text.match(/\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{1,4}\b/i);
  return m ? m[0].toUpperCase() : null;
}

// --- Name extraction ---
function extractName(text) {
  const m = text.match(/(?:my name is|i am|this is|name is)\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)/i);
  return m ? m[1].trim() : null;
}

// --- Location extraction ---
function extractLocation(text) {
  const m = text.match(/(?:at|in|near|outside|happened at|occurred at|place is)\s+([A-Za-z0-9][A-Za-z0-9\s,]{3,60}?)\s*(?:\.|,|yesterday|today|last|this morning|this evening|at\s+\d|$)/i);
  return m ? m[1].trim() : null;
}

// --- Date/Time extraction ---
function extractDateTime(text) {
  const m = text.match(/(?:yesterday|today|last night|this morning|this evening|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
  return m ? m[0].trim() : null;
}

// --- Suspect extraction ---
function extractSuspect(text) {
  const m = text.match(/(?:suspect|thief|attacker|person)\s+(?:was|wore|had|is)\s+([^.]{5,80})/i);
  return m ? m[0].trim() : null;
}

// --- Stolen item extraction ---
function extractStolenItem(text) {
  const m = text.match(/(?:stole|stolen|took|taken|robbe?d|snatched?)\s+(?:my\s+)?([^.]{3,60})/i);
  return m ? m[1].trim() : null;
}

// --- Evidence extraction ---
function extractEvidence(text) {
  const m = text.match(/(?:cctv|camera|witness|video|photo|recording|evidence)[^.\n]{0,60}/i);
  return m ? m[0].trim() : null;
}

// --- Identify which field a question is about (multilingual) ---
function identifyFieldFromQuestion(content) {
  if (!content) return null;
  const c = content.toLowerCase();
  for (const lang of ["en", "hi", "te"]) {
    for (const field of EXTRACTION_FIELDS) {
      let qText = (QUESTIONS[field]?.[lang] || "").toLowerCase();
      if (!qText) continue;
      // For questions with {name} placeholder, use the part after it
      if (qText.includes("{name}")) {
        qText = qText.split("{name}").pop() || "";
      }
      const prefix = qText.trim().slice(0, 25);
      if (prefix && c.includes(prefix)) return field;
    }
  }
  return null;
}

// --- What was last asked ---
function whatWasLastAsked(messages) {
  const fieldKeywords = {
    victim_name:        ["name", "full name", "your name"],
    victim_contact:     ["contact", "phone", "number", "digit", "mobile", "reach you"],
    incident_location:  ["location", "address", "place", "where exactly"],
    incident_date_time: ["date and", "what was the date"],
    suspect_details:    ["suspect", "thief", "attacker", "the person"],
    stolen_item:        ["stolen", "items", "taken", "stole", "snatched"],
    vehicle_number:     ["vehicle", "car", "bike", "number plate"],
    evidence:           ["evidence", "cctv", "witness", "proof"],
  };

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const c = msg.content.toLowerCase();
      // Try English keywords first
      for (const [field, kws] of Object.entries(fieldKeywords)) {
        if (kws.some(k => c.includes(k))) return field;
      }
      // Fallback: match against question templates in all languages
      const identified = identifyFieldFromQuestion(msg.content);
      if (identified) return identified;
    }
  }
  return null;
}

// --- Count how many times each field was asked ---
function countAsked(messages) {
  const counts = {};
  for (const f of EXTRACTION_FIELDS) counts[f] = 0;
  const fieldKeywords = {
    victim_name:        ["name", "full name"],
    victim_contact:     ["contact", "phone", "number", "digit", "mobile"],
    incident_location:  ["location", "address", "place", "where exactly"],
    incident_date_time: ["date and", "what was the date"],
    suspect_details:    ["suspect", "thief", "attacker"],
    stolen_item:        ["stolen", "items", "taken", "stole"],
    vehicle_number:     ["vehicle", "car", "bike", "number plate"],
    evidence:           ["evidence", "cctv", "witness"],
  };
  for (const msg of messages) {
    if (msg.role === "assistant") {
      const c = msg.content.toLowerCase();
      let matched = false;
      for (const [field, kws] of Object.entries(fieldKeywords)) {
        if (kws.some(k => c.includes(k))) { counts[field]++; matched = true; break; }
      }
      if (!matched) {
        const identified = identifyFieldFromQuestion(msg.content);
        if (identified) counts[identified]++;
      }
    }
  }
  return counts;
}

// --- Main extraction + questioning ---
function extractAndQuestion(complaintType, messages, existingData, lang = "en") {
  const updated = { ...existingData };
  const userMsgs = messages.filter(m => m.role === "user").map(m => m.content);
  const fullText = userMsgs.join(" ");
  const lastUser = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : "";

  const lastAsked = whatWasLastAsked(messages.slice(0, -1));

  if (lastAsked && lastUser.trim() && !updated[lastAsked]) {
    switch (lastAsked) {
      case "victim_name":
        updated.victim_name = lastUser.trim().replace(/\b\w/g, c => c.toUpperCase());
        break;
      case "victim_contact": {
        const vcDigits = lastUser.replace(/\D/g, "");
        updated.victim_contact = extractPhone(lastUser) || vcDigits.slice(0, 10) || lastUser.trim();
        break;
      }
      case "incident_location":
        updated.incident_location = lastUser.trim();
        break;
      case "incident_date_time":
        updated.incident_date_time = lastUser.trim();
        break;
      case "suspect_details":
        updated.suspect_details = lastUser.trim();
        break;
      case "stolen_item":
        updated.stolen_item = lastUser.trim();
        break;
      case "vehicle_number": {
        const vnCleaned = lastUser.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 15);
        updated.vehicle_number = extractVehicle(lastUser) || vnCleaned || lastUser.trim();
        break;
      }
      case "evidence":
        updated.evidence = lastUser.trim();
        break;
    }
  }

  // Deep regex extraction
  if (!updated.victim_name) {
    const n = extractName(fullText);
    if (n) updated.victim_name = n.replace(/\b\w/g, c => c.toUpperCase());
  }

  if (!updated.victim_contact) {
    const p = extractPhone(fullText);
    if (p) updated.victim_contact = p;
  }

  // Fallback: if last assistant asked about contact, accept raw text
  if (!updated.victim_contact && lastUser.trim()) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant" && messages[i].content.toLowerCase().match(/(contact|phone|number|mobile)/)) {
        updated.victim_contact = lastUser.trim();
        break;
      }
    }
  }

  if (!updated.incident_location) {
    const l = extractLocation(fullText);
    if (l) updated.incident_location = l;
  }

  if (!updated.incident_date_time) {
    const d = extractDateTime(fullText);
    if (d) updated.incident_date_time = d;
  }

  if (!updated.suspect_details) {
    const s = extractSuspect(fullText);
    if (s) updated.suspect_details = s;
  }

  if (!updated.stolen_item) {
    const s = extractStolenItem(fullText);
    if (s) updated.stolen_item = s;
  }

  if (!updated.vehicle_number) {
    const v = extractVehicle(fullText);
    if (v) updated.vehicle_number = v;
  }

  if (!updated.evidence) {
    const e = extractEvidence(fullText);
    if (e) updated.evidence = e;
  }

  updated.description = fullText.slice(0, 1000);

  // Determine next question
  const counts = countAsked(messages);
  const name = updated.victim_name || "";

  const questionOrder = [
    "victim_name", "victim_contact", "incident_location",
    "incident_date_time", "suspect_details", "stolen_item",
    "vehicle_number", "evidence"
  ];

  const allEssentialFilled = ESSENTIAL_FIELDS.every(f => updated[f]);

  for (const field of questionOrder) {
    if (!updated[field] && (counts[field] || 0) < 2) {
      const questionText = getQuestion(field, lang, name);
      return { extracted: updated, question: questionText, finished: false };
    }
  }

  const completeText = getQuestion("complete", lang);
  return { extracted: updated, question: completeText, finished: true };
}

export { extractAndQuestion, EXTRACTION_FIELDS, ESSENTIAL_FIELDS };
