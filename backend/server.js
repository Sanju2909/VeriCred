require("dotenv").config();
const app = require("./src/app");
const { connectDB, disconnectDB } = require("./src/config/db");
const environment = require("./src/config/environment");
const logger = require("./src/utils/logger");

const PORT = environment.PORT || 5000;

let server;

async function startServer() {
  logger.info("Initializing Decentralized Credential Platform Backend API...");

  // Attempt database connection (graceful fallback if MONGODB_URI is not yet configured)
  await connectDB();

  server = app.listen(PORT, () => {
    logger.info(`🚀 Server running in ${environment.NODE_ENV} mode on port ${PORT}`);
    logger.info(`👉 API Health Endpoint: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown listeners
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down HTTP server gracefully...`);
    if (server) {
      server.close(async () => {
        logger.info("HTTP server closed.");
        await disconnectDB();
        logger.info("Cleanup complete. Process exiting.");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch((error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});

module.exports = server;

