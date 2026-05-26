import json
import re
import requests
from typing import Dict, List, Optional, Tuple

OLLAMA_URL = "http://localhost:11434"

def check_ollama_connection() -> Tuple[bool, Optional[str]]:
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_names = [m["name"] for m in models]
            if model_names:
                for preferred in ["qwen", "llama3", "mistral"]:
                    match = next((m for m in model_names if preferred in m), None)
                    if match:
                        return True, match
                return True, model_names[0]
            return True, "No models loaded"
    except Exception:
        pass
    return False, None


def _extract_phone(text: str) -> Optional[str]:
    """
    Robust phone extraction — handles digits with spaces, dashes, dots,
    word-numbered sequences like 'nine eight seven...', and common Indian
    formats like +91-9876543210.
    """
    # Word-to-digit mapping
    word_map = {
        "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
        "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
        "oh": "0"
    }

    # Convert word-numbered text to digits
    converted = text.lower()
    for word, digit in word_map.items():
        converted = re.sub(r"\b" + word + r"\b", digit, converted)

    # Strip non-digit chars and look for 10-digit run
    digits_only = re.sub(r"\D", "", converted)
    match = re.search(r"\d{10}", digits_only)
    if match:
        return match.group(0)

    # Try extracting digits scattered with spaces/dashes between them
    spaced = re.findall(r"(?:\d[\s\-]?){9}\d", text)
    if spaced:
        return re.sub(r"\D", "", spaced[-1])

    # Last resort: any 6+ digit number
    any_digits = re.findall(r"\d{6,}", digits_only)
    if any_digits:
        return any_digits[-1]

    return None


def _what_was_last_asked(messages: List[Dict]) -> Optional[str]:
    """Return which field the last assistant question was targeting."""
    for msg in reversed(messages):
        if msg["role"] == "assistant":
            c = msg["content"].lower()
            if any(w in c for w in ["contact", "phone", "number", "reach you", "digit", "mobile"]):
                return "victim_contact"
            if any(w in c for w in ["name", "full name", "your name"]):
                return "victim_name"
            if any(w in c for w in ["location", "address", "where", "place"]):
                return "incident_location"
            if any(w in c for w in ["date", "time", "when", "day"]):
                return "incident_date_time"
            if any(w in c for w in ["suspect", "describe", "person", "thief"]):
                return "suspect_details"
            if any(w in c for w in ["evidence", "cctv", "witness", "proof"]):
                return "evidence"
    return None


