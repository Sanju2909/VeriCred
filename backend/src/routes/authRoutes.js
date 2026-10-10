const express = require("express");
const authController = require("../controllers/authController");
const { registerValidator, loginValidator } = require("../validators/authValidators");
const validateRequest = require("../middleware/validateRequest");
const { authenticateToken, requireDatabase } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

/**
 * Public Authentication Endpoints
 */
router.post(
  "/register",
  requireDatabase,
  registerValidator,
  validateRequest,
  authController.register
);

router.post(
  "/login",
  authLimiter,
  requireDatabase,
  loginValidator,
  validateRequest,
  authController.login
);

/**
 * Authenticated Endpoints
 */
router.post("/logout", authenticateToken, authController.logout);
router.get("/me", authenticateToken, authController.getMe);

module.exports = router;

