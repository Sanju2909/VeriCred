const express = require("express");
const userController = require("../controllers/userController");
const { authenticateToken, authorizeRoles, requireDatabase } = require("../middleware/authMiddleware");
const { ROLES } = require("../models/User");

const router = express.Router();

router.use(requireDatabase);
router.use(authenticateToken);

/**
 * Admin-Only: List users with pagination and role filters
 */
router.get("/", authorizeRoles(ROLES.ADMIN), userController.listUsers);

/**
 * Admin or Self: Get user profile details
 */
router.get("/:id", userController.getUserById);

/**
 * Admin-Only: Modify user role
 */
router.patch("/:id/role", authorizeRoles(ROLES.ADMIN), userController.updateUserRole);

module.exports = router;

