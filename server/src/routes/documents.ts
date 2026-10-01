import { randomUUID } from "node:crypto";
import { Router } from "express";
import { db } from "../db.js";

interface ScriptDocument {
  id: string;
  scriptId: string;
  name: string;
  content: string;
  createdAt: string;
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
