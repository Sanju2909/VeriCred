const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password using bcrypt with 12 salt rounds.
 * @param {string} password 
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Compares plaintext password against a stored bcrypt hash.
 * @param {string} candidatePassword 
 * @param {string} storedHash 
 * @returns {Promise<boolean>}
 */
async function comparePassword(candidatePassword, storedHash) {
  if (!candidatePassword || !storedHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, storedHash);
}

module.exports = {
  hashPassword,
  comparePassword,
};

