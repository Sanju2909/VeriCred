const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Decentralized Credential Platform Smart Contracts", function () {
  let issuerRegistry;
  let credentialRegistry;
  let admin, issuer1, issuer2, unauthorizedUser, student, verifier;

  // Deterministic test data
  const testIssuer1 = {
    name: "National Institute of Technology",
    did: "did:ethr:0x1111111111111111111111111111111111111111",
  };

  const testIssuer2 = {
    name: "State University of Technology",
    did: "did:ethr:0x2222222222222222222222222222222222222222",
  };

  const sampleCredentialId = ethers.keccak256(ethers.toUtf8Bytes("CREDENTIAL-2026-NIT-001"));
  const sampleCredentialHash = ethers.keccak256(
    ethers.toUtf8Bytes(
      JSON.stringify({
        id: "CREDENTIAL-2026-NIT-001",
        degree: "Bachelor of Technology in Computer Science",
        recipient: "Alice Sharma",
        gpa: "3.9",
        issuedYear: 2026,
      })
    )
  );

  beforeEach(async function () {
    [admin, issuer1, issuer2, unauthorizedUser, student, verifier] = await ethers.getSigners();

    // 1. Deploy IssuerRegistry
    const IssuerRegistryFactory = await ethers.getContractFactory("IssuerRegistry");
    issuerRegistry = await IssuerRegistryFactory.deploy();
    await issuerRegistry.waitForDeployment();

    // 2. Deploy CredentialRegistry with IssuerRegistry address
    const CredentialRegistryFactory = await ethers.getContractFactory("CredentialRegistry");
    credentialRegistry = await CredentialRegistryFactory.deploy(await issuerRegistry.getAddress());
    await credentialRegistry.waitForDeployment();
  });

  // =========================================================================
  // 1. IssuerRegistry Deployment & Admin Role Tests
  // =========================================================================
  describe("IssuerRegistry: Initialization & Permissions", function () {
    it("should set the deployer as the initial platform admin", async function () {
      expect(await issuerRegistry.admin()).to.equal(admin.address);
    });

    it("should allow admin to transfer admin rights to a new address", async function () {
      await expect(issuerRegistry.connect(admin).transferAdmin(issuer2.address))
        .to.emit(issuerRegistry, "AdminTransferred")
        .withArgs(admin.address, issuer2.address);

      expect(await issuerRegistry.admin()).to.equal(issuer2.address);
    });

    it("should prevent non-admin from transferring admin rights", async function () {
      await expect(
        issuerRegistry.connect(unauthorizedUser).transferAdmin(unauthorizedUser.address)
      ).to.be.revertedWithCustomError(issuerRegistry, "IssuerRegistry__NotAdmin");
    });

    it("should prevent transferring admin to zero address", async function () {
      await expect(
        issuerRegistry.connect(admin).transferAdmin(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(issuerRegistry, "IssuerRegistry__ZeroAddress");
    });
  });

  // =========================================================================
  // 2. Issuer Registration & Authorization Lifecycle
  // =========================================================================
  describe("IssuerRegistry: Issuer Lifecycle & Access Control", function () {
    it("should allow admin to register and approve a valid issuer", async function () {
      const tx = await issuerRegistry
        .connect(admin)
        .registerIssuer(issuer1.address, testIssuer1.name, testIssuer1.did);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(issuerRegistry, "IssuerRegistered")
        .withArgs(issuer1.address, testIssuer1.name, testIssuer1.did, block.timestamp);

      expect(await issuerRegistry.isIssuerApproved(issuer1.address)).to.be.true;

      const profile = await issuerRegistry.getIssuer(issuer1.address);
      expect(profile.name).to.equal(testIssuer1.name);
      expect(profile.did).to.equal(testIssuer1.did);
      expect(profile.isApproved).to.be.true;
      expect(profile.registeredAt).to.equal(BigInt(block.timestamp));
      expect(profile.revokedAt).to.equal(0n);
    });

    it("should prevent non-admin from registering an issuer", async function () {
      await expect(
        issuerRegistry
          .connect(unauthorizedUser)
          .registerIssuer(unauthorizedUser.address, "Fake University", "did:fake:01")
      ).to.be.revertedWithCustomError(issuerRegistry, "IssuerRegistry__NotAdmin");
    });

    it("should prevent registering zero address as issuer", async function () {
      await expect(
        issuerRegistry
          .connect(admin)
          .registerIssuer(ethers.ZeroAddress, testIssuer1.name, testIssuer1.did)
      ).to.be.revertedWithCustomError(issuerRegistry, "IssuerRegistry__ZeroAddress");
    });

    it("should prevent registering with empty name or empty DID", async function () {
      await expect(
        issuerRegistry.connect(admin).registerIssuer(issuer1.address, "", testIssuer1.did)
      ).to.be.revertedWithCustomError(issuerRegistry, "IssuerRegistry__EmptyName");

      await expect(
        issuerRegistry.connect(admin).registerIssuer(issuer1.address, testIssuer1.name, "")
      ).to.be.revertedWithCustomError(issuerRegistry, "IssuerRegistry__EmptyDID");
    });

    it("should prevent duplicate issuer registration", async function () {
      await issuerRegistry
        .connect(admin)
        .registerIssuer(issuer1.address, testIssuer1.name, testIssuer1.did);

      await expect(
        issuerRegistry
          .connect(admin)
          .registerIssuer(issuer1.address, "Duplicate Attempt", "did:dup:01")
      ).to.be.revertedWithCustomError(issuerRegistry, "IssuerRegistry__AlreadyRegistered");
    });

    it("should allow admin to suspend an approved issuer and reactivate them", async function () {
      await issuerRegistry
        .connect(admin)
        .registerIssuer(issuer1.address, testIssuer1.name, testIssuer1.did);

      // Suspend
      const txSuspend = await issuerRegistry.connect(admin).suspendIssuer(issuer1.address);
      const receiptSuspend = await txSuspend.wait();
      const blockSuspend = await ethers.provider.getBlock(receiptSuspend.blockNumber);

      await expect(txSuspend)
        .to.emit(issuerRegistry, "IssuerSuspended")
        .withArgs(issuer1.address, blockSuspend.timestamp);

      expect(await issuerRegistry.isIssuerApproved(issuer1.address)).to.be.false;

      // Reactivate
      const txReactivate = await issuerRegistry.connect(admin).reactivateIssuer(issuer1.address);
      const receiptReactivate = await txReactivate.wait();
      const blockReactivate = await ethers.provider.getBlock(receiptReactivate.blockNumber);

      await expect(txReactivate)
        .to.emit(issuerRegistry, "IssuerReactivated")
        .withArgs(issuer1.address, blockReactivate.timestamp);

      expect(await issuerRegistry.isIssuerApproved(issuer1.address)).to.be.true;
    });

    it("should prevent non-admin from suspending or reactivating issuers", async function () {
      await issuerRegistry
        .connect(admin)
        .registerIssuer(issuer1.address, testIssuer1.name, testIssuer1.did);

      await expect(
        issuerRegistry.connect(unauthorizedUser).suspendIssuer(issuer1.address)
      ).to.be.revertedWithCustomError(issuerRegistry, "IssuerRegistry__NotAdmin");

      await expect(
        issuerRegistry.connect(unauthorizedUser).reactivateIssuer(issuer1.address)
      ).to.be.revertedWithCustomError(issuerRegistry, "IssuerRegistry__NotAdmin");
    });

    it("should track issuer enumeration list and count", async function () {
      await issuerRegistry
        .connect(admin)
        .registerIssuer(issuer1.address, testIssuer1.name, testIssuer1.did);
      await issuerRegistry
        .connect(admin)
        .registerIssuer(issuer2.address, testIssuer2.name, testIssuer2.did);

      expect(await issuerRegistry.getIssuerCount()).to.equal(2n);
      const all = await issuerRegistry.getAllIssuers();
      expect(all).to.deep.equal([issuer1.address, issuer2.address]);
    });
  });

  // =========================================================================
  // 3. CredentialRegistry: Issuance & Constraints
  // =========================================================================
  describe("CredentialRegistry: Credential Issuance", function () {
    beforeEach(async function () {
      await issuerRegistry
        .connect(admin)
        .registerIssuer(issuer1.address, testIssuer1.name, testIssuer1.did);
    });

    it("should reject deployment with zero address for IssuerRegistry", async function () {
      const Factory = await ethers.getContractFactory("CredentialRegistry");
      await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__ZeroRegistryAddress"
      );
    });

    it("should allow an authorized issuer to anchor a credential fingerprint", async function () {
      const expiresAt = 0; // Does not expire

      const tx = await credentialRegistry
        .connect(issuer1)
        .issueCredential(sampleCredentialId, sampleCredentialHash, expiresAt);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(credentialRegistry, "CredentialIssued")
        .withArgs(
          sampleCredentialId,
          sampleCredentialHash,
          issuer1.address,
          block.timestamp,
          expiresAt
        );

      const record = await credentialRegistry.getCredential(sampleCredentialId);
      expect(record.credentialHash).to.equal(sampleCredentialHash);
      expect(record.issuer).to.equal(issuer1.address);
      expect(record.expiresAt).to.equal(0n);
      expect(record.isRevoked).to.be.false;
    });

    it("should prevent unauthorized addresses from issuing credentials", async function () {
      await expect(
        credentialRegistry
          .connect(unauthorizedUser)
          .issueCredential(sampleCredentialId, sampleCredentialHash, 0)
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__NotAuthorizedIssuer"
      );
    });

    it("should prevent duplicate credential ID issuance", async function () {
      await credentialRegistry
        .connect(issuer1)
        .issueCredential(sampleCredentialId, sampleCredentialHash, 0);

      const duplicateHash = ethers.keccak256(ethers.toUtf8Bytes("DIFFERENT_HASH"));

      await expect(
        credentialRegistry
          .connect(issuer1)
          .issueCredential(sampleCredentialId, duplicateHash, 0)
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__CredentialAlreadyExists"
      );
    });

    it("should prevent empty credential ID or empty hash", async function () {
      await expect(
        credentialRegistry
          .connect(issuer1)
          .issueCredential(ethers.ZeroHash, sampleCredentialHash, 0)
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__InvalidCredentialId"
      );

      await expect(
        credentialRegistry
          .connect(issuer1)
          .issueCredential(sampleCredentialId, ethers.ZeroHash, 0)
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__EmptyCredentialHash"
      );
    });

    it("should reject expiration timestamps in the past", async function () {
      const pastTime = (await time.latest()) - 100;
      await expect(
        credentialRegistry
          .connect(issuer1)
          .issueCredential(sampleCredentialId, sampleCredentialHash, pastTime)
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__InvalidExpiration"
      );
    });
  });

  // =========================================================================
  // 4. Credential Expiration Lifecycle & Verification
  // =========================================================================
  describe("CredentialRegistry: Expiration & Verification Lifecycle", function () {
    beforeEach(async function () {
      await issuerRegistry
        .connect(admin)
        .registerIssuer(issuer1.address, testIssuer1.name, testIssuer1.did);
    });

    it("should verify active non-expiring credential successfully", async function () {
      await credentialRegistry
        .connect(issuer1)
        .issueCredential(sampleCredentialId, sampleCredentialHash, 0);

      const [isValid, statusCode, message] = await credentialRegistry.verifyCredential(
        sampleCredentialId,
        sampleCredentialHash
      );

      expect(isValid).to.be.true;
      expect(statusCode).to.equal(0n); // VALID
      expect(message).to.equal("Credential is valid, authentic, and active");
      expect(await credentialRegistry.isCredentialValid(sampleCredentialId)).to.be.true;
    });

    it("should fail verification when credential hash does not match", async function () {
      await credentialRegistry
        .connect(issuer1)
        .issueCredential(sampleCredentialId, sampleCredentialHash, 0);

      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("TAMPERED_CONTENT"));

      const [isValid, statusCode, message] = await credentialRegistry.verifyCredential(
        sampleCredentialId,
        wrongHash
      );

      expect(isValid).to.be.false;
      expect(statusCode).to.equal(2n); // HASH_MISMATCH
      expect(message).to.equal(
        "Credential content hash does not match on-chain fingerprint"
      );
    });

    it("should handle credential expiration before and after threshold", async function () {
      const currentTime = await time.latest();
      const expiresAt = currentTime + 3600; // 1 hour from now

      await credentialRegistry
        .connect(issuer1)
        .issueCredential(sampleCredentialId, sampleCredentialHash, expiresAt);

      // Before expiration: Should be valid
      let [isValid, statusCode] = await credentialRegistry.verifyCredential(
        sampleCredentialId,
        sampleCredentialHash
      );
      expect(isValid).to.be.true;
      expect(statusCode).to.equal(0n);

      // Fast forward time past expiration (e.g. 2 hours)
      await time.increase(7200);

      // After expiration: Should be invalid with CREDENTIAL_EXPIRED
      [isValid, statusCode] = await credentialRegistry.verifyCredential(
        sampleCredentialId,
        sampleCredentialHash
      );
      expect(isValid).to.be.false;
      expect(statusCode).to.equal(4n); // CREDENTIAL_EXPIRED
      expect(await credentialRegistry.isCredentialValid(sampleCredentialId)).to.be.false;
    });

    it("should invalidate credential verification if issuing institution is suspended", async function () {
      await credentialRegistry
        .connect(issuer1)
        .issueCredential(sampleCredentialId, sampleCredentialHash, 0);

      // Admin suspends issuer1
      await issuerRegistry.connect(admin).suspendIssuer(issuer1.address);

      const [isValid, statusCode, message] = await credentialRegistry.verifyCredential(
        sampleCredentialId,
        sampleCredentialHash
      );

      expect(isValid).to.be.false;
      expect(statusCode).to.equal(5n); // ISSUER_SUSPENDED
      expect(message).to.equal("Issuing institution is suspended or unauthorized");
      expect(await credentialRegistry.isCredentialValid(sampleCredentialId)).to.be.false;
    });

    it("should return CREDENTIAL_NOT_FOUND for nonexistent credential queries", async function () {
      const nonExistentId = ethers.keccak256(ethers.toUtf8Bytes("NONEXISTENT"));

      const [isValid, statusCode, message] = await credentialRegistry.verifyCredential(
        nonExistentId,
        sampleCredentialHash
      );

      expect(isValid).to.be.false;
      expect(statusCode).to.equal(1n); // CREDENTIAL_NOT_FOUND
      expect(message).to.equal("Credential not found in registry");

      await expect(
        credentialRegistry.getCredential(nonExistentId)
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__CredentialNotFound"
      );
    });
  });

  // =========================================================================
  // 5. Credential Revocation Workflow
  // =========================================================================
  describe("CredentialRegistry: Revocation & Permissions", function () {
    const revocationReason = "Student requested certificate update due to legal name change";

    beforeEach(async function () {
      await issuerRegistry
        .connect(admin)
        .registerIssuer(issuer1.address, testIssuer1.name, testIssuer1.did);

      await credentialRegistry
        .connect(issuer1)
        .issueCredential(sampleCredentialId, sampleCredentialHash, 0);
    });

    it("should allow the original issuer to revoke their own credential", async function () {
      const tx = await credentialRegistry
        .connect(issuer1)
        .revokeCredential(sampleCredentialId, revocationReason);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(credentialRegistry, "CredentialRevoked")
        .withArgs(
          sampleCredentialId,
          issuer1.address,
          revocationReason,
          block.timestamp
        );

      const record = await credentialRegistry.getCredential(sampleCredentialId);
      expect(record.isRevoked).to.be.true;
      expect(record.revocationReason).to.equal(revocationReason);

      const [isValid, statusCode] = await credentialRegistry.verifyCredential(
        sampleCredentialId,
        sampleCredentialHash
      );
      expect(isValid).to.be.false;
      expect(statusCode).to.equal(3n); // CREDENTIAL_REVOKED
    });

    it("should allow the platform admin to revoke a credential when required", async function () {
      const adminReason = "Administrative compliance revocation by platform governance";

      const tx = await credentialRegistry
        .connect(admin)
        .revokeCredential(sampleCredentialId, adminReason);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(credentialRegistry, "CredentialRevoked")
        .withArgs(sampleCredentialId, admin.address, adminReason, block.timestamp);

      const record = await credentialRegistry.getCredential(sampleCredentialId);
      expect(record.isRevoked).to.be.true;
      expect(record.revocationReason).to.equal(adminReason);
    });

    it("should prevent unauthorized third party from revoking a credential", async function () {
      await expect(
        credentialRegistry
          .connect(unauthorizedUser)
          .revokeCredential(sampleCredentialId, "Malicious revocation attempt")
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__UnauthorizedRevocation"
      );
    });

    it("should prevent repeated revocation of already revoked credential", async function () {
      await credentialRegistry
        .connect(issuer1)
        .revokeCredential(sampleCredentialId, revocationReason);

      await expect(
        credentialRegistry
          .connect(issuer1)
          .revokeCredential(sampleCredentialId, "Second revocation attempt")
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__AlreadyRevoked"
      );
    });

    it("should reject revocation with empty reason", async function () {
      await expect(
        credentialRegistry.connect(issuer1).revokeCredential(sampleCredentialId, "")
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__EmptyRevocationReason"
      );
    });

    it("should revert if attempting to revoke a nonexistent credential", async function () {
      const nonExistentId = ethers.keccak256(ethers.toUtf8Bytes("NONEXISTENT"));
      await expect(
        credentialRegistry.connect(issuer1).revokeCredential(nonExistentId, "Reason")
      ).to.be.revertedWithCustomError(
        credentialRegistry,
        "CredentialRegistry__CredentialNotFound"
      );
    });
  });
});
