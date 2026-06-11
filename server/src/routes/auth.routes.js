const express = require("express");

const { attachAuthContext } = require("../middleware/auth.middleware");
const {
  login,
  signup,
  me,
  logout,
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", login);
router.post("/signup", signup);
router.get("/me", attachAuthContext, me);
router.post("/logout", attachAuthContext, logout);

module.exports = router;
