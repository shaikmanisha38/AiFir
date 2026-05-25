from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

class FIRReport(Base):
    __tablename__ = "fir_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)  # linked to user
    complaint_type = Column(String, nullable=False)
    victim_name = Column(String, nullable=True)
    victim_contact = Column(String, nullable=True)
    incident_date_time = Column(String, nullable=True)
    incident_location = Column(String, nullable=True)
    suspect_details = Column(String, nullable=True)
    evidence = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String, default="Draft")
    transcript_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    session_id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    complaint_type = Column(String, nullable=False)
    current_turn = Column(Integer, default=0)
    extracted_data_json = Column(Text, default="{}")
    messages_json = Column(Text, default="[]")
    last_updated = Column(DateTime, onupdate=func.now(), server_default=func.now())
