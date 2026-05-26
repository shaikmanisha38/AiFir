import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  session_id:       { type: String, unique: true, required: true },
  complaint_type:   { type: String, default: "" },
  language:         { type: String, default: "en" },
  current_turn:     { type: Number, default: 0 },
  extracted_data:   { type: mongoose.Schema.Types.Mixed, default: {} },
  messages:         { type: [{ role: String, content: String }], default: [] },
}, { timestamps: true });

export default mongoose.model("Session", sessionSchema);
