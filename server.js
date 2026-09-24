import dotenv from "dotenv"
dotenv.config()
import express from "express";
import cors from "cors";

import path from "path";
import { fileURLToPath } from "url";

import userRouter from "./routers/user.router.js";
import apiRouter from "./routers/api.router.js";
import adminRouter from "./routers/admin.router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

// Enable CORS only for public student APIs. Admin routes remain internal-only.
app.use("/user", cors(), userRouter);
app.use("/api", cors(), apiRouter);
app.use("/admin-api", adminRouter);
app.use(express.static("public", { extensions: ['html'] }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "docs.html"));
});

app.listen(3000, "localhost", () => {
  console.log("Server running on http://localhost:3000");
});
