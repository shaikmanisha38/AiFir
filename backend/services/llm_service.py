import json
import re
import requests
from typing import Dict, List, Optional, Tuple

OLLAMA_URL = "http://localhost:11434"
DEFAULT_MODEL = "qwen2.5:7b" # Or llama3, mistral, qwen

def check_ollama_connection() -> Tuple[bool, Optional[str]]:
    """Checks if Ollama is running and returns the status + model list."""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_names = [m["name"] for m in models]
            if model_names:
                # Find a match or return the first available
                for preferred in ["qwen", "llama3", "mistral"]:
                    match = next((m for m in model_names if preferred in m), None)
                    if match:
                        return True, match
                return True, model_names[0]
            return True, "No models loaded"
    except Exception:
        pass
    return False, None

def fallback_extract_and_question(
    complaint_type: str,
    conversation_history: List[Dict[str, str]],
    existing_data: Dict[str, Optional[str]]
) -> Tuple[Dict[str, Optional[str]], str]:
    """
    Fallback parser using regular expressions and heuristics to extract information
    and ask relevant questions if Ollama is not active.
    """
    updated_data = {**existing_data}
    
    # Concatenate all user messages to analyze full context
    user_texts = [msg["content"] for msg in conversation_history if msg["role"] == "user"]
    full_text = " ".join(user_texts)
    
    # 1. Heuristic Extraction
    # Name extraction (e.g. "my name is John Doe", "I am Jane")
    if not updated_data.get("victim_name"):
        name_match = re.search(r"(?:my name is|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", full_text, re.IGNORECASE)
        if name_match:
            updated_data["victim_name"] = name_match.group(1)
            
    # Phone number extraction (looking for 10-digit number)
    if not updated_data.get("victim_contact"):
        phone_match = re.search(r"\b\d{10}\b", full_text)
        if phone_match:
            updated_data["victim_contact"] = phone_match.group(0)
        else:
            contact_phrase = re.search(r"(?:phone|number|contact is|contact number is)\s*([0-9\-\s]{10,15})", full_text, re.IGNORECASE)
            if contact_phrase:
                updated_data["victim_contact"] = contact_phrase.group(1).strip()

    # Location extraction (e.g. "at sector 62", "in New Delhi", "near central park")
    if not updated_data.get("incident_location"):
        loc_match = re.search(r"(?:at|in|near|outside|inside)\s+([A-Z][a-zA-Z0-9\s,]{3,30})(?=\s+(?:yesterday|today|on|at|i\b|the\b|$))", full_text)
        if loc_match:
            updated_data["incident_location"] = loc_match.group(1).strip()
        else:
            # Fallback simpler check
            loc_match2 = re.search(r"(?:place of occurrence is|happened at|occurred at|happened in)\s+([^.]+)", full_text, re.IGNORECASE)
            if loc_match2:
                updated_data["incident_location"] = loc_match2.group(1).strip()

    # Time extraction (e.g. "yesterday", "at 10 PM", "on Friday")
    if not updated_data.get("incident_date_time"):
        time_match = re.search(r"(?:yesterday|today|last night|morning|evening|afternoon|\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b)", full_text, re.IGNORECASE)
        if time_match:
            updated_data["incident_date_time"] = time_match.group(0)
            
    # Suspect details (e.g. "he was tall", "wearing red jacket", "suspect is...")
    if not updated_data.get("suspect_details"):
        suspect_match = re.search(r"(?:suspect was|suspect is|the thief was|he was|she was|suspect details:?)\s+([^.]+)", full_text, re.IGNORECASE)
        if suspect_match:
            updated_data["suspect_details"] = suspect_match.group(1).strip()

    # Evidence details
    if not updated_data.get("evidence"):
        evidence_match = re.search(r"(?:evidence|witness|cctv|camera|recording|have a video)\s+([^.]+)", full_text, re.IGNORECASE)
        if evidence_match:
            updated_data["evidence"] = evidence_match.group(0).strip()

    # Description (fill with the general text)
    if not updated_data.get("description"):
        updated_data["description"] = full_text[:500]
    else:
        # Append latest user input to build the full description
        if len(user_texts) > 0 and user_texts[-1] not in updated_data["description"]:
            updated_data["description"] += f" | {user_texts[-1]}"

    # 2. Find missing information and generate next question
    # Order of importance: Name -> Contact -> Location -> Date/Time -> Suspect Details
    if not updated_data.get("victim_name"):
        question = "To log the report, could you please tell me your full name?"
    elif not updated_data.get("victim_contact"):
        question = f"Thank you, {updated_data['victim_name']}. What is a contact number where the police can reach you?"
    elif not updated_data.get("incident_location"):
        question = "Where did this incident occur? Please provide the location or address."
    elif not updated_data.get("incident_date_time"):
        question = "What was the date and approximate time of the incident?"
    elif not updated_data.get("suspect_details") and complaint_type in ["Theft", "Assault", "Harassment", "Cyber Crime"]:
        question = "Can you describe the suspect? Mention their clothing, height, or any identifying marks if known."
    elif not updated_data.get("evidence"):
        question = "Is there any evidence, photos, or CCTV footage available at the location?"
    else:
        question = "Got it. Do you have any additional details or witnesses to add, or should we compile the form now?"

    return updated_data, question

