const express = require("express");

const {
  getDashboardSummary,
  getTodayUsage,
  getWeekUsage,
  getMonthUsage,
  getQuotaStatus,
  resetUsage,
} = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/summary", getDashboardSummary);
router.get("/usage/today", getTodayUsage);
router.get("/usage/week", getWeekUsage);
router.get("/usage/month", getMonthUsage);
router.get("/quota/status", getQuotaStatus);
router.post("/usage/reset", resetUsage);

module.exports = router;
