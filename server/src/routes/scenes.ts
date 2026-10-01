import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  checkConsistency,
  draftScene,
  generateSceneMeta,
  type EarlierScene,
  type SceneCharacter,
  type StyleReferenceScene,
} from "../ai.js";
import { db } from "../db.js";

interface Scene {
  id: string;
  scriptId: string;
  heading: string;
  title: string;
  actionContext: string;
  subtext: string;
  draft: string;
  orderIndex: number;
  createdAt: string;
  writtenByUser: boolean;
}

// SQLite has no boolean type, so written_by_user comes back as 0/1.
type SceneRow = Omit<Scene, "writtenByUser"> & { writtenByUser: number };

function toScene(row: SceneRow): Scene {
  return { ...row, writtenByUser: row.writtenByUser === 1 };
}

const SCENE_COLUMNS =
  "id, script_id AS scriptId, heading, title, action_context AS actionContext, subtext, draft, order_index AS orderIndex, created_at AS createdAt, written_by_user AS writtenByUser";

export const scenesRouter = Router({ mergeParams: true });

scenesRouter.get("/", (req, res) => {
  const { scriptId } = req.params as { scriptId: string };
  const scenes = db
    .prepare(`SELECT ${SCENE_COLUMNS} FROM scenes WHERE script_id = ? ORDER BY order_index ASC`)
    .all(scriptId) as SceneRow[];

  res.json(scenes.map(toScene));
});

scenesRouter.put("/order", (req, res) => {
  const { scriptId } = req.params as { scriptId: string };
  const { sceneIds } = req.body;

  if (!Array.isArray(sceneIds) || !sceneIds.every((id) => typeof id === "string")) {
    res.status(400).json({ error: "sceneIds must be an array of strings" });
    return;
  }

  const existing = db
    .prepare("SELECT id FROM scenes WHERE script_id = ?")
    .all(scriptId) as { id: string }[];
  const existingIds = new Set(existing.map((s) => s.id));

  if (
    sceneIds.length !== existingIds.size ||
    !sceneIds.every((id) => existingIds.has(id)) ||
    new Set(sceneIds).size !== sceneIds.length
  ) {
    res.status(400).json({ error: "sceneIds must match exactly the scenes in this script" });
    return;
  }

  const reorder = db.transaction((ids: string[]) => {
    const setOrder = db.prepare("UPDATE scenes SET order_index = ? WHERE id = ?");
    ids.forEach((sceneId, index) => setOrder.run(index, sceneId));
  });
  reorder(sceneIds);

  const scenes = db
    .prepare(`SELECT ${SCENE_COLUMNS} FROM scenes WHERE script_id = ? ORDER BY order_index ASC`)
    .all(scriptId) as SceneRow[];

  res.json(scenes.map(toScene));
});

