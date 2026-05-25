// Language detection based on Unicode script ranges
// Supports: English (en), Hindi (hi), Telugu (te)

const SCRIPT_RANGES = {
  hi: { start: 0x0900, end: 0x097F },
  te: { start: 0x0C00, end: 0x0C7F },
};

function detectLanguage(text) {
  if (!text || !text.trim()) return "en";

  let hiCount = 0, teCount = 0, enCount = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (!cp) continue;
    if (cp >= SCRIPT_RANGES.hi.start && cp <= SCRIPT_RANGES.hi.end) hiCount++;
    else if (cp >= SCRIPT_RANGES.te.start && cp <= SCRIPT_RANGES.te.end) teCount++;
    else if (cp >= 0x0041 && cp <= 0x005A) enCount++;
    else if (cp >= 0x0061 && cp <= 0x007A) enCount++;
  }

  const total = hiCount + teCount + enCount;
  if (total === 0) return "en";

  // Return the dominant script
  if (hiCount > enCount && hiCount > teCount) return "hi";
  if (teCount > enCount && teCount > hiCount) return "te";
  return "en";
}

const LANGUAGE_NAMES = {
  en: "English",
  hi: "हिन्दी",
  te: "తెలుగు",
};

const GREETINGS = {
  en: "Hello! I am your AI police assistant. I will help you file a First Information Report. Please describe the incident in detail when the microphone is active.",
  hi: "नमस्ते! मैं आपका AI पुलिस सहायक हूं। मैं आपको प्रथम सूचना रिपोर्ट दर्ज करने में मदद करूंगा। जब माइक्रोफोन सक्रिय हो तो कृपया घटना का विस्तार से वर्णन करें।",
  te: "నమస్కారం! నేను మీ AI పోలీసు సహాయకుడిని. మీరు ఫస్ట్ ఇన్ఫర్మేషన్ రిపోర్ట్ ఫైల్ చేయడంలో నేను సహాయం చేస్తాను. మైక్రోఫోన్ యాక్టివ్‌గా ఉన్నప్పుడు దయచేసి సంఘటనను వివరంగా వివరించండి.",
};

const QUESTIONS = {
  victim_name: {
    en: "To register your complaint, could you please tell me your full name?",
    hi: "अपनी शिकायत दर्ज कराने के लिए, कृपया मुझे अपना पूरा नाम बताएं?",
    te: "మీ ఫిర్యాదును నమోదు చేయడానికి, దయచేసి మీ పూర్తి పేరు చెప్పగలరా?",
  },
  victim_contact: {
    en: "Thank you {name}. What is your 10-digit contact number?",
    hi: "धन्यवाद {name}। आपका 10 अंकों का संपर्क नंबर क्या है?",
    te: "ధన్యవాదాలు {name}. మీ 10 అంకెల సంప్రదింపు నంబర్ ఏమిటి?",
  },
  incident_location: {
    en: "Where exactly did the incident take place? Please give the location or address.",
    hi: "घटना वास्तव में कहां हुई? कृपया स्थान या पता बताएं।",
    te: "సంఘటన ఎక్కడ జరిగింది? దయచేసి స్థలం లేదా చిరునామా ఇవ్వండి.",
  },
  incident_date_time: {
    en: "What was the date and approximate time when this happened?",
    hi: "यह घटना कब हुई? तारीख और लगभग समय बताएं।",
    te: "ఇది ఎప్పుడు జరిగింది? తేదీ మరియు సమయం చెప్పండి.",
  },
  suspect_details: {
    en: "Can you describe the suspect — their appearance, clothing, or any identifying features?",
    hi: "क्या आप संदिग्ध का वर्णन कर सकते हैं — उनकी शक्ल, कपड़े, या कोई पहचान विशेषता?",
    te: "మీరు నిందితుడిని వివరించగలరా — వారి రూపం, దుస్తులు లేదా గుర్తింపు వివరాలు?",
  },
  stolen_item: {
    en: "What items were stolen or taken? Describe them in detail.",
    hi: "क्या सामान चोरी हुआ या लिया गया? उनका विस्तार से वर्णन करें।",
    te: "ఏ వస్తువులు చోరీ అయ్యాయి? వాటిని వివరంగా చెప్పండి.",
  },
  vehicle_number: {
    en: "What is the vehicle number involved? (if applicable)",
    hi: "इसमें शामिल वाहन नंबर क्या है? (यदि लागू हो)",
    te: "సంబంధిత వాహన నంబర్ ఏమిటి? (వర్తిస్తే)",
  },
  evidence: {
    en: "Is there any CCTV footage, witnesses, or other evidence available?",
    hi: "क्या कोई सीसीटीवी फुटेज, गवाह या अन्य सबूत उपलब्ध है?",
    te: "ఏదైనా సీసీటీవీ ఫుటేజ్, సాక్షులు లేదా ఇతర ఆధారాలు అందుబాటులో ఉన్నాయా?",
  },
  complete: {
    en: "Thank you. I have gathered all the necessary information. Your FIR form is now ready. Please tap 'Review Form' to verify the details.",
    hi: "धन्यवाद। मैंने सभी आवश्यक जानकारी एकत्र कर ली है। आपका FIR फॉर्म अब तैयार है। कृपया विवरण सत्यापित करने के लिए 'Review Form' पर टैप करें।",
    te: "ధన్యవాదాలు. నేను అవసరమైన మొత్తం సమాచారాన్ని సేకరించాను. మీ FIR ఫారమ్ ఇప్పుడు సిద్ధంగా ఉంది. వివరాలను ధృవీకరించడానికి దయచేసి 'Review Form' ని నొక్కండి.",
  },
};

function getQuestion(field, lang = "en", name = "") {
  const qs = QUESTIONS[field];
  if (!qs) return "Please provide more details.";
  const template = qs[lang] || qs.en;
  return template.replace("{name}", name || "");
}

export { detectLanguage, LANGUAGE_NAMES, GREETINGS, QUESTIONS, getQuestion };
