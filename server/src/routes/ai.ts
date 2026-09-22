import { Router } from "express";
import { anthropic } from "../ai.js";

export const aiRouter = Router();

aiRouter.get("/health", async (_req, res) => {
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 32,
      messages: [
        { role: "user", content: "Reply with just the word: ok" },
      ],
    });

    const text = response.content.find((block) => block.type === "text")?.text ?? "";
    res.json({ status: "ok", reply: text.trim() });
  } catch (err) {
    res.status(502).json({ status: "error", error: (err as Error).message });
  }
});
