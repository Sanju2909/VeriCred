const express = require("express");
const { isDatabaseConnected, getConnectionState } = require("../config/db");
const ApiResponse = require("../utils/apiResponse");

const router = express.Router();

/**
 * GET /api/health
 * Public health-check endpoint reporting server uptime, environment, and database connectivity.
 */
router.get("/", (req, res) => {
  const dbConnected = isDatabaseConnected();
  const dbState = getConnectionState();

  const healthData = {
    status: dbConnected ? "OK" : "DEGRADED",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    database: {
      connected: dbConnected,
      state: dbState,
    },
    version: "1.0.0",
  };

  // HTTP 200 even if degraded so load balancers / monitoring can read state
  return ApiResponse.success(res, 200, "Service health check", healthData);
});

module.exports = router;
