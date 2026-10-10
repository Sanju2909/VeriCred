require("dotenv").config();

const environment = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  MONGODB_URI: process.env.MONGODB_URI || "",
  JWT_SECRET: process.env.JWT_SECRET || "default_dev_secret_key_change_in_production_32_chars",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
  BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545",
  CHAIN_ID: parseInt(process.env.CHAIN_ID || "31337", 10),
  ISSUER_REGISTRY_ADDRESS: process.env.ISSUER_REGISTRY_ADDRESS || "",
  CREDENTIAL_REGISTRY_ADDRESS: process.env.CREDENTIAL_REGISTRY_ADDRESS || "",
  BACKEND_OPERATOR_PRIVATE_KEY: process.env.BACKEND_OPERATOR_PRIVATE_KEY || "",

  isProduction: () => (process.env.NODE_ENV === "production"),
  isDevelopment: () => (!process.env.NODE_ENV || process.env.NODE_ENV === "development"),
  isTest: () => (process.env.NODE_ENV === "test"),
};

module.exports = environment;
