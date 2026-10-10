const jwt = require("jsonwebtoken");

/**
 * Generates a signed JWT access token for a user.
 * @param {object} payload - { userId, email, role, ethereumAddress }
 * @param {string} secret - JWT signing key
 * @param {string} expiresIn - Expiration string (e.g. '1d')
 * @returns {string}
 */
function generateToken(payload, secret, expiresIn = "1d") {
  if (!secret) {
    throw new Error("JWT secret must be provided");
  }
  return jwt.sign(payload, secret, {
    expiresIn,
    algorithm: "HS256",
  });
}

/**
 * Verifies a JWT access token.
 * @param {string} token 
 * @param {string} secret 
 * @returns {object} - Decoded payload
 */
function verifyToken(token, secret) {
  if (!secret) {
    throw new Error("JWT secret must be provided");
  }
  return jwt.verify(token, secret, {
    algorithms: ["HS256"],
  });
}

module.exports = {
  generateToken,
  verifyToken,
};

