import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import chatRouter from "./routes/chat.mjs";
import firRouter from "./routes/fir.mjs";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/fir_app";
const PORT = process.env.PORT || 8000;

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// In-memory fallback storage when MongoDB is not available
export const memoryStore = {
  sessions: [],
  firs: [],
};

// Routes
app.use("/api/chat", chatRouter);
app.use("/api/fir", firRouter);

// Status endpoint
app.get("/api/status", (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.json({
    backend_running: true,
    database_connected: dbState === 1,
    ollama_connected: false,
    ollama_model: null,
  });
});

// Start
async function start() {
  try {
    await mongoose.connect(MONGO_URI, { bufferCommands: false, serverSelectionTimeoutMS: 3000 });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.warn("⚠️ MongoDB not available, running in offline mode");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 FIR Backend running on http://0.0.0.0:${PORT}`);
  });
}

start();
