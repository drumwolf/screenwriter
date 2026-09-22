import { randomUUID } from "node:crypto";
import { Router } from "express";
import { generateSceneMeta } from "../ai.js";
import { db } from "../db.js";

interface Scene {
  id: string;
  scriptId: string;
  heading: string;
  title: string;
  actionContext: string;
  subtext: string;
  createdAt: string;
}

const SCENE_COLUMNS =
  "id, script_id AS scriptId, heading, title, action_context AS actionContext, subtext, created_at AS createdAt";

export const scenesRouter = Router({ mergeParams: true });

scenesRouter.get("/", (req, res) => {
  const { scriptId } = req.params as { scriptId: string };
  const scenes = db
    .prepare(`SELECT ${SCENE_COLUMNS} FROM scenes WHERE script_id = ? ORDER BY created_at ASC`)
    .all(scriptId) as Scene[];

  res.json(scenes);
});

scenesRouter.post("/", async (req, res) => {
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

  const trimmedActionContext = actionContext.trim();
  const { heading, title } = await generateSceneMeta(trimmedActionContext);

  const now = new Date().toISOString();
  const scene: Scene = {
    id: randomUUID(),
    scriptId,
    heading,
    title,
    actionContext: trimmedActionContext,
    subtext: subtext.trim(),
    createdAt: now,
  };

  db.prepare(
    "INSERT INTO scenes (id, script_id, heading, title, action_context, subtext, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    scene.id,
    scene.scriptId,
    scene.heading,
    scene.title,
    scene.actionContext,
    scene.subtext,
    scene.createdAt,
  );

  db.prepare(
    "UPDATE scripts SET scene_count = scene_count + 1, last_edited = ? WHERE id = ?",
  ).run(now, scriptId);

  res.status(201).json(scene);
});

scenesRouter.patch("/:id", (req, res) => {
  const { heading, title } = req.body;
  const { scriptId, id } = req.params as { scriptId: string; id: string };

  if (heading === undefined && title === undefined) {
    res.status(400).json({ error: "heading or title is required" });
    return;
  }

  if (heading !== undefined && (typeof heading !== "string" || heading.trim() === "")) {
    res.status(400).json({ error: "heading must be a non-empty string" });
    return;
  }

  if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
    res.status(400).json({ error: "title must be a non-empty string" });
    return;
  }

  const existing = db
    .prepare("SELECT id FROM scenes WHERE id = ? AND script_id = ?")
    .get(id, scriptId);

  if (!existing) {
    res.status(404).json({ error: "scene not found" });
    return;
  }

  if (heading !== undefined) {
    db.prepare("UPDATE scenes SET heading = ? WHERE id = ?").run(heading.trim(), id);
  }
  if (title !== undefined) {
    db.prepare("UPDATE scenes SET title = ? WHERE id = ?").run(title.trim(), id);
  }

  db.prepare("UPDATE scripts SET last_edited = ? WHERE id = ?").run(
    new Date().toISOString(),
    scriptId,
  );

  const scene = db.prepare(`SELECT ${SCENE_COLUMNS} FROM scenes WHERE id = ?`).get(id) as Scene;

  res.json(scene);
});
