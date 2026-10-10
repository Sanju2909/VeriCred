const mongoose = require("mongoose");
const logger = require("../utils/logger");

let isConnected = false;

const STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * Connect to MongoDB database.
 * If connection fails or MONGODB_URI is not provided, does not crash the server.
 * Instead, flags state as disconnected so healthcheck and error handling can respond gracefully.
 * @param {string} [uri] Optional URI override (e.g. for testing)
 * @returns {Promise<boolean>}
 */
async function connectDB(uri) {
  const connectionUri = uri || process.env.MONGODB_URI;

  if (!connectionUri) {
    logger.warn("MONGODB_URI is not set. Server starting in database-degraded mode.");
    isConnected = false;
    return false;
  }

  try {
    // Configure mongoose options
    mongoose.set("strictQuery", true);

    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    isConnected = true;
    logger.info("Successfully connected to MongoDB database.");

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB runtime connection error", err);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB connection disconnected.");
      isConnected = false;
    });

    return true;
  } catch (error) {
    isConnected = false;
    logger.warn(`Failed to connect to MongoDB (${error.message}). Running in degraded mode.`);
    return false;
  }
}

/**
 * Disconnects from MongoDB gracefully.
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info("MongoDB disconnected gracefully.");
  }
}

/**
 * Returns current connection state boolean.
 */
function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Returns descriptive connection state string.
 */
function getConnectionState() {
  return STATES[mongoose.connection.readyState] || "unknown";
}

module.exports = {
  connectDB,
  disconnectDB,
  isDatabaseConnected,
  getConnectionState,
};
