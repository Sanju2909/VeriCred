const { body } = require("express-validator");
const { ROLES } = require("../models/User");

const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[A-Za-z]/)
    .withMessage("Password must contain at least one letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number"),

  body("role")
    .optional()
    .custom((value) => {
      // SECURITY RULE: Public registration is strictly restricted to HOLDER or VERIFIER
      if (value === ROLES.ADMIN || value === ROLES.ISSUER) {
        throw new Error(
          "Privilege escalation forbidden. Administrative and Issuer accounts cannot be created via public registration."
        );
      }
      if (value && !Object.values(ROLES).includes(value)) {
        throw new Error(`Invalid role. Allowed registration roles are HOLDER or VERIFIER.`);
      }
      return true;
    }),

  body("ethereumAddress")
    .optional()
    .trim()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage("Ethereum address must be a valid 42-character hex address (0x...)"),
];

const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Must be a valid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

module.exports = {
  registerValidator,
  loginValidator,
};
