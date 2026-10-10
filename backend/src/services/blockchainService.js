const { ethers } = require("ethers");
const environment = require("../config/environment");
const logger = require("../utils/logger");

const issuerRegistryAbi = require("../config/contracts/IssuerRegistry.json");
const credentialRegistryAbi = require("../config/contracts/CredentialRegistry.json");

const VERIFICATION_STATUS_MAP = {
  0: "VALID",
  1: "CREDENTIAL_NOT_FOUND",
  2: "HASH_MISMATCH",
  3: "CREDENTIAL_REVOKED",
  4: "CREDENTIAL_EXPIRED",
  5: "ISSUER_SUSPENDED",
};

class BlockchainService {
  constructor() {
    this.provider = null;
    this.issuerRegistryAddress = environment.ISSUER_REGISTRY_ADDRESS;
    this.credentialRegistryAddress = environment.CREDENTIAL_REGISTRY_ADDRESS;
    this.rpcUrl = environment.BLOCKCHAIN_RPC_URL;
  }

  /**
   * Returns an active ethers JsonRpcProvider instance.
   */
  getProvider() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl, undefined, {
        staticNetwork: true,
      });
    }
    return this.provider;
  }

  /**
   * Helper to instantiate a read-only or signer-connected contract.
   */
  getContract(contractName, address, abi, signerOrProvider) {
    if (!address || address === ethers.ZeroAddress || !ethers.isAddress(address)) {
      throw new Error(`Invalid or missing ${contractName} contract address: ${address}`);
    }
    const runner = signerOrProvider || this.getProvider();
    return new ethers.Contract(address, abi, runner);
  }

  getIssuerRegistryContract(signerOrProvider) {
    return this.getContract(
      "IssuerRegistry",
      this.issuerRegistryAddress,
      issuerRegistryAbi,
      signerOrProvider
    );
  }

  getCredentialRegistryContract(signerOrProvider) {
    return this.getContract(
      "CredentialRegistry",
      this.credentialRegistryAddress,
      credentialRegistryAbi,
      signerOrProvider
    );
  }

  /**
   * Checks if an issuer address is currently authorized in the IssuerRegistry contract.
   * @param {string} issuerAddress 
   * @returns {Promise<boolean>}
   */
  async isIssuerApproved(issuerAddress) {
    try {
      if (!ethers.isAddress(issuerAddress)) {
        return false;
      }
      const contract = this.getIssuerRegistryContract();
      return await contract.isIssuerApproved(issuerAddress);
    } catch (error) {
      logger.warn(`Blockchain check isIssuerApproved failed for ${issuerAddress}: ${error.message}`);
      return false;
    }
  }

  /**
   * Retrieves full on-chain profile for an issuer address.
   */
  async getIssuerProfile(issuerAddress) {
    try {
      const contract = this.getIssuerRegistryContract();
      const res = await contract.getIssuer(issuerAddress);
      return {
        name: res[0],
        did: res[1],
        isApproved: res[2],
        registeredAt: Number(res[3]),
        revokedAt: Number(res[4]),
      };
    } catch (error) {
      logger.warn(`Failed to retrieve issuer profile from chain: ${error.message}`);
      throw error;
    }
  }

  /**
   * Anchors a credential identifier and integrity hash on-chain.
   * @param {string} credentialIdBytes32 
   * @param {string} credentialHashBytes32 
   * @param {number} expiresAtTimestamp Unix timestamp (0 for no expiry)
   * @param {string} issuerPrivateKey Hex private key of the issuing institution
   * @returns {Promise<{ txHash: string, blockNumber: number }>}
   */
  async anchorCredential(credentialIdBytes32, credentialHashBytes32, expiresAtTimestamp, issuerPrivateKey) {
    try {
      const provider = this.getProvider();
      const wallet = new ethers.Wallet(issuerPrivateKey, provider);
      const contract = this.getCredentialRegistryContract(wallet);

      const tx = await contract.issueCredential(
        credentialIdBytes32,
        credentialHashBytes32,
        expiresAtTimestamp || 0
      );

      logger.info(`Anchoring tx submitted: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error(`Transaction failed on-chain with status ${receipt ? receipt.status : "unknown"}`);
      }

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      logger.error(`Failed to anchor credential on-chain: ${error.message}`);
      throw this._formatBlockchainError(error);
    }
  }

  /**
   * Revokes a credential on-chain.
   * @param {string} credentialIdBytes32 
   * @param {string} reason 
   * @param {string} revokerPrivateKey Hex private key of issuer or admin
   * @returns {Promise<{ txHash: string, blockNumber: number }>}
   */
  async revokeCredential(credentialIdBytes32, reason, revokerPrivateKey) {
    try {
      const provider = this.getProvider();
      const wallet = new ethers.Wallet(revokerPrivateKey, provider);
      const contract = this.getCredentialRegistryContract(wallet);

      const tx = await contract.revokeCredential(credentialIdBytes32, reason);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error("Revocation transaction reverted on-chain");
      }

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      logger.error(`Failed to revoke credential on-chain: ${error.message}`);
      throw this._formatBlockchainError(error);
    }
  }

  /**
   * Verifies credential validity against smart contract state.
   * @param {string} credentialIdBytes32 
   * @param {string} expectedHashBytes32 
   * @returns {Promise<{ isValid: boolean, statusCode: string, statusMessage: string }>}
   */
  async verifyCredential(credentialIdBytes32, expectedHashBytes32) {
    try {
      const contract = this.getCredentialRegistryContract();
      const res = await contract.verifyCredential(credentialIdBytes32, expectedHashBytes32);

      const isValid = res[0];
      const numericCode = Number(res[1]);
      const statusMessage = res[2];

      return {
        isValid,
        statusCode: VERIFICATION_STATUS_MAP[numericCode] || "UNKNOWN",
        statusMessage,
      };
    } catch (error) {
      logger.warn(`verifyCredential on-chain call failed: ${error.message}`);
      return {
        isValid: false,
        statusCode: "BLOCKCHAIN_QUERY_ERROR",
        statusMessage: `Unable to verify with blockchain node: ${error.message}`,
      };
    }
  }

  /**
   * Retrieves raw on-chain record for a credential.
   */
  async getCredentialRecord(credentialIdBytes32) {
    try {
      const contract = this.getCredentialRegistryContract();
      const res = await contract.getCredential(credentialIdBytes32);
      return {
        credentialHash: res[0],
        issuer: res[1],
        issuedAt: Number(res[2]),
        expiresAt: Number(res[3]),
        isRevoked: res[4],
        revokedAt: Number(res[5]),
        revocationReason: res[6],
      };
    } catch (error) {
      throw this._formatBlockchainError(error);
    }
  }

  /**
   * Parses and formats Solidity custom errors and RPC reverts.
   */
  _formatBlockchainError(error) {
    const errorString = error.message || "";
    if (errorString.includes("CredentialRegistry__NotAuthorizedIssuer")) {
      const err = new Error("The issuing address is not registered or authorized on-chain");
      err.statusCode = 403;
      err.errorCode = "UNAUTHORIZED_ONCHAIN_ISSUER";
      return err;
    }
    if (errorString.includes("CredentialRegistry__CredentialAlreadyExists")) {
      const err = new Error("A credential with this identifier is already anchored on-chain");
      err.statusCode = 409;
      err.errorCode = "CREDENTIAL_ALREADY_ONCHAIN";
      return err;
    }
    if (errorString.includes("CredentialRegistry__AlreadyRevoked")) {
      const err = new Error("This credential has already been revoked on-chain");
      err.statusCode = 400;
      err.errorCode = "ALREADY_REVOKED";
      return err;
    }
    if (errorString.includes("CredentialRegistry__UnauthorizedRevocation")) {
      const err = new Error("Only the original issuer or administrator is permitted to revoke this credential");
      err.statusCode = 403;
      err.errorCode = "UNAUTHORIZED_REVOCATION";
      return err;
    }
    if (errorString.includes("CredentialRegistry__CredentialNotFound")) {
      const err = new Error("Credential not found on blockchain registry");
      err.statusCode = 404;
      err.errorCode = "CREDENTIAL_NOT_FOUND_ONCHAIN";
      return err;
    }

    return error;
  }
}

module.exports = new BlockchainService();

