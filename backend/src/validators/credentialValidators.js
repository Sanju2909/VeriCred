const { body, param } = require("express-validator");

const issueCredentialValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Credential title is required")
    .isLength({ min: 2, max: 200 })
    .withMessage("Title must be between 2 and 200 characters"),

  body("holderName")
    .trim()
    .notEmpty()
    .withMessage("Holder name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Holder name must be between 2 and 100 characters"),

  body("holderEmail")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Must provide a valid recipient email address")
    .normalizeEmail(),

  body("expirationDate")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage("Expiration date must be a valid ISO 8601 date string (e.g. YYYY-MM-DD)"),

  body("claims")
    .optional()
    .isObject()
    .withMessage("Credential subject claims must be a valid key-value object"),
];

const revokeCredentialValidator = [
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Revocation reason is required")
    .isLength({ min: 3, max: 500 })
    .withMessage("Revocation reason must be between 3 and 500 characters"),
];

module.exports = {
  issueCredentialValidator,
  revokeCredentialValidator,
};
