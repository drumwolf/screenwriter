import "dotenv/config";
import express from "express";
import { aiRouter } from "./routes/ai.js";
import { characterEntriesRouter } from "./routes/characterEntries.js";
import { charactersRouter } from "./routes/characters.js";
import { scenesRouter } from "./routes/scenes.js";
import { scriptsRouter } from "./routes/scripts.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/ai", aiRouter);
app.use("/api/scripts", scriptsRouter);
app.use("/api/scripts/:scriptId/scenes", scenesRouter);
app.use("/api/scripts/:scriptId/characters", charactersRouter);
app.use("/api/scripts/:scriptId/characters/:characterId/entries", characterEntriesRouter);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
