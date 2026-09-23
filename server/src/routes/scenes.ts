import { randomUUID } from "node:crypto";
import { Router } from "express";
import { draftScene, generateSceneMeta, type SceneCharacter } from "../ai.js";
import { db } from "../db.js";

interface Scene {
  id: string;
  scriptId: string;
  heading: string;
  title: string;
  actionContext: string;
  subtext: string;
  draft: string;
  createdAt: string;
}

const SCENE_COLUMNS =
  "id, script_id AS scriptId, heading, title, action_context AS actionContext, subtext, draft, created_at AS createdAt";

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
    draft: "",
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

const EDITABLE_FIELDS: Record<string, string> = {
  heading: "heading",
  title: "title",
  actionContext: "action_context",
  subtext: "subtext",
};

scenesRouter.patch("/:id", (req, res) => {
  const { scriptId, id } = req.params as { scriptId: string; id: string };
  const updates = Object.entries(EDITABLE_FIELDS).filter(([field]) => req.body[field] !== undefined);

  if (updates.length === 0) {
    res.status(400).json({ error: `at least one of ${Object.keys(EDITABLE_FIELDS).join(", ")} is required` });
    return;
  }

  for (const [field] of updates) {
    const value = req.body[field];
    if (typeof value !== "string" || value.trim() === "") {
      res.status(400).json({ error: `${field} must be a non-empty string` });
      return;
    }
  }

  const existing = db
    .prepare("SELECT id FROM scenes WHERE id = ? AND script_id = ?")
    .get(id, scriptId);

  if (!existing) {
    res.status(404).json({ error: "scene not found" });
    return;
  }

  for (const [field, column] of updates) {
    db.prepare(`UPDATE scenes SET ${column} = ? WHERE id = ?`).run(req.body[field].trim(), id);
  }

  db.prepare("UPDATE scripts SET last_edited = ? WHERE id = ?").run(
    new Date().toISOString(),
    scriptId,
  );

  const scene = db.prepare(`SELECT ${SCENE_COLUMNS} FROM scenes WHERE id = ?`).get(id) as Scene;

  res.json(scene);
});

function getSceneCharacters(sceneId: string): SceneCharacter[] {
  const characters = db
    .prepare(
      `SELECT c.id, c.name, c.note
       FROM scene_characters sc
       JOIN characters c ON c.id = sc.character_id
       WHERE sc.scene_id = ?
       ORDER BY c.created_at ASC`,
    )
    .all(sceneId) as { id: string; name: string; note: string }[];

  const entriesStmt = db.prepare(
    "SELECT content FROM character_entries WHERE character_id = ? ORDER BY created_at ASC",
  );

  return characters.map((character) => ({
    name: character.name,
    note: character.note,
    entries: (entriesStmt.all(character.id) as { content: string }[]).map((e) => e.content),
  }));
}

scenesRouter.post("/:id/draft", async (req, res) => {
  const { scriptId, id } = req.params as { scriptId: string; id: string };

  const scene = db
    .prepare(`SELECT ${SCENE_COLUMNS} FROM scenes WHERE id = ? AND script_id = ?`)
    .get(id, scriptId) as Scene | undefined;

  if (!scene) {
    res.status(404).json({ error: "scene not found" });
    return;
  }

  try {
    const draft = await draftScene({
      heading: scene.heading,
      actionContext: scene.actionContext,
      subtext: scene.subtext,
      characters: getSceneCharacters(id),
    });

    db.prepare("UPDATE scenes SET draft = ? WHERE id = ?").run(draft, id);
    db.prepare("UPDATE scripts SET last_edited = ? WHERE id = ?").run(
      new Date().toISOString(),
      scriptId,
    );

    res.json({ ...scene, draft });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