scenesRouter.post("/", async (req, res) => {
  const { actionContext = "", subtext = "", draft = "" } = req.body;
  const { scriptId } = req.params as { scriptId: string };

  if (typeof actionContext !== "string" || typeof subtext !== "string" || typeof draft !== "string") {
    res.status(400).json({ error: "actionContext, subtext, and draft must be strings" });
    return;
  }

  // A pasted, already-written scene stands on its own, so the planning
  // fields become optional. Without one, they're needed to draft from.
  const trimmedDraft = draft.trim();
  if (trimmedDraft === "") {
    if (actionContext.trim() === "") {
      res.status(400).json({ error: "actionContext is required" });
      return;
    }

    if (subtext.trim() === "") {
      res.status(400).json({ error: "subtext is required" });
      return;
    }
  }

  const script = db
    .prepare("SELECT id, scene_count AS sceneCount FROM scripts WHERE id = ?")
    .get(scriptId) as { id: string; sceneCount: number } | undefined;

  if (!script) {
    res.status(404).json({ error: "script not found" });
    return;
  }

  const trimmedActionContext = actionContext.trim();
  const { heading, title } = await generateSceneMeta(trimmedDraft || trimmedActionContext);

  const { maxOrder } = db
    .prepare("SELECT MAX(order_index) AS maxOrder FROM scenes WHERE script_id = ?")
    .get(scriptId) as { maxOrder: number | null };
  const orderIndex = maxOrder === null ? 0 : maxOrder + 1;

  const now = new Date().toISOString();
  const scene: Scene = {
    id: randomUUID(),
    scriptId,
    heading,
    title,
    actionContext: trimmedActionContext,
    subtext: subtext.trim(),
    draft: trimmedDraft,
    orderIndex,
    createdAt: now,
    writtenByUser: trimmedDraft !== "",
  };

  db.prepare(
    "INSERT INTO scenes (id, script_id, heading, title, action_context, subtext, draft, order_index, created_at, written_by_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    scene.id,
    scene.scriptId,
    scene.heading,
    scene.title,
    scene.actionContext,
    scene.subtext,
    scene.draft,
    scene.orderIndex,
    scene.createdAt,
    scene.writtenByUser ? 1 : 0,
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
  draft: "draft",
};

scenesRouter.patch("/:id", (req, res) => {
  const { scriptId, id } = req.params as { scriptId: string; id: string };
  const updates = Object.entries(EDITABLE_FIELDS).filter(([field]) => req.body[field] !== undefined);
  const { writtenByUser } = req.body;

  if (updates.length === 0 && writtenByUser === undefined) {
    res.status(400).json({
      error: `at least one of ${[...Object.keys(EDITABLE_FIELDS), "writtenByUser"].join(", ")} is required`,
    });
    return;
  }

  if (writtenByUser !== undefined && typeof writtenByUser !== "boolean") {
    res.status(400).json({ error: "writtenByUser must be a boolean" });
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
  if (writtenByUser !== undefined) {
    db.prepare("UPDATE scenes SET written_by_user = ? WHERE id = ?").run(writtenByUser ? 1 : 0, id);
  }

  db.prepare("UPDATE scripts SET last_edited = ? WHERE id = ?").run(
    new Date().toISOString(),
    scriptId,
  );

  const scene = db.prepare(`SELECT ${SCENE_COLUMNS} FROM scenes WHERE id = ?`).get(id) as SceneRow;

  res.json(toScene(scene));
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

function getEarlierScenes(scriptId: string, orderIndex: number): EarlierScene[] {
  const scenes = db
    .prepare(
      `SELECT heading, title, action_context AS actionContext, subtext, draft,
              written_by_user AS writtenByUser
       FROM scenes
       WHERE script_id = ? AND order_index < ?
       ORDER BY order_index ASC`,
    )
    .all(scriptId, orderIndex) as {
    heading: string;
    title: string;
    actionContext: string;
    subtext: string;
    draft: string;
    writtenByUser: number;
  }[];

  return scenes.map((scene) => ({
    heading: scene.heading,
    title: scene.title,
    isDraft: scene.draft !== "",
    writtenByUser: scene.writtenByUser === 1 && scene.draft !== "",
    content:
      scene.draft !== ""
        ? scene.draft
        : `ACTION/CONTEXT: ${scene.actionContext}\nSUBTEXT: ${scene.subtext}`,
  }));
}

// Scenes the writer wrote themselves that come later in the story than the
// scene being drafted. Earlier ones already reach the prompt via
// getEarlierScenes, so they aren't repeated here.
function getLaterUserScenes(scriptId: string, orderIndex: number): StyleReferenceScene[] {
  return db
    .prepare(
      `SELECT heading, title, draft AS content
       FROM scenes
       WHERE script_id = ? AND order_index > ? AND written_by_user = 1 AND draft != ''
       ORDER BY order_index ASC`,
    )
    .all(scriptId, orderIndex) as StyleReferenceScene[];
}

scenesRouter.post("/:id/draft", async (req, res) => {
  const { scriptId, id } = req.params as { scriptId: string; id: string };

  const scene = db
    .prepare(`SELECT ${SCENE_COLUMNS} FROM scenes WHERE id = ? AND script_id = ?`)
    .get(id, scriptId) as SceneRow | undefined;

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
      earlierScenes: getEarlierScenes(scriptId, scene.orderIndex),
      laterUserScenes: getLaterUserScenes(scriptId, scene.orderIndex),
    });

    // The new draft is AI-written, so the scene is no longer the writer's own.
    db.prepare("UPDATE scenes SET draft = ?, written_by_user = 0 WHERE id = ?").run(draft, id);
    db.prepare("UPDATE scripts SET last_edited = ? WHERE id = ?").run(
      new Date().toISOString(),
      scriptId,
    );

    res.json({ ...toScene(scene), draft, writtenByUser: false });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

scenesRouter.post("/:id/check-consistency", async (req, res) => {
  const { scriptId, id } = req.params as { scriptId: string; id: string };

  const scene = db
    .prepare(`SELECT ${SCENE_COLUMNS} FROM scenes WHERE id = ? AND script_id = ?`)
    .get(id, scriptId) as SceneRow | undefined;

  if (!scene) {
    res.status(404).json({ error: "scene not found" });
    return;
  }

  if (!scene.draft) {
    res.status(400).json({ error: "scene has no draft to check" });
    return;
  }

  try {
    const issues = await checkConsistency({
      draft: scene.draft,
      characters: getSceneCharacters(id),
    });

    res.json({ issues });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
