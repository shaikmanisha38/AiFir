// Language detection based on Unicode script ranges
const SCRIPT_RANGES = {
  hi: { start: 0x0900, end: 0x097F },
  te: { start: 0x0C00, end: 0x0C7F },
};

export function detectLanguage(text) {
  if (!text || !text.trim()) return "en";

  let hiCount = 0, teCount = 0, enCount = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (!cp) continue;
    if (cp >= SCRIPT_RANGES.hi.start && cp <= SCRIPT_RANGES.hi.end) hiCount++;
    else if (cp >= SCRIPT_RANGES.te.start && cp <= SCRIPT_RANGES.te.end) teCount++;
    else if ((cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A)) enCount++;
  }

  const total = hiCount + teCount + enCount;
  if (total === 0) return "en";

  if (hiCount > enCount && hiCount > teCount) return "hi";
  if (teCount > enCount && teCount > hiCount) return "te";
  return "en";
}

export const LANG_NAMES = {
  en: "English",
  hi: "हिन्दी (Hindi)",
  te: "తెలుగు (Telugu)",
};

export const LANG_TTS = {
  en: "en-IN",
  hi: "hi-IN",
  te: "te-IN",
};

export const MULTILINGUAL_QUESTIONS = {
  victim_name: {
    en: "To register your complaint, could you please tell me your full name?",
    hi: "अपनी शिकायत दर्ज कराने के लिए, कृपया मुझे अपना पूरा नाम बताएं?",
    te: "మీ ఫిర్యాదును నమోదు చేయడానికి, దయచేసి మీ పూర్తి పేరు చెప్పగలరా?",
  },
  victim_contact: {
    en: "What is your 10-digit contact number?",
    hi: "आपका 10 अंकों का संपर्क नंबर क्या है?",
    te: "మీ 10 అంకెల సంప్రదింపు నంబర్ ఏమిటి?",
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
    en: "What items were stolen or taken? Describe them.",
    hi: "क्या सामान चोरी हुआ या लिया गया? उनका वर्णन करें।",
    te: "ఏ వస్తువులు చోరీ అయ్యాయి? వాటిని వివరించండి.",
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
    en: "Thank you. I have gathered all the necessary information. Your FIR form is now ready.",
    hi: "धन्यवाद। मैंने सभी आवश्यक जानकारी एकत्र कर ली है। आपका FIR फॉर्म अब तैयार है।",
    te: "ధన్యవాదాలు. నేను అవసరమైన మొత్తం సమాచారాన్ని సేకరించాను. మీ FIR ఫారమ్ ఇప్పుడు సిద్ధంగా ఉంది.",
  },
};
