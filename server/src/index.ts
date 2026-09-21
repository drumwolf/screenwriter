import express from "express";
import { scriptsRouter } from "./routes/scripts.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/scripts", scriptsRouter);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
