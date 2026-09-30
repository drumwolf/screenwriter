import { Router } from "express";
import { checkClaudeHealth } from "../ai.js";

export const aiRouter = Router();

aiRouter.get("/health", async (_req, res) => {
  try {
    const reply = await checkClaudeHealth();
    res.json({ status: "ok", reply });
  } catch (err) {
    res.status(502).json({ status: "error", error: (err as Error).message });
  }
});
