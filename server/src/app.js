const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");
const contextRoutes = require("./routes/context.routes");
const promptSettingsRoutes = require("./routes/prompt-settings.routes");
const chatbotRoutes = require("./routes/chatbot.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const adminRoutes = require("./routes/admin.routes");
const configRoutes = require("./routes/config.routes");
const aiConfigRoutes = require("./routes/ai-config.routes");
const publicRoutes = require("./routes/public.routes");

const { errorHandler } = require("./middleware/error.middleware");
const { loggerMiddleware } = require("./middleware/logger.middleware");
const { attachAuthContext, requireAdmin } = require("./middleware/auth.middleware");

const app = express();

app.disable("etag");

app.use(express.json());

const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
app.use(
  cors((req, cb) => {
    const origin = req.header("Origin");
    const isPublicRoute = req.path.startsWith("/public/");
    if (!origin) {
      return cb(null, {
        origin: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "x-api-key"],
      });
    }

    if (isPublicRoute || allowedOrigins.includes(origin)) {
      return cb(null, {
        origin: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "x-api-key"],
      });
    }

    return cb(new Error("CORS not allowed"));
  }),
);

app.use(loggerMiddleware);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Express Gateway Running",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);

app.use("/api/chat", attachAuthContext, chatRoutes);
app.use("/api/dashboard", attachAuthContext, dashboardRoutes);
app.use("/api/ai-config", attachAuthContext, aiConfigRoutes);
app.use("/api/prompt-settings", attachAuthContext, promptSettingsRoutes);
app.use("/api/contexts", attachAuthContext, contextRoutes);
app.use("/api/chatbots", attachAuthContext, chatbotRoutes);
app.use("/api/admin", attachAuthContext, requireAdmin, adminRoutes);
app.use("/api/admin/config", attachAuthContext, requireAdmin, configRoutes);
app.use("/api/config", configRoutes);
app.use("/public", publicRoutes);

app.use(errorHandler);

module.exports = app;
