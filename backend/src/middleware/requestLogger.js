const logger = require("../utils/logger");

/**
 * Request Logging Middleware
 * Logs incoming HTTP requests and response timing safely.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Redact query params if sensitive
    const safeUrl = originalUrl.split("?")[0];

    const logMessage = `${method} ${safeUrl} -> ${statusCode} (${duration}ms)`;

    if (statusCode >= 500) {
      logger.error(logMessage, { ip, statusCode, duration });
    } else if (statusCode >= 400) {
      logger.warn(logMessage, { ip, statusCode, duration });
    } else if (process.env.NODE_ENV !== "test") {
      logger.info(logMessage, { ip, statusCode, duration });
    }
  });

  next();
}

module.exports = requestLogger;
