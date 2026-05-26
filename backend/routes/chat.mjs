import { Router } from "express";
import Session from "../models/Session.mjs";
import { extractAndQuestion } from "../services/llm.mjs";
import { detectLanguage, GREETINGS } from "../services/language.mjs";

const router = Router();

const EMPTY_EXTRACTED = {
  victim_name: "", victim_contact: "", incident_date_time: "",
  incident_location: "", suspect_details: "", stolen_item: "",
  vehicle_number: "", evidence: "", description: ""
};

router.post("/message", async (req, res) => {
  try {
    const { session_id, message, complaint_type, language } = req.body;

    let session = await Session.findOne({ session_id });

    if (!session) {
      if (!complaint_type) {
        return res.status(400).json({ error: "New session requires complaint_type" });
      }
      const detectedLang = language || (message ? detectLanguage(message) : "en");
      session = new Session({
        session_id,
        complaint_type,
        language: detectedLang,
        current_turn: 0,
        extracted_data: { ...EMPTY_EXTRACTED },
        messages: [],
      });
      await session.save();
    }

    const messages = session.messages || [];
    const extracted = session.extracted_data || { ...EMPTY_EXTRACTED };

    // Initial greeting
    if (!message && messages.length === 0) {
      const greeting = GREETINGS[session.language] || GREETINGS.en;
      session.messages = [{ role: "assistant", content: greeting }];
      await session.save();
      return res.json({
        session_id, message: greeting,
        current_turn: 0, extracted_data: extracted, finished: false,
        language: session.language,
      });
    }

    if (message) {
      // Respect frontend-provided language; fall back to detection
      const msgLang = language || detectLanguage(message);
      session.language = msgLang;
      messages.push({ role: "user", content: message });
    }

    const result = extractAndQuestion(
      session.complaint_type, messages, extracted, session.language
    );

    if (message) {
      session.current_turn += 1;
    }

    session.extracted_data = result.extracted;
    session.messages = [...messages, { role: "assistant", content: result.question }];
    await session.save();

    res.json({
      session_id,
      message: result.question,
      current_turn: session.current_turn,
      extracted_data: result.extracted,
      finished: result.finished,
      language: session.language,
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
