/**
 * Local Operator Issuer Registration Script
 * 
 * PURPOSE:
 * Registers the local platform administrator / operator account (Hardhat Account #0)
 * as an authorized issuer in the on-chain IssuerRegistry contract on the local development network.
 * 
 * CONSTRAINTS:
 * - Local development ONLY (Chain ID: 31337).
 * - Connects to the running localhost node. Does NOT redeploy contracts or mutate network state unnecessarily.
 * - Idempotent: Exits cleanly if the operator is already registered and approved.
 * - Never logs or exposes private keys.
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("===============================================================");
  console.log("Starting Local Operator Issuer Registration");
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

  // 3. Obtain Hardhat signer
  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("No signer available from Hardhat provider configuration.");
  }
  const signerAddress = signer.address;
  console.log(`Signer Account Address: ${signerAddress}`);

  // 4. Attach to IssuerRegistry contract
  const issuerRegistry = await ethers.getContractAt(
    "IssuerRegistry",
    issuerRegistryAddress,
    signer
  );

  // 5. Verify signer is the platform admin
  const contractAdmin = await issuerRegistry.admin();
  if (signerAddress.toLowerCase() !== contractAdmin.toLowerCase()) {
    throw new Error(
      `Signer mismatch: Signer ${signerAddress} is not the contract administrator (${contractAdmin}).`
    );
  }
  console.log(`✔ Signer verified as IssuerRegistry admin: ${contractAdmin}`);

  // 6. Check existing registration / approval status (idempotency check)
  const isAlreadyApproved = await issuerRegistry.isIssuerApproved(signerAddress);
  if (isAlreadyApproved) {
    console.log("---------------------------------------------------------------");
    console.log(`ℹ️ Operator account ${signerAddress} is ALREADY registered and approved as an issuer.`);
    console.log("No state changes or transactions required.");
    console.log("===============================================================");
    return {
      status: "ALREADY_APPROVED",
      operatorAddress: signerAddress,
      issuerRegistryAddress,
    };
  }

  // 7. Execute registration
  const issuerName = "Platform Master Issuer";
  const issuerDid = `did:ethr:${signerAddress.toLowerCase()}`;

  console.log(`Submitting registration transaction for:`);
  console.log(`  - Address: ${signerAddress}`);
  console.log(`  - Name:    ${issuerName}`);
  console.log(`  - DID:     ${issuerDid}`);

  const tx = await issuerRegistry.registerIssuer(signerAddress, issuerName, issuerDid);
  console.log(`Tx submitted: ${tx.hash}. Waiting for block confirmation...`);

  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(
      `Transaction reverted or failed on-chain with receipt status: ${receipt ? receipt.status : "unknown"}`
    );
  }

  // 8. Post-transaction verification check
  const isNowApproved = await issuerRegistry.isIssuerApproved(signerAddress);
  if (!isNowApproved) {
    throw new Error(
      `Verification assertion failed: isIssuerApproved(${signerAddress}) returned false after confirmed registration.`
    );
  }

  const profile = await issuerRegistry.getIssuer(signerAddress);

  console.log("===============================================================");
  console.log("✔ Operator Issuer Registration Successful!");
  console.log("===============================================================");
  console.log(`Network:             ${network.name || "localhost"} (Chain ID: ${chainId})`);
  console.log(`IssuerRegistry:      ${issuerRegistryAddress}`);
  console.log(`Operator Account:    ${signerAddress}`);
  console.log(`Registered Name:     ${profile.name}`);
  console.log(`Registered DID:      ${profile.did}`);
  console.log(`Approval Status:     ${isNowApproved}`);
  console.log(`Registration Time:   ${new Date(Number(profile.registeredAt) * 1000).toISOString()}`);
  console.log(`Transaction Hash:    ${receipt.hash}`);
  console.log(`Block Number:        ${receipt.blockNumber}`);
  console.log("===============================================================");

  return {
    status: "REGISTERED",
    operatorAddress: signerAddress,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Operator registration failed:", error.message || error);
      process.exit(1);
    });
}

module.exports = main;

