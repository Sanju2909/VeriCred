const { expect } = require("chai");
const cryptoService = require("../src/services/cryptoService");
const { canonicalize } = require("../src/utils/canonicalize");

describe("Cryptographic Credential Engine", function () {
  let issuerKeypair;

  const sampleCredential = {
    "@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.org"],
    id: "urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    type: ["VerifiableCredential", "AcademicDegreeCredential"],
    issuer: {
      id: "did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      name: "Metropolis Institute of Technology",
      ethereumAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    },
    issuanceDate: "2026-10-10T12:00:00.000Z",
    expirationDate: "2030-10-10T12:00:00.000Z",
    credentialSubject: {
      id: "did:ethr:0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      name: "Bob Student",
      degree: "Bachelor of Science in Computer Science",
      gpa: "3.95",
    },
  };

  before(function () {
    issuerKeypair = cryptoService.generateKeyPair();
  });

  // =========================================================================
  // 1. Deterministic JSON Canonicalization (RFC 8785)
  // =========================================================================
  describe("RFC 8785 JSON Canonicalization", function () {
    it("should produce deterministic serialization regardless of key ordering", function () {
      const objA = { z: 1, a: 2, m: { b: 3, a: 4 } };
      const objB = { a: 2, m: { a: 4, b: 3 }, z: 1 };

      const canonA = canonicalize(objA);
      const canonB = canonicalize(objB);

      expect(canonA).to.equal(canonB);
      expect(canonA).to.equal('{"a":2,"m":{"a":4,"b":3},"z":1}');
    });

    it("should compute consistent Keccak-256 and SHA-256 hashes", function () {
      const hashes1 = cryptoService.computeCredentialHashes(sampleCredential);
      const hashes2 = cryptoService.computeCredentialHashes(sampleCredential);

      expect(hashes1.keccak256).to.equal(hashes2.keccak256);
      expect(hashes1.sha256).to.equal(hashes2.sha256);
      expect(hashes1.keccak256).to.match(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  // =========================================================================
  // 2. ECDSA Signature Generation & Verification
  // =========================================================================
  describe("ECDSA Asymmetric Signing & Verification", function () {
    let signedCredential;

    it("should sign a credential and attach an EcdsaSecp256k1Signature2019 proof", async function () {
      signedCredential = await cryptoService.signCredential(
        sampleCredential,
        issuerKeypair.privateKey,
        issuerKeypair.did
      );

      expect(signedCredential).to.have.property("proof");
      expect(signedCredential.proof.type).to.equal("EcdsaSecp256k1Signature2019");
      expect(signedCredential.proof.proofPurpose).to.equal("assertionMethod");
      expect(signedCredential.proof.verificationMethod).to.equal(`${issuerKeypair.did}#key-1`);
      expect(signedCredential.proof.proofValue).to.match(/^0x[a-fA-F0-9]{130}$/); // 65-byte ECDSA signature in hex
    });

    it("should verify authentic credential signature successfully", function () {
      const result = cryptoService.verifySignature(signedCredential, issuerKeypair.address);

      expect(result.isValid).to.be.true;
      expect(result.recoveredAddress.toLowerCase()).to.equal(issuerKeypair.address.toLowerCase());
      expect(result.reason).to.be.null;
    });

    it("should reject credential if claims data has been tampered with", function () {
      // Tamper with GPA claim
      const tamperedCredential = JSON.parse(JSON.stringify(signedCredential));
      tamperedCredential.credentialSubject.gpa = "4.0"; // Modified claim

      const result = cryptoService.verifySignature(tamperedCredential, issuerKeypair.address);

      expect(result.isValid).to.be.false;
      expect(result.recoveredAddress.toLowerCase()).to.not.equal(issuerKeypair.address.toLowerCase());
    });

    it("should reject credential if issuer address is mismatched", function () {
      const otherKeypair = cryptoService.generateKeyPair();
      const result = cryptoService.verifySignature(signedCredential, otherKeypair.address);

      expect(result.isValid).to.be.false;
      expect(result.reason).to.include("Signer address mismatch");
    });

    it("should reject credential if signature bytes are corrupt", function () {
      const corruptCredential = JSON.parse(JSON.stringify(signedCredential));
      corruptCredential.proof.proofValue = "0x" + "00".repeat(65); // Invalid signature

      const result = cryptoService.verifySignature(corruptCredential, issuerKeypair.address);

      expect(result.isValid).to.be.false;
    });

    it("should reject credential missing the proof object", function () {
      const unproved = { ...sampleCredential };
      delete unproved.proof;

      const result = cryptoService.verifySignature(unproved, issuerKeypair.address);

      expect(result.isValid).to.be.false;
      expect(result.reason).to.include("missing cryptographic proof");
    });
  });
});

