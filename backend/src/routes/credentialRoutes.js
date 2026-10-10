const express = require("express");
const credentialController = require("../controllers/credentialController");
const { issueCredentialValidator, revokeCredentialValidator } = require("../validators/credentialValidators");
const validateRequest = require("../middleware/validateRequest");
const { authenticateToken, authorizeRoles, requireDatabase } = require("../middleware/authMiddleware");
const { ROLES } = require("../models/User");

const router = express.Router();

/**
 * Public Verification Endpoint (Does not require login to verify a credential JSON)
 */
router.post("/verify", credentialController.verifyCredential);
router.post("/:id/verify", credentialController.verifyCredential);

/**
 * Authenticated Endpoints
 */
router.use(requireDatabase);
router.use(authenticateToken);

// Issue new credential (ISSUER or ADMIN only)
router.post(
  "/",
  authorizeRoles(ROLES.ISSUER, ROLES.ADMIN),
  issueCredentialValidator,
  validateRequest,
  credentialController.issueCredential
);

// List user-accessible credentials
router.get("/", credentialController.listCredentials);

// Retrieve single credential
router.get("/:id", credentialController.getCredentialById);

// Revoke credential (ISSUER or ADMIN only)
router.post(
  "/:id/revoke",
  authorizeRoles(ROLES.ISSUER, ROLES.ADMIN),
  revokeCredentialValidator,
  validateRequest,
  credentialController.revokeCredential
);

module.exports = router;

