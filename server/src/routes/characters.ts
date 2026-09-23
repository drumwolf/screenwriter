import { randomUUID } from "node:crypto";
import { Router } from "express";
import { db } from "../db.js";

interface Character {
  id: string;
  scriptId: string;
  name: string;
  note: string;
  createdAt: string;
}

const CHARACTER_COLUMNS = "id, script_id AS scriptId, name, note, created_at AS createdAt";

export const charactersRouter = Router({ mergeParams: true });

charactersRouter.get("/", (req, res) => {
  const { scriptId } = req.params as { scriptId: string };
  const characters = db
    .prepare(`SELECT ${CHARACTER_COLUMNS} FROM characters WHERE script_id = ? ORDER BY created_at ASC`)
    .all(scriptId) as Character[];

  res.json(characters);
});

charactersRouter.post("/", (req, res) => {
  const { name, note } = req.body;
  const { scriptId } = req.params as { scriptId: string };

  if (typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const script = db.prepare("SELECT id FROM scripts WHERE id = ?").get(scriptId);
  if (!script) {
    res.status(404).json({ error: "script not found" });
    return;
  }

  const character: Character = {
    id: randomUUID(),
    scriptId,
    name: name.trim(),
    note: typeof note === "string" ? note.trim() : "",
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    "INSERT INTO characters (id, script_id, name, note, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(character.id, character.scriptId, character.name, character.note, character.createdAt);

  res.status(201).json(character);
});

charactersRouter.patch("/:id", (req, res) => {
  const { name, note } = req.body;
  const { scriptId, id } = req.params as { scriptId: string; id: string };

  if (name === undefined && note === undefined) {
    res.status(400).json({ error: "name or note is required" });
    return;
  }

  if (name !== undefined && (typeof name !== "string" || name.trim() === "")) {
    res.status(400).json({ error: "name must be a non-empty string" });
    return;
  }

  if (note !== undefined && typeof note !== "string") {
    res.status(400).json({ error: "note must be a string" });
    return;
  }

  const existing = db
    .prepare("SELECT id FROM characters WHERE id = ? AND script_id = ?")
    .get(id, scriptId);

  if (!existing) {
    res.status(404).json({ error: "character not found" });
    return;
  }

  if (name !== undefined) {
    db.prepare("UPDATE characters SET name = ? WHERE id = ?").run(name.trim(), id);
  }
  if (note !== undefined) {
    db.prepare("UPDATE characters SET note = ? WHERE id = ?").run(note.trim(), id);
  }

  const character = db
    .prepare(`SELECT ${CHARACTER_COLUMNS} FROM characters WHERE id = ?`)
    .get(id) as Character;

  res.json(character);
});
