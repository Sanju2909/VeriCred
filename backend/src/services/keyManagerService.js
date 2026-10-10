const { ethers } = require("ethers");
const logger = require("../utils/logger");

/**
 * Key Manager Service
 * Manages trusted issuer signing keys in the secure backend environment.
 * 
 * SECURITY RULES:
 * - Keys are NEVER stored in MongoDB or returned to API clients.
 * - In production, this can interface with an HSM (Hardware Security Module) or AWS KMS / Vault.
 * - In local development, it maintains registered issuer keys in memory / configured env keys.
 */
class KeyManagerService {
  constructor() {
    // In-memory secure key store: Map<lowercaseAddress, privateKey>
    this.keyStore = new Map();

    this._initializeDefaultDevKeys();
  }

  /**
   * Initializes local development keys if configured.
   */
  _initializeDefaultDevKeys() {
    // Operator/Deployer key
    if (process.env.BACKEND_OPERATOR_PRIVATE_KEY && process.env.BACKEND_OPERATOR_PRIVATE_KEY.startsWith("0x")) {
      try {
        const wallet = new ethers.Wallet(process.env.BACKEND_OPERATOR_PRIVATE_KEY);
        this.keyStore.set(wallet.address.toLowerCase(), wallet.privateKey);
      } catch (err) {
        logger.warn("Could not parse BACKEND_OPERATOR_PRIVATE_KEY");
      }
    }

    // Parse any JSON map of issuer keys provided via environment (e.g. ISSUER_PRIVATE_KEYS)
    if (process.env.ISSUER_PRIVATE_KEYS) {
      try {
        const parsed = JSON.parse(process.env.ISSUER_PRIVATE_KEYS);
        for (const [address, privKey] of Object.entries(parsed)) {
          this.keyStore.set(address.toLowerCase(), privKey);
        }
      } catch (err) {
        logger.warn("Could not parse ISSUER_PRIVATE_KEYS env string");
      }
    }
  }

  /**
   * Registers a signing key for an authorized issuer in the backend key manager.
   * @param {string} address Issuer Ethereum address
   * @param {string} privateKey Corresponding secp256k1 private key
   */
  registerIssuerKey(address, privateKey) {
    if (!address || !privateKey) {
      throw new Error("Both address and private key are required to register an issuer key");
    }
    const wallet = new ethers.Wallet(privateKey);
    if (wallet.address.toLowerCase() !== address.toLowerCase()) {
      throw new Error("Private key does not correspond to the provided issuer address");
    }
    this.keyStore.set(address.toLowerCase(), privateKey);
    logger.info(`Issuer signing key securely registered for address: ${address}`);
  }

  /**
   * Retrieves the signing key for an issuer.
   * @param {string} address 
   * @returns {string} The private key
   */
  getIssuerKey(address) {
    if (!address) return null;
    return this.keyStore.get(address.toLowerCase()) || null;
  }

  /**
   * Checks whether a signing key is available for the given address.
   * @param {string} address 
   * @returns {boolean}
   */
  hasIssuerKey(address) {
    if (!address) return false;
    return this.keyStore.has(address.toLowerCase());
  }
}

module.exports = new KeyManagerService();
