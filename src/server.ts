import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";

import aiRoutes from "./routes/ai.routes.js";
import generateRoutes from "./routes/generate.routes.js";
import { checkDatabaseConnection, pool } from "./config/database.js";
import authRoutes from "./routes/auth.routes.js";
import brandProfileRoutes from "./routes/brand-profile.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import { messageRepository } from "./repositories/message.repository.js";
import { aiOrchestrator } from "./services/ai-orchestrator.service.js";

const app = express();

const PORT = Number(process.env.PORT) || 3002;

app.use(helmet());

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    application: "Senarist Local AI",
    status: "running",
    ...aiOrchestrator.getInfo(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/ai", aiRoutes);
app.use("/api/ai", generateRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/brand-profile", brandProfileRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/conversations", conversationRoutes);

app.get("/health/db", async (_req, res) => {
  try {
    await checkDatabaseConnection();

    res.status(200).json({
      success: true,
      database: "connected",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(503).json({
      success: false,
      database: "disconnected",
    });
  }
});

async function startServer(): Promise<void> {
  try {
    await checkDatabaseConnection();
    console.log("Database connection established.");

    const recoveredCount =
      await messageRepository.recoverPendingAssistantMessages();

    console.log(
      `Pending message recovery completed. Recovered: ${recoveredCount}`,
    );

    const server = app.listen(PORT, "127.0.0.1", () => {
      console.log(`
  ==================================
     SENARIST LOCAL AI
  ==================================
     Port: ${PORT}
     Provider: ${aiOrchestrator.getInfo().provider}
     Model: ${aiOrchestrator.getInfo().model}
     Recovered messages: ${recoveredCount}
     Status: Running
  ==================================
      `);
    });

    server.on("error", async (error) => {
      console.error("HTTP server startup error:", error);
      await pool.end();
      process.exitCode = 1;
    });
  } catch (error) {
    console.error("Failed to start Senarist Local AI:", error);
    await pool.end();
    process.exitCode = 1;
  }
}

void startServer();
