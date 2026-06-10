const express = require("express");

const {
  getDashboardSummary,
  getTodayUsage,
  getWeekUsage,
  getMonthUsage,
  getQuotaStatus,
} = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/summary", getDashboardSummary);
router.get("/usage/today", getTodayUsage);
router.get("/usage/week", getWeekUsage);
router.get("/usage/month", getMonthUsage);
router.get("/quota/status", getQuotaStatus);

module.exports = router;
