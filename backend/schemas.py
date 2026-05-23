from pydantic import BaseModel, Field, EmailStr
from typing import Dict, List, Optional
from datetime import datetime

# ─── Auth Schemas ─────────────────────────────────────────────
class UserRegister(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    phone: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ─── Chat Schemas ──────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    session_id: str
    message: Optional[str] = None
    complaint_type: Optional[str] = None
    user_id: Optional[int] = None
    language: Optional[str] = "en"

class ChatResponse(BaseModel):
    session_id: str
    message: str
    current_turn: int
    extracted_data: Dict[str, Optional[str]]
    finished: bool

# ─── FIR Schemas ───────────────────────────────────────────────
class FIRCreate(BaseModel):
    complaint_type: str
    victim_name: Optional[str] = None
    victim_contact: Optional[str] = None
    incident_date_time: Optional[str] = None
    incident_location: Optional[str] = None
    suspect_details: Optional[str] = None
    evidence: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "Draft"
    transcript_json: Optional[str] = None
    user_id: Optional[int] = None

class FIRResponse(BaseModel):
    id: int
    complaint_type: str
    victim_name: Optional[str]
    victim_contact: Optional[str]
    incident_date_time: Optional[str]
    incident_location: Optional[str]
    suspect_details: Optional[str]
    evidence: Optional[str]
    description: Optional[str]
    status: str
    transcript_json: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class SystemStatus(BaseModel):
    backend_running: bool = True
    database_connected: bool
    ollama_connected: bool
    ollama_model: Optional[str] = None
