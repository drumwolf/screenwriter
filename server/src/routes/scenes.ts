import { randomUUID } from "node:crypto";
import { Router } from "express";
import { db } from "../db.js";

interface Scene {
  id: string;
  scriptId: string;
  heading: string;
  actionContext: string;
  subtext: string;
  createdAt: string;
}

export const scenesRouter = Router({ mergeParams: true });

scenesRouter.get("/", (req, res) => {
  const { scriptId } = req.params as { scriptId: string };
  const scenes = db
    .prepare(
      "SELECT id, script_id AS scriptId, heading, action_context AS actionContext, subtext, created_at AS createdAt FROM scenes WHERE script_id = ? ORDER BY created_at ASC",
    )
    .all(scriptId) as Scene[];

  res.json(scenes);
});

scenesRouter.post("/", (req, res) => {
  const { actionContext, subtext } = req.body;
  const { scriptId } = req.params as { scriptId: string };

  if (typeof actionContext !== "string" || actionContext.trim() === "") {
    res.status(400).json({ error: "actionContext is required" });
    return;
  }

  if (typeof subtext !== "string" || subtext.trim() === "") {
    res.status(400).json({ error: "subtext is required" });
    return;
  }

  const script = db
    .prepare("SELECT id, scene_count AS sceneCount FROM scripts WHERE id = ?")
    .get(scriptId) as { id: string; sceneCount: number } | undefined;

  if (!script) {
    res.status(404).json({ error: "script not found" });
    return;
  }

  const now = new Date().toISOString();
  const scene: Scene = {
    id: randomUUID(),
    scriptId,
    heading: "UNTITLED SCENE",
    actionContext: actionContext.trim(),
    subtext: subtext.trim(),
    createdAt: now,
  };

  db.prepare(
    "INSERT INTO scenes (id, script_id, heading, action_context, subtext, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(scene.id, scene.scriptId, scene.heading, scene.actionContext, scene.subtext, scene.createdAt);

  db.prepare(
    "UPDATE scripts SET scene_count = scene_count + 1, last_edited = ? WHERE id = ?",
  ).run(now, scriptId);

  res.status(201).json(scene);
});

scenesRouter.patch("/:id", (req, res) => {
  const { heading } = req.body;
  const { scriptId, id } = req.params as { scriptId: string; id: string };

  if (typeof heading !== "string" || heading.trim() === "") {
    res.status(400).json({ error: "heading is required" });
    return;
  }

  const result = db
    .prepare("UPDATE scenes SET heading = ? WHERE id = ? AND script_id = ?")
    .run(heading.trim(), id, scriptId);

  if (result.changes === 0) {
    res.status(404).json({ error: "scene not found" });
    return;
  }

  db.prepare("UPDATE scripts SET last_edited = ? WHERE id = ?").run(
    new Date().toISOString(),
    scriptId,
  );

  const scene = db
    .prepare(
      "SELECT id, script_id AS scriptId, heading, action_context AS actionContext, subtext, created_at AS createdAt FROM scenes WHERE id = ?",
    )
    .get(id) as Scene;

  res.json(scene);
});
