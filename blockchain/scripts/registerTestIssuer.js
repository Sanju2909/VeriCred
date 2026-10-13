/**
 * Test Issuer On-Chain Registration Script
 * 
 * PURPOSE:
 * Registers the academic test issuer account (Hardhat Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8)
 * as an authorized issuer in the on-chain IssuerRegistry contract on the local development network.
 * 
 * CONSTRAINTS:
 * - Local development ONLY (Chain ID: 31337).
 * - Connects to the running localhost node. Does NOT redeploy contracts or mutate network state unnecessarily.
 * - Requires the transaction signer to be the verified platform administrator (Hardhat Account #0).
 * - Idempotent: Exits cleanly if the test issuer is already registered and approved.
 * - Never logs or exposes private keys.
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("===============================================================");
  console.log("Starting Test Issuer On-Chain Registration");
  console.log("===============================================================");

  // 1. Verify network and chain ID
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId !== 31337) {
    throw new Error(
      `Safety check failed: Current chain ID is ${chainId}. This script is strictly permitted on local Hardhat development network (Chain ID: 31337).`
    );
  }
  console.log(`✔ Connected to network: ${network.name || "localhost"} (Chain ID: ${chainId})`);

  // 2. Resolve contract address
  const issuerRegistryAddress =
    process.env.ISSUER_REGISTRY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  if (!ethers.isAddress(issuerRegistryAddress)) {
    throw new Error(`Invalid IssuerRegistry contract address: ${issuerRegistryAddress}`);
  }

  // 3. Obtain Hardhat admin signer (Account #0)
  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("No signer available from Hardhat provider configuration.");
  }
  const signerAddress = signer.address;
  console.log(`Admin Signer Address: ${signerAddress}`);

  // 4. Attach to IssuerRegistry contract
  const issuerRegistry = await ethers.getContractAt(
    "IssuerRegistry",
    issuerRegistryAddress,
    signer
  );

  // 5. Verify signer is the on-chain contract admin
  const contractAdmin = await issuerRegistry.admin();
  if (signerAddress.toLowerCase() !== contractAdmin.toLowerCase()) {
    throw new Error(
      `Signer mismatch: Signer ${signerAddress} is not the contract administrator (${contractAdmin}).`
    );
  }
  console.log(`✔ Signer verified as on-chain IssuerRegistry admin: ${contractAdmin}`);

  // 6. Define target test issuer parameters
  const testIssuerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const testIssuerName = "State University of Technology";
  const testIssuerDid = `did:ethr:${testIssuerAddress.toLowerCase()}`;

  // 7. Check existing registration / approval status (idempotency check)
  const isAlreadyApproved = await issuerRegistry.isIssuerApproved(testIssuerAddress);
  if (isAlreadyApproved) {
    console.log("---------------------------------------------------------------");
    console.log(`ℹ️ Test issuer account ${testIssuerAddress} is ALREADY registered and approved.`);
    console.log("No state changes or transactions required.");
    console.log("===============================================================");
    return {
      status: "ALREADY_APPROVED",
      issuerAddress: testIssuerAddress,
      issuerRegistryAddress,
    };
  }

  // 8. Execute registration transaction
  console.log(`Submitting registration transaction for test issuer:`);
  console.log(`  - Address: ${testIssuerAddress}`);
  console.log(`  - Name:    ${testIssuerName}`);
  console.log(`  - DID:     ${testIssuerDid}`);

  const tx = await issuerRegistry.registerIssuer(
    testIssuerAddress,
    testIssuerName,
    testIssuerDid
  );
  console.log(`Tx submitted: ${tx.hash}. Waiting for block confirmation...`);

  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(
      `Transaction reverted or failed on-chain with receipt status: ${receipt ? receipt.status : "unknown"}`
    );
  }

  // 9. Post-transaction verification check
  const isNowApproved = await issuerRegistry.isIssuerApproved(testIssuerAddress);
  if (!isNowApproved) {
    throw new Error(
      `Verification assertion failed: isIssuerApproved(${testIssuerAddress}) returned false after confirmed registration.`
    );
  }

  const profile = await issuerRegistry.getIssuer(testIssuerAddress);

  console.log("===============================================================");
  console.log("✔ Test Issuer Registration Successful!");
  console.log("===============================================================");
  console.log(`Network:             ${network.name || "localhost"} (Chain ID: ${chainId})`);
  console.log(`IssuerRegistry:      ${issuerRegistryAddress}`);
  console.log(`Issuer Address:      ${testIssuerAddress}`);
  console.log(`Institutional Name:  ${profile.name}`);
  console.log(`Registered DID:      ${profile.did}`);
  console.log(`Approval Status:     ${isNowApproved}`);
  console.log(`Registration Time:   ${new Date(Number(profile.registeredAt) * 1000).toISOString()}`);
  console.log(`Transaction Hash:    ${receipt.hash}`);
  console.log(`Block Number:        ${receipt.blockNumber}`);
  console.log("===============================================================");

  return {
    status: "REGISTERED",
    issuerAddress: testIssuerAddress,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Test issuer registration failed:", error.message || error);
      process.exit(1);
    });
}

module.exports = main;

