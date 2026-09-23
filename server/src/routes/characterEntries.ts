import { randomUUID } from "node:crypto";
import { Router } from "express";
import { db } from "../db.js";

interface CharacterEntry {
  id: string;
  characterId: string;
  content: string;
  source: "manual" | "auto";
  createdAt: string;
}

const ENTRY_COLUMNS = "id, character_id AS characterId, content, source, created_at AS createdAt";

export const characterEntriesRouter = Router({ mergeParams: true });

characterEntriesRouter.get("/", (req, res) => {
  const { characterId } = req.params as { characterId: string };
  const entries = db
    .prepare(`SELECT ${ENTRY_COLUMNS} FROM character_entries WHERE character_id = ? ORDER BY created_at ASC`)
    .all(characterId) as CharacterEntry[];

  res.json(entries);
});

characterEntriesRouter.post("/", (req, res) => {
  const { content } = req.body;
  const { characterId } = req.params as { characterId: string };

  if (typeof content !== "string" || content.trim() === "") {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const character = db.prepare("SELECT id FROM characters WHERE id = ?").get(characterId);
  if (!character) {
    res.status(404).json({ error: "character not found" });
    return;
  }

  const entry: CharacterEntry = {
    id: randomUUID(),
    characterId,
    content: content.trim(),
    source: "manual",
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    "INSERT INTO character_entries (id, character_id, content, source, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(entry.id, entry.characterId, entry.content, entry.source, entry.createdAt);

  res.status(201).json(entry);
});

characterEntriesRouter.patch("/:id", (req, res) => {
  const { content } = req.body;
  const { characterId, id } = req.params as { characterId: string; id: string };

  if (typeof content !== "string" || content.trim() === "") {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const result = db
    .prepare("UPDATE character_entries SET content = ? WHERE id = ? AND character_id = ?")
    .run(content.trim(), id, characterId);

  if (result.changes === 0) {
    res.status(404).json({ error: "entry not found" });
    return;
  }

  const entry = db.prepare(`SELECT ${ENTRY_COLUMNS} FROM character_entries WHERE id = ?`).get(id);
  res.json(entry);
});

characterEntriesRouter.delete("/:id", (req, res) => {
  const { characterId, id } = req.params as { characterId: string; id: string };

  const result = db
    .prepare("DELETE FROM character_entries WHERE id = ? AND character_id = ?")
    .run(id, characterId);

  if (result.changes === 0) {
    res.status(404).json({ error: "entry not found" });
    return;
  }

  res.status(204).send();
});
