import { Router } from "express";
import FIR from "../models/FIR.mjs";

const router = Router();

router.post("/save", async (req, res) => {
  try {
    const fir = new FIR(req.body);
    await fir.save();
    res.status(201).json(fir);
  } catch (err) {
    console.error("FIR save error:", err);
    res.status(500).json({ error: "Failed to save FIR" });
  }
});

router.get("/list", async (req, res) => {
  try {
    const list = await FIR.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("FIR list error:", err);
    res.status(500).json({ error: "Failed to fetch FIRs" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const fir = await FIR.findById(req.params.id);
    if (!fir) return res.status(404).json({ error: "FIR not found" });
    res.json(fir);
  } catch (err) {
    console.error("FIR get error:", err);
    res.status(500).json({ error: "Failed to fetch FIR" });
  }
});

export default router;
