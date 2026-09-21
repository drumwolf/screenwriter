import { randomUUID } from "node:crypto";
import { Router } from "express";

interface Script {
  id: string;
  title: string;
  sceneCount: number;
  lastEdited: string;
}

const scripts: Script[] = [];

export const scriptsRouter = Router();

scriptsRouter.get("/", (_req, res) => {
  res.json(scripts);
});

scriptsRouter.post("/", (req, res) => {
  const { title } = req.body;

  if (typeof title !== "string" || title.trim() === "") {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const script: Script = {
    id: randomUUID(),
    title: title.trim(),
    sceneCount: 0,
    lastEdited: new Date().toISOString(),
  };

  scripts.push(script);
  res.status(201).json(script);
});
