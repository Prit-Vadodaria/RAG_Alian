const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const chatRoutes = require("./routes/chat.routes");
const contextRoutes = require("./routes/context.routes");

const { errorHandler } = require("./middleware/error.middleware");
const { loggerMiddleware } = require("./middleware/logger.middleware");

const app = express();

app.disable("etag");

app.use(express.json());

const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
app.use(
  cors({
    origin: (origin, cb) => {
      // allow requests with no origin (curl, server-side)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

app.use("/api/chat", chatRoutes);
app.use("/api/contexts", contextRoutes);

app.use(errorHandler);

module.exports = app;
