import { randomUUID } from "node:crypto";
import { Router } from "express";
import { db } from "../db.js";

interface Script {
  id: string;
  title: string;
  sceneCount: number;
  lastEdited: string;
}

export const scriptsRouter = Router();

scriptsRouter.get("/", (_req, res) => {
  const scripts = db
    .prepare(
      "SELECT id, title, scene_count AS sceneCount, last_edited AS lastEdited FROM scripts ORDER BY last_edited DESC",
    )
    .all() as Script[];

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

  db.prepare(
    "INSERT INTO scripts (id, title, scene_count, last_edited) VALUES (?, ?, ?, ?)",
  ).run(script.id, script.title, script.sceneCount, script.lastEdited);

  res.status(201).json(script);
});
