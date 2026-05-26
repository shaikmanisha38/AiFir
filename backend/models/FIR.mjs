import mongoose from "mongoose";

const firSchema = new mongoose.Schema({
  complaint_type:     { type: String, default: "" },
  victim_name:        { type: String, default: "" },
  victim_contact:     { type: String, default: "" },
  incident_date_time: { type: String, default: "" },
  incident_location:  { type: String, default: "" },
  suspect_details:    { type: String, default: "" },
  stolen_item:        { type: String, default: "" },
  vehicle_number:     { type: String, default: "" },
  evidence:           { type: String, default: "" },
  description:        { type: String, default: "" },
  language:           { type: String, default: "en" },
  status:             { type: String, default: "Draft" },
  transcript_json:    { type: String, default: "[]" },
}, { timestamps: true });

export default mongoose.model("FIR", firSchema);
