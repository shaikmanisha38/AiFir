import json
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from .database import engine, Base, get_db
from .models import FIRReport, ChatSession, User
from .schemas import (
    ChatRequest, ChatResponse, FIRCreate, FIRResponse,
    SystemStatus, UserRegister, UserLogin, Token, UserResponse
)
from .services import llm_service
from .services.auth_service import hash_password, verify_password, create_access_token, decode_token

# Auto-create all DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI FIR Privacy-Focused Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Auth Helper ──────────────────────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ─── Auth Endpoints ───────────────────────────────────────────
@app.post("/api/auth/register", response_model=Token)
def register(data: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        hashed_password=hash_password(data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"user_id": user.id, "email": user.email})
    return Token(access_token=token, user=UserResponse.model_validate(user))

@app.post("/api/auth/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"user_id": user.id, "email": user.email})
    return Token(access_token=token, user=UserResponse.model_validate(user))

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ─── System Status ────────────────────────────────────────────
@app.get("/api/status", response_model=SystemStatus)
def get_status(db: Session = Depends(get_db)):
    db_connected = False
    try:
        db.execute(Base.metadata.tables["fir_reports"].select().limit(1))
        db_connected = True
    except Exception:
        pass
    ollama_connected, active_model = llm_service.check_ollama_connection()
    return SystemStatus(
        backend_running=True,
        database_connected=db_connected,
        ollama_connected=ollama_connected,
        ollama_model=active_model
    )

# ─── Chat Endpoints ───────────────────────────────────────────
@app.post("/api/chat/message", response_model=ChatResponse)
def handle_chat_message(request: ChatRequest, db: Session = Depends(get_db)):
    session_id = request.session_id
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()

    if not session:
        if not request.complaint_type:
            raise HTTPException(status_code=400, detail="New session requires complaint_type")
        session = ChatSession(
            session_id=session_id,
            user_id=request.user_id,
            complaint_type=request.complaint_type,
            current_turn=0,
            extracted_data_json=json.dumps({
                "victim_name": None, "victim_contact": None,
                "incident_date_time": None, "incident_location": None,
                "suspect_details": None, "evidence": None, "description": None
            }),
            messages_json=json.dumps([])
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    messages = json.loads(session.messages_json)
    extracted_data = json.loads(session.extracted_data_json)

    # Initial greeting
    if not request.message and len(messages) == 0:
        greeting = (
            "Hello! I am your AI police assistant. "
            "What is your complaint? Please describe what happened in detail."
        )
        messages.append({"role": "assistant", "content": greeting})
        session.messages_json = json.dumps(messages)
        db.commit()
        return ChatResponse(
            session_id=session_id, message=greeting,
            current_turn=0, extracted_data=extracted_data, finished=False
        )

    if request.message:
        messages.append({"role": "user", "content": request.message})

    new_extracted, next_question = llm_service.analyze_complaint(
        session.complaint_type, messages, extracted_data
    )

    if request.message:
        session.current_turn += 1

    essential_fields = ["victim_name", "victim_contact", "incident_location", "incident_date_time"]
    all_essential_filled = all(new_extracted.get(f) for f in essential_fields)
    finished = session.current_turn >= 3 or all_essential_filled

    if finished:
        next_question = (
            "Thank you. I have gathered all the necessary information. "
            "Your FIR form is now ready. Please review and confirm the details."
        )

    messages.append({"role": "assistant", "content": next_question})
    session.messages_json = json.dumps(messages)
    session.extracted_data_json = json.dumps(new_extracted)
    db.commit()

    return ChatResponse(
        session_id=session_id, message=next_question,
        current_turn=session.current_turn,
        extracted_data=new_extracted, finished=finished
    )

# ─── FIR Endpoints ────────────────────────────────────────────
@app.post("/api/fir/save", response_model=FIRResponse)
def save_fir_report(fir_data: FIRCreate, db: Session = Depends(get_db)):
    report = FIRReport(
        user_id=fir_data.user_id,
        complaint_type=fir_data.complaint_type,
        victim_name=fir_data.victim_name,
        victim_contact=fir_data.victim_contact,
        incident_date_time=fir_data.incident_date_time,
        incident_location=fir_data.incident_location,
        suspect_details=fir_data.suspect_details,
        evidence=fir_data.evidence,
        description=fir_data.description,
        status=fir_data.status or "Draft",
        transcript_json=fir_data.transcript_json
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report

@app.get("/api/fir/list", response_model=List[FIRResponse])
def get_fir_list(db: Session = Depends(get_db)):
    return db.query(FIRReport).order_by(FIRReport.created_at.desc()).all()

@app.get("/api/fir/{fir_id}", response_model=FIRResponse)
def get_fir_details(fir_id: int, db: Session = Depends(get_db)):
    report = db.query(FIRReport).filter(FIRReport.id == fir_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="FIR report not found")
    return report