def fallback_extract_and_question(
    complaint_type: str,
    conversation_history: List[Dict[str, str]],
    existing_data: Dict[str, Optional[str]]
) -> Tuple[Dict[str, Optional[str]], str]:

    updated = {**existing_data}

    # All user messages combined
    user_msgs = [m["content"] for m in conversation_history if m["role"] == "user"]
    full_text  = " ".join(user_msgs)
    last_user  = user_msgs[-1] if user_msgs else ""

    # ── Figure out what was last asked so we can ACCEPT the answer ──────────
    last_asked = _what_was_last_asked(conversation_history[:-1])  # exclude latest user msg

    # If the last question was about a field and user replied → accept raw answer
    if last_asked and last_user.strip() and not updated.get(last_asked):
        if last_asked == "victim_contact":
            phone = _extract_phone(last_user)
            updated["victim_contact"] = phone if phone else last_user.strip()
        elif last_asked == "victim_name":
            updated["victim_name"] = last_user.strip().title()
        elif last_asked == "incident_location":
            updated["incident_location"] = last_user.strip()
        elif last_asked == "incident_date_time":
            updated["incident_date_time"] = last_user.strip()
        elif last_asked == "suspect_details":
            updated["suspect_details"] = last_user.strip()
        elif last_asked == "evidence":
            updated["evidence"] = last_user.strip()

    # ── Deep extraction passes (regex) on full text ──────────────────────────

    # Name
    if not updated.get("victim_name"):
        m = re.search(r"(?:my name is|i am|this is|name is)\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)*)", full_text, re.I)
        if m:
            updated["victim_name"] = m.group(1).strip().title()

    # Contact – robust
    if not updated.get("victim_contact"):
        phone = _extract_phone(full_text)
        if phone:
            updated["victim_contact"] = phone

    # Fallback: if the last assistant asked about contact and the user replied
    # with non-empty text, accept whatever the user said (handles word-form
    # numbers, ASR noise, non-standard formats)
    if not updated.get("victim_contact") and last_user.strip():
        for msg in reversed(conversation_history[:-1]):
            if msg["role"] == "assistant":
                c = msg["content"].lower()
                if any(w in c for w in ["contact", "phone", "number", "reach you", "digit", "mobile"]):
                    updated["victim_contact"] = last_user.strip()
                break

    # Location
    if not updated.get("incident_location"):
        m = re.search(r"(?:at|in|near|outside|inside|happened at|occurred at|place is)\s+([A-Za-z0-9][A-Za-z0-9\s,]{3,40}?)(?:\.|,|$)", full_text, re.I)
        if m:
            updated["incident_location"] = m.group(1).strip()

    # Date/Time
    if not updated.get("incident_date_time"):
        m = re.search(r"(?:yesterday|today|last night|this morning|this evening|last week|on\s+\w+day|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}:\d{2}\s*(?:am|pm)?)", full_text, re.I)
        if m:
            updated["incident_date_time"] = m.group(0).strip()

    # Suspect
    if not updated.get("suspect_details"):
        m = re.search(r"(?:suspect|thief|attacker|person|he|she)\s+(?:was|wore|had|is)\s+([^.]{5,80})", full_text, re.I)
        if m:
            updated["suspect_details"] = m.group(0).strip()

    # Evidence
    if not updated.get("evidence"):
        m = re.search(r"(?:cctv|camera|witness|video|photo|recording|evidence)[^\.\n]{0,60}", full_text, re.I)
        if m:
            updated["evidence"] = m.group(0).strip()

    # Description – always accumulate
    updated["description"] = full_text[:800]

    # ── Determine next question ───────────────────────────────────────────────
    # Count how many times each field's question was already asked
    asked_counts: Dict[str, int] = {
        "victim_name": 0, "victim_contact": 0,
        "incident_location": 0, "incident_date_time": 0,
        "suspect_details": 0, "evidence": 0
    }
    field_keywords = {
        "victim_name":       ["name", "full name"],
        "victim_contact":    ["contact", "phone", "number", "reach you", "digit", "mobile"],
        "incident_location": ["location", "address", "where", "place"],
        "incident_date_time":["date", "time", "when"],
        "suspect_details":   ["suspect", "describe", "thief", "attacker"],
        "evidence":          ["evidence", "cctv", "witness"]
    }
    for msg in conversation_history:
        if msg["role"] == "assistant":
            c = msg["content"].lower()
            for field, kws in field_keywords.items():
                if any(k in c for k in kws):
                    asked_counts[field] += 1

    # Build ordered question list, skipping fields already filled OR asked too many times
    MAX_RETRY = 2  # ask each field at most twice before moving on
    name = updated.get("victim_name", "")

    question_order = [
        ("victim_name",        "To register your complaint, could you please tell me your full name?"),
        ("victim_contact",     f"Thank you{', ' + name if name else ''}. What is your 10-digit contact number?"),
        ("incident_location",  "Where exactly did this incident take place? Please give the location or address."),
        ("incident_date_time", "What was the date and approximate time when this happened?"),
        ("suspect_details",    "Can you describe the suspect — their appearance, clothing, or any identifying features?"),
        ("evidence",           "Is there any CCTV footage, witnesses, or other evidence available?"),
    ]

    for field, q_text in question_order:
        if not updated.get(field) and asked_counts.get(field, 0) < MAX_RETRY:
            return updated, q_text

    # All done
    return updated, (
        "Thank you for providing all the details. "
        "Your FIR form is now ready. Please review the information shown."
    )


def analyze_complaint(
    complaint_type: str,
    conversation_history: List[Dict[str, str]],
    existing_data: Dict[str, Optional[str]],
    language: str = "en"
) -> Tuple[Dict[str, Optional[str]], str]:

    is_connected, model = check_ollama_connection()
    if not is_connected or not model or model == "No models loaded":
        return fallback_extract_and_question(complaint_type, conversation_history, existing_data)

    system_prompt = (
        "You are an AI police assistant helping file a First Information Report (FIR). "
        "Analyze the conversation and extract these JSON fields: "
        "victim_name, victim_contact, incident_date_time, incident_location, "
        "suspect_details, evidence, description. "
        f"Complaint category: {complaint_type}. "
        "Respond ONLY with valid JSON containing 'extracted_fields' and 'next_question'. "
        "next_question must ask for the MOST IMPORTANT missing field only (max 20 words). "
        "If all essential fields are present, set next_question to 'COMPLETE'."
    )

    prompt = (
        f"Existing data: {json.dumps(existing_data)}\n"
        f"Conversation: {json.dumps(conversation_history)}\n"
        "Respond in JSON:"
    )

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": model, "prompt": f"{system_prompt}\n\n{prompt}",
                  "stream": False, "format": "json"},
            timeout=10
        )
        if resp.status_code == 200:
            raw = resp.json().get("response", "")
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if m:
                data = json.loads(m.group(0))
                extracted = data.get("extracted_fields", {})
                next_q    = data.get("next_question", "")

                merged = {**existing_data}
                for k, v in extracted.items():
                    if v and v not in ("null", "None", ""):
                        merged[k] = v

                if next_q == "COMPLETE" or not next_q:
                    next_q = "Thank you. Your FIR form is now ready. Please review the details."

                return merged, next_q
    except Exception as e:
        print(f"Ollama error: {e}")

    return fallback_extract_and_question(complaint_type, conversation_history, existing_data)
