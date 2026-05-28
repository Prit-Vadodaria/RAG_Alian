const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const chatRoutes = require("./routes/chat.routes");

const { errorHandler } = require("./middleware/error.middleware");
const { loggerMiddleware } = require("./middleware/logger.middleware");

const app = express();

app.disable("etag");

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
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

app.use(errorHandler);

module.exports = app;
