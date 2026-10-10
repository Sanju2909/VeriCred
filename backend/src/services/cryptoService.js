const { ethers } = require("ethers");
const crypto = require("crypto");
const { canonicalize } = require("../utils/canonicalize");
const logger = require("../utils/logger");

class CryptoService {
  /**
   * Computes the canonical integrity hashes (Keccak-256 and SHA-256) of a credential payload.
   * Strips any existing 'proof' field prior to canonicalization.
   * 
   * @param {object} credentialObject 
   * @returns {{ canonicalJson: string, keccak256: string, sha256: string, credentialIdBytes32: string }}
   */
  computeCredentialHashes(credentialObject) {
    if (!credentialObject || typeof credentialObject !== "object") {
      throw new Error("Invalid credential object provided for hashing");
    }

    // 1. Create a shallow clone and remove the proof object
    const unsignedDoc = { ...credentialObject };
    delete unsignedDoc.proof;

    // 2. Canonicalize document per RFC 8785
    const canonicalJson = canonicalize(unsignedDoc);

    // 3. Compute SHA-256 (standard NIST fingerprint)
    const sha256Hash = crypto.createHash("sha256").update(canonicalJson, "utf8").digest("hex");

    // 4. Compute Keccak-256 (EVM-compatible bytes32 integrity anchor)
    const keccak256Hash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));

    // 5. Convert credential string ID to bytes32 format for smart contracts
    let credentialIdBytes32;
    if (credentialObject.id && typeof credentialObject.id === "string") {
      if (credentialObject.id.startsWith("0x") && credentialObject.id.length === 66) {
        credentialIdBytes32 = credentialObject.id;
      } else {
        credentialIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(credentialObject.id));
      }
    } else {
      credentialIdBytes32 = keccak256Hash;
    }

    return {
      canonicalJson,
      sha256: "0x" + sha256Hash,
      keccak256: keccak256Hash,
      credentialIdBytes32,
    };
  }

  /**
   * Cryptographically signs a Verifiable Credential using the issuer's ECDSA private key.
   * 
   * @param {object} credentialPayload The unsigned W3C credential structure
   * @param {string} privateKey The issuer's secp256k1 private key (hex)
   * @param {string} issuerDid The issuer's DID URI
   * @returns {Promise<object>} The complete Verifiable Credential with cryptographic proof
   */
  async signCredential(credentialPayload, privateKey, issuerDid) {
    if (!privateKey) {
      throw new Error("Issuer private signing key is required");
    }

    const wallet = new ethers.Wallet(privateKey);
    const hashes = this.computeCredentialHashes(credentialPayload);

    // Sign the binary Keccak-256 hash
    const signature = await wallet.signMessage(ethers.getBytes(hashes.keccak256));

    const signedCredential = {
      ...credentialPayload,
      proof: {
        type: "EcdsaSecp256k1Signature2019",
        created: new Date().toISOString(),
        proofPurpose: "assertionMethod",
        verificationMethod: `${issuerDid}#key-1`,
        proofValue: signature,
      },
    };

    return signedCredential;
  }

  /**
   * Verifies the cryptographic signature of a presented Verifiable Credential.
   * 
   * @param {object} verifiableCredential The complete signed credential
   * @param {string} expectedIssuerAddress The expected Ethereum address of the issuer
   * @returns {{ isValid: boolean, recoveredAddress: string|null, reason: string|null, hashes: object }}
   */
  verifySignature(verifiableCredential, expectedIssuerAddress) {
    if (!verifiableCredential || typeof verifiableCredential !== "object") {
      return { isValid: false, recoveredAddress: null, reason: "Credential payload is missing or not an object", hashes: null };
    }

    if (!verifiableCredential.proof || !verifiableCredential.proof.proofValue) {
      return { isValid: false, recoveredAddress: null, reason: "Credential is missing cryptographic proof (signature)", hashes: null };
    }

    try {
      const hashes = this.computeCredentialHashes(verifiableCredential);
      const signature = verifiableCredential.proof.proofValue;

      // Recover the signing Ethereum address from ECDSA signature
      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(hashes.keccak256), signature);

      if (!expectedIssuerAddress) {
        return {
          isValid: true,
          recoveredAddress,
          reason: null,
          hashes,
        };
      }

      const isMatch = recoveredAddress.toLowerCase() === expectedIssuerAddress.toLowerCase();

      return {
        isValid: isMatch,
        recoveredAddress,
        reason: isMatch ? null : `Signer address mismatch. Expected: ${expectedIssuerAddress}, Recovered: ${recoveredAddress}`,
        hashes,
      };
    } catch (error) {
      logger.warn(`Signature verification failed with error: ${error.message}`);
      return {
        isValid: false,
        recoveredAddress: null,
        reason: `Cryptographic verification error: ${error.message}`,
        hashes: null,
      };
    }
  }

  /**
   * Generates a random Ethereum keypair for development or issuer key creation.
   * @returns {{ address: string, privateKey: string, did: string }}
   */
  generateKeyPair() {
    const randomWallet = ethers.Wallet.createRandom();
    return {
      address: randomWallet.address,
      privateKey: randomWallet.privateKey,
      did: `did:ethr:${randomWallet.address}`,
    };
  }
}

module.exports = new CryptoService();

