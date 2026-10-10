/**
 * Safe Logging Utility
 * Automatically masks and redacts sensitive data (passwords, tokens, private keys, secrets).
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "jwtsecret",
  "privatekey",
  "backendoperatorprivatekey",
  "deployerprivatekey",
  "authorization",
  "cookie",
]);

/**
 * Recursively redacts sensitive keys from log objects.
 * @param {any} data 
 * @returns {any}
 */
function sanitizeForLogging(data) {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLogging(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const logger = {
  info: (message, meta) => {
    if (meta) {
      console.log(`[INFO] [${new Date().toISOString()}] ${message}`, JSON.stringify(sanitizeForLogging(meta)));
    } else {
      console.log(`[INFO] [${new Date().toISOString()}] ${message}`);
    }
  },
  warn: (message, meta) => {
    if (meta) {
      console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, JSON.stringify(sanitizeForLogging(meta)));
    } else {
      console.warn(`[WARN] [${new Date().toISOString()}] ${message}`);
    }
  },
  error: (message, error) => {
    if (error && error.stack) {
      console.error(`[ERROR] [${new Date().toISOString()}] ${message}: ${error.message}\n${error.stack}`);
    } else if (error) {
      console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, JSON.stringify(sanitizeForLogging(error)));
    } else {
      console.error(`[ERROR] [${new Date().toISOString()}] ${message}`);
    }
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV === "development") {
      if (meta) {
        console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`, JSON.stringify(sanitizeForLogging(meta)));
      } else {
        console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`);
      }
    }
  },
  sanitizeForLogging,
};

module.exports = logger;
