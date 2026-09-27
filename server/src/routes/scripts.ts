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

scriptsRouter.get("/:id", (req, res) => {
  const script = db
    .prepare(
      "SELECT id, title, scene_count AS sceneCount, last_edited AS lastEdited FROM scripts WHERE id = ?",
    )
    .get(req.params.id) as Script | undefined;

  if (!script) {
    res.status(404).json({ error: "script not found" });
    return;
  }

  res.json(script);
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

scriptsRouter.delete("/:id", (req, res) => {
  const { id } = req.params;

  const script = db.prepare("SELECT id FROM scripts WHERE id = ?").get(id);
  if (!script) {
    res.status(404).json({ error: "script not found" });
    return;
  }

  const deleteScript = db.transaction((scriptId: string) => {
    db.prepare(
      `DELETE FROM scene_characters
       WHERE scene_id IN (SELECT id FROM scenes WHERE script_id = ?)
          OR character_id IN (SELECT id FROM characters WHERE script_id = ?)`,
    ).run(scriptId, scriptId);
    db.prepare(
      `DELETE FROM character_entries
       WHERE character_id IN (SELECT id FROM characters WHERE script_id = ?)`,
    ).run(scriptId);
    db.prepare("DELETE FROM characters WHERE script_id = ?").run(scriptId);
    db.prepare("DELETE FROM scenes WHERE script_id = ?").run(scriptId);
    db.prepare("DELETE FROM scripts WHERE id = ?").run(scriptId);
  });
  deleteScript(id);

  res.status(204).send();
});
