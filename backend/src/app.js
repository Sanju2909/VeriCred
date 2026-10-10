const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const routes = require("./routes");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const ApiResponse = require("./utils/apiResponse");
const environment = require("./config/environment");

const app = express();

// 1. Security Headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 2. Cross-Origin Resource Sharing (CORS)
const allowedOrigins = [
  environment.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or in development
      if (!origin || allowedOrigins.includes(origin) || environment.isDevelopment() || environment.isTest()) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 3. Request Parsing with Strict Payload Size Limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 4. Request Logging
app.use(requestLogger);

// 5. Rate Limiting (General API protection)
app.use("/api", apiLimiter);

// 6. Mount Master API Routes
app.use("/api", routes);

// 7. Catch-All 404 Route Handler
app.use((req, res) => {
  return ApiResponse.error(
    res,
    404,
    `Cannot ${req.method} ${req.originalUrl}. Route not found.`,
    "NOT_FOUND"
  );
});

// 8. Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
