# Secure Local AI FIR Assistant (MVP)

A privacy-focused, offline-first digital assistant for filing police First Information Reports (FIRs). It accepts voice inputs, asks up to three intelligent follow-up questions to gather missing details, automatically extracts relevant legal fields, allows text editing, and generates an official printable FIR document—all processing is done **100% locally** to guarantee privacy.

---

## System Architecture

The application is structured into two main components:
1. **Frontend (React.js + Vite)**: A premium glassmorphic dark-themed user interface that manages stateful view routing, sound visualization, official print document generation, and hooks into browser speech recognition/synthesis.
2. **Backend (FastAPI)**: A Python API that processes conversation flows, saves drafts to a local SQLite database, and queries a local Ollama server for advanced entity extraction.

### Three-Tier Privacy & Offline Fallback Strategy
To ensure the application runs instantly on any machine with zero installation latency, we implement automatic browser-level fallbacks:
* **Speech-to-Text & Text-to-Speech**: Falls back automatically to the browser's built-in **Web Speech API** (which runs offline in Chrome, Edge, and Safari). This bypasses the need to compile heavy PyTorch/CUDA-based Whisper models.
* **LLM Reasoning**: Falls back automatically to a local regex/dictionary heuristic parsing service if the local **Ollama** server is not active, allowing the multi-turn incident logging interview loop to run successfully.
* **Database**: Uses a local **SQLite** file-based database, which requires zero configurations and maps database schemas dynamically. If the backend is completely offline, the React frontend runs in standalone browser-only mode using `localStorage`.

---

## Quick Start

### 1. The Easy Way (Windows Double-Click)
Simply double-click the **`run.bat`** file in the root folder of the project.
This script will:
* Check for Node.js and Python.
* Automatically offer to install Python 3.11 via `winget` if missing.
* Set up a Python Virtual Environment (`.venv`) for the backend and install package requirements.
* Install Node packages and start both servers.
* Automatically open the portal in your browser at `http://localhost:5173`.

---

## Integrating Local Open-Source LLMs (Ollama)

To run the application with advanced local AI reasoning:
1. Download and install **Ollama** from [ollama.com](https://ollama.com).
2. Open your command prompt/terminal and pull a supported local model (Qwen is highly recommended for multilingual and Indian context support, Llama 3 for reasoning):
   ```bash
   ollama pull qwen2.5:7b
   ```
   *(or `ollama pull llama3`)*
3. Keep the Ollama application running.
4. Launch the AI FIR Portal. The status badges at the top header will automatically light up green with **OLLAMA: qwen2.5:7b** indicating full local AI processing is live!

---

## MVP Features Developed
* **Voice-based FIR filing**: Mic capture with canvas frequency waves.
* **Offline AI Processing**: Local Ollama support + in-browser fallback.
* **Stateful Q&A Loop**: Up to 3 follow-up question turns targeting missing essential fields.
* **Editable FIR Form**: Interactive double-column editor to correct extracted fields.
* **Print/PDF Export**: Authentic legal layout styling with stamp sign fields and confidence watermarks, accessible via browser print layouts (destined for paper or PDF save).
* **Local Secure Storage**: SQLite database file storing draft/submitted reports.
