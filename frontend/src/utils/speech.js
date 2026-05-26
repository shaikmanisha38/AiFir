// Browser Web Speech API Wrappers for Speech-to-Text and Text-to-Speech

const LANG_MAP = {
  "en-IN": "en-IN",
  "hi-IN": "hi-IN",
  "te-IN": "te-IN"
};

// 1. Speech-to-Text (Speech Recognition)
export class WebSpeechRecognition {
  constructor() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.supported = false;
      this.recognition = null;
      console.warn("Speech Recognition API is not supported in this browser.");
      return;
    }

    this.supported = true;
    this.lang = "en-IN";
  }

  start(onResult, onError, onEnd) {
    if (!this.supported) {
      onError("Speech Recognition not supported in this browser.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = this.lang;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      onError(event.error);
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    try {
      recognition.start();
      this.recognition = recognition;
    } catch (e) {
      console.error("Error starting speech recognition:", e);
      onError(e.message);
    }
  }

  setLanguage(lang) {
    if (LANG_MAP[lang]) {
      this.lang = LANG_MAP[lang];
    }
  }

  stop() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* already stopped */ }
      this.recognition = null;
    }
  }
}

// 2. Text-to-Speech (Speech Synthesis)
export class WebSpeechSynthesis {
  constructor() {
    this.supported = "speechSynthesis" in window;
    this.voice = null;
    this.lang = "en-IN";

    if (this.supported) {
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.supported) return;
    const voices = window.speechSynthesis.getVoices();

    // First try to match the currently set language
    const langMatch = voices.find(v => v.lang.startsWith(this.lang));
    if (langMatch) { this.voice = langMatch; return; }

    // Fallback for Telugu: look for any Indian or Telugu-related voice
    if (this.lang.startsWith("te")) {
      const teVoice = voices.find(
        v => v.lang.startsWith("te") || v.lang.includes("te-IN") || v.name.toLowerCase().includes("telugu")
      );
      if (teVoice) { this.voice = teVoice; return; }
    }

    const preferredVoice = voices.find(
      (v) => v.lang.includes("en-IN") || v.name.includes("India")
    );
    const standardVoice = voices.find(
      (v) => v.lang.startsWith("en")
    );
    this.voice = preferredVoice || standardVoice || voices[0];
  }

  setLanguage(lang) {
    this.lang = lang;
    if (this.supported) {
      const voices = window.speechSynthesis.getVoices();
      // Try exact match first
      let match = voices.find(v => v.lang.startsWith(lang));
      // For Telugu, try broader match
      if (!match && lang.startsWith("te")) {
        match = voices.find(
          v => v.lang.startsWith("te") || v.name.toLowerCase().includes("telugu")
        );
      }
      if (match) this.voice = match;
    }
  }

  speak(text, onStart, onEnd, onError) {
    if (!this.supported) {
      if (onError) onError("Text-to-Speech not supported.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    utterance.lang = this.lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => { if (onStart) onStart(); };
    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = (event) => {
      console.error("Text-to-speech error:", event.error);
      if (onError) onError(event.error);
    };

    window.speechSynthesis.speak(utterance);
  }

  stop() {
    if (this.supported) {
      window.speechSynthesis.cancel();
    }
  }
}
