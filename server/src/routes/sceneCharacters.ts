import { Router } from "express";
import { db } from "../db.js";

interface Character {
  id: string;
  scriptId: string;
  name: string;
  note: string;
  createdAt: string;
}

export const sceneCharactersRouter = Router({ mergeParams: true });

sceneCharactersRouter.get("/", (req, res) => {
  const { scriptId, sceneId } = req.params as { scriptId: string; sceneId: string };

  const scene = db
    .prepare("SELECT id FROM scenes WHERE id = ? AND script_id = ?")
    .get(sceneId, scriptId);

  if (!scene) {
    res.status(404).json({ error: "scene not found" });
    return;
  }

  const characters = db
    .prepare(
      `SELECT c.id, c.script_id AS scriptId, c.name, c.note, c.created_at AS createdAt
       FROM scene_characters sc
       JOIN characters c ON c.id = sc.character_id
       WHERE sc.scene_id = ?
       ORDER BY c.created_at ASC`,
    )
    .all(sceneId) as Character[];

  res.json(characters);
});

sceneCharactersRouter.put("/", (req, res) => {
  const { scriptId, sceneId } = req.params as { scriptId: string; sceneId: string };
  const { characterIds } = req.body;

  if (!Array.isArray(characterIds) || !characterIds.every((id) => typeof id === "string")) {
    res.status(400).json({ error: "characterIds must be an array of strings" });
    return;
  }

  const scene = db
    .prepare("SELECT id FROM scenes WHERE id = ? AND script_id = ?")
    .get(sceneId, scriptId);

  if (!scene) {
    res.status(404).json({ error: "scene not found" });
    return;
  }

  const uniqueIds = [...new Set(characterIds)];
  if (uniqueIds.length > 0) {
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const validCount = db
      .prepare(
        `SELECT COUNT(*) AS count FROM characters WHERE script_id = ? AND id IN (${placeholders})`,
      )
      .get(scriptId, ...uniqueIds) as { count: number };

    if (validCount.count !== uniqueIds.length) {
      res.status(400).json({ error: "one or more characterIds are invalid for this script" });
      return;
    }
  }

  const applyLinks = db.transaction((ids: string[]) => {
    db.prepare("DELETE FROM scene_characters WHERE scene_id = ?").run(sceneId);
    const insert = db.prepare(
      "INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)",
    );
    for (const characterId of ids) {
      insert.run(sceneId, characterId);
    }
  });

  applyLinks(uniqueIds);

  const characters = db
    .prepare(
      `SELECT c.id, c.script_id AS scriptId, c.name, c.note, c.created_at AS createdAt
       FROM scene_characters sc
       JOIN characters c ON c.id = sc.character_id
       WHERE sc.scene_id = ?
       ORDER BY c.created_at ASC`,
    )
    .all(sceneId) as Character[];

  res.json(characters);
});