def analyze_complaint(
    complaint_type: str,
    conversation_history: List[Dict[str, str]],
    existing_data: Dict[str, Optional[str]]
) -> Tuple[Dict[str, Optional[str]], str]:
    """
    Main orchestration entrypoint. Tries calling Ollama.
    Falls back to regex heuristics if Ollama fails or is not installed.
    """
    is_connected, model_to_use = check_ollama_connection()
    if not is_connected or not model_to_use or model_to_use == "No models loaded":
        # Fallback to local rule processor
        return fallback_extract_and_question(complaint_type, conversation_history, existing_data)

    # Prepare Ollama system instructions
    system_instruction = (
        "You are an expert police officer filing a First Information Report (FIR). "
        "Your task is to analyze the conversation history and extract these fields: "
        "'victim_name', 'victim_contact', 'incident_date_time', 'incident_location', 'suspect_details', 'evidence', 'description'. "
        f"The complaint category is: {complaint_type}.\n"
        "You must respond with valid JSON format ONLY. Do not write introductory words or normal text. "
        "The JSON should contain: \n"
        "1. 'extracted_fields': a dictionary of the updated fields. Keep existing values if not mentioned in new messages, or overwrite if corrected.\n"
        "2. 'next_question': formulate a concise follow-up question (under 25 words) targeting the most critical missing field. "
        "Prioritize: victim_name -> victim_contact -> incident_location -> incident_date_time -> suspect_details -> evidence.\n\n"
        "Output format:\n"
        "{\n"
        "  \"extracted_fields\": {\n"
        "    \"victim_name\": \"...\",\n"
        "    \"victim_contact\": \"...\",\n"
        "    \"incident_date_time\": \"...\",\n"
        "    \"incident_location\": \"...\",\n"
        "    \"suspect_details\": \"...\",\n"
        "    \"evidence\": \"...\",\n"
        "    \"description\": \"...\"\n"
        "  },\n"
        "  \"next_question\": \"...\"\n"
        "}"
    )

    prompt = (
        f"Existing Data: {json.dumps(existing_data)}\n"
        f"Conversation History: {json.dumps(conversation_history)}\n"
        "Extract the updated data and provide the next follow-up question in JSON format:"
    )

    try:
        payload = {
            "model": model_to_use,
            "prompt": f"{system_instruction}\n\n{prompt}",
            "system": system_instruction,
            "stream": False,
            "format": "json"
        }
        
        response = requests.post(f"{OLLAMA_URL}/api/generate", json=payload, timeout=8)
        if response.status_code == 200:
            result = response.json().get("response", "")
            # Find JSON in the response (sometimes models wrap in markdown)
            json_match = re.search(r"\{.*\}", result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                extracted = data.get("extracted_fields", {})
                next_q = data.get("next_question", "Could you provide more details about the incident?")
                
                # Merge existing with newly extracted to prevent losing fields
                merged = {**existing_data}
                for k, v in extracted.items():
                    if v:
                        merged[k] = v
                return merged, next_q
    except Exception as e:
        print(f"Ollama request error: {e}")

    # Final fallback if Ollama fails mid-request
    return fallback_extract_and_question(complaint_type, conversation_history, existing_data)
