import { randomUUID } from "node:crypto";
import { Router } from "express";
import { db } from "../db.js";

interface Character {
  id: string;
  scriptId: string;
  name: string;
  note: string;
  orderIndex: number;
  createdAt: string;
}

const CHARACTER_COLUMNS =
  "id, script_id AS scriptId, name, note, order_index AS orderIndex, created_at AS createdAt";

export const charactersRouter = Router({ mergeParams: true });

charactersRouter.get("/", (req, res) => {
  const { scriptId } = req.params as { scriptId: string };
  const characters = db
    .prepare(`SELECT ${CHARACTER_COLUMNS} FROM characters WHERE script_id = ? ORDER BY order_index ASC`)
    .all(scriptId) as Character[];

  res.json(characters);
});

charactersRouter.put("/order", (req, res) => {
  const { scriptId } = req.params as { scriptId: string };
  const { characterIds } = req.body;

  if (!Array.isArray(characterIds) || !characterIds.every((id) => typeof id === "string")) {
    res.status(400).json({ error: "characterIds must be an array of strings" });
    return;
  }

  const existing = db
    .prepare("SELECT id FROM characters WHERE script_id = ?")
    .all(scriptId) as { id: string }[];
  const existingIds = new Set(existing.map((c) => c.id));

  if (
    characterIds.length !== existingIds.size ||
    !characterIds.every((id) => existingIds.has(id)) ||
    new Set(characterIds).size !== characterIds.length
  ) {
    res.status(400).json({ error: "characterIds must match exactly the characters in this script" });
    return;
  }

  const reorder = db.transaction((ids: string[]) => {
    const setOrder = db.prepare("UPDATE characters SET order_index = ? WHERE id = ?");
    ids.forEach((characterId, index) => setOrder.run(index, characterId));
  });
  reorder(characterIds);

  const characters = db
    .prepare(`SELECT ${CHARACTER_COLUMNS} FROM characters WHERE script_id = ? ORDER BY order_index ASC`)
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

  const { maxOrder } = db
    .prepare("SELECT MAX(order_index) AS maxOrder FROM characters WHERE script_id = ?")
    .get(scriptId) as { maxOrder: number | null };
  const orderIndex = maxOrder === null ? 0 : maxOrder + 1;

  const character: Character = {
    id: randomUUID(),
    scriptId,
    name: name.trim(),
    note: typeof note === "string" ? note.trim() : "",
    orderIndex,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    "INSERT INTO characters (id, script_id, name, note, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    character.id,
    character.scriptId,
    character.name,
    character.note,
    character.orderIndex,
    character.createdAt,
  );

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
