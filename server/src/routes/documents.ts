import { randomUUID } from "node:crypto";
import { Router } from "express";
import { proposeCharacters, type SceneCharacter } from "../ai.js";
import { db } from "../db.js";

interface ScriptDocument {
  id: string;
  scriptId: string;
  name: string;
  content: string;
  createdAt: string;
}

interface CharacterProposal {
  characterId: string | null;
  name: string;
  note: string;
  passages: string[];
}

const DOCUMENT_COLUMNS = "id, script_id AS scriptId, name, content, created_at AS createdAt";

export const documentsRouter = Router({ mergeParams: true });

documentsRouter.get("/", (req, res) => {
  const { scriptId } = req.params as { scriptId: string };
  const documents = db
    .prepare(`SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE script_id = ? ORDER BY created_at ASC`)
    .all(scriptId) as ScriptDocument[];

  res.json(documents);
});

documentsRouter.post("/", (req, res) => {
  const { name, content } = req.body;
  const { scriptId } = req.params as { scriptId: string };

  if (typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  if (typeof content !== "string" || content.trim() === "") {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const script = db.prepare("SELECT id FROM scripts WHERE id = ?").get(scriptId);
  if (!script) {
    res.status(404).json({ error: "script not found" });
    return;
  }

  // Content is stored exactly as given — it's the user's own writing, and
  // finished scenes found in it later must be saved verbatim.
  const document: ScriptDocument = {
    id: randomUUID(),
    scriptId,
    name: name.trim(),
    content,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    "INSERT INTO documents (id, script_id, name, content, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(document.id, document.scriptId, document.name, document.content, document.createdAt);

  res.status(201).json(document);
});

documentsRouter.delete("/:id", (req, res) => {
  const { scriptId, id } = req.params as { scriptId: string; id: string };

  const result = db
    .prepare("DELETE FROM documents WHERE id = ? AND script_id = ?")
    .run(id, scriptId);

  if (result.changes === 0) {
    res.status(404).json({ error: "document not found" });
    return;
  }

  res.status(204).send();
});

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Finds a passage in the document while ignoring differences in whitespace,
// and returns the document's own text for it, so what gets saved is exactly
// what the writer wrote. Returns null if the passage isn't really there.
function findInDocument(document: string, passage: string): string | null {
  const words = passage.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = document.match(new RegExp(escaped.join("\\s+")));
  return match ? match[0] : null;
}

documentsRouter.post("/:id/propose-characters", async (req, res) => {
  const { scriptId, id } = req.params as { scriptId: string; id: string };

  const document = db
    .prepare(`SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE id = ? AND script_id = ?`)
    .get(id, scriptId) as ScriptDocument | undefined;

  if (!document) {
    res.status(404).json({ error: "document not found" });
    return;
  }

  const characters = db
    .prepare("SELECT id, name, note FROM characters WHERE script_id = ? ORDER BY order_index ASC")
    .all(scriptId) as { id: string; name: string; note: string }[];
  const entriesStmt = db.prepare(
    "SELECT content FROM character_entries WHERE character_id = ? ORDER BY created_at ASC",
  );
  const notebook = characters.map((character) => ({
    ...character,
    entries: (entriesStmt.all(character.id) as { content: string }[]).map((e) => e.content),
  }));

  let raw;
  try {
    raw = await proposeCharacters({
      documentName: document.name,
      document: document.content,
      characters: notebook.map(({ name, note, entries }): SceneCharacter => ({ name, note, entries })),
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
    return;
  }

  // Merge by character, keeping only passages that really appear in the
  // document and aren't already stored for that character.
  const byCharacter = new Map<string, CharacterProposal & { seen: Set<string>; stored: string[] }>();
  let dropped = 0;

  for (const item of raw) {
    const name = item.character.trim();
    if (!name) continue;

    const existing = notebook.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const key = existing ? existing.id : `new:${name.toLowerCase()}`;

    let proposal = byCharacter.get(key);
    if (!proposal) {
      proposal = {
        characterId: existing?.id ?? null,
        name: existing?.name ?? name,
        note: existing ? "" : item.note.trim(),
        passages: [],
        seen: new Set(),
        stored: existing ? existing.entries.map(normalizeWhitespace) : [],
      };
      byCharacter.set(key, proposal);
    }

    for (const passage of item.passages) {
      const original = findInDocument(document.content, passage);
      const normalized = original ? normalizeWhitespace(original) : "";
      if (
        !original ||
        proposal.seen.has(normalized) ||
        proposal.stored.some((entry) => entry.includes(normalized))
      ) {
        dropped++;
        continue;
      }
      proposal.seen.add(normalized);
      proposal.passages.push(original.trim());
    }
  }

  const proposals: CharacterProposal[] = [...byCharacter.values()]
    .filter((p) => p.passages.length > 0)
    .map(({ characterId, name, note, passages }) => ({ characterId, name, note, passages }));

  res.json({ proposals, dropped });
});
