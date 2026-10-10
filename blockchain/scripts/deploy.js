const { ethers } = require("hardhat");

async function main() {
  console.log("===============================================================");
  console.log("Starting Decentralized Credential Platform Contract Deployment");
  console.log("===============================================================");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} ETH\n`);

  // 1. Deploy IssuerRegistry
  console.log("Deploying IssuerRegistry...");
  const IssuerRegistryFactory = await ethers.getContractFactory("IssuerRegistry");
  const issuerRegistry = await IssuerRegistryFactory.deploy();
  await issuerRegistry.waitForDeployment();
  const issuerRegistryAddress = await issuerRegistry.getAddress();
  console.log(`✔ IssuerRegistry successfully deployed to: ${issuerRegistryAddress}`);

  // 2. Deploy CredentialRegistry
  console.log("Deploying CredentialRegistry...");
  const CredentialRegistryFactory = await ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistryFactory.deploy(issuerRegistryAddress);
  await credentialRegistry.waitForDeployment();
  const credentialRegistryAddress = await credentialRegistry.getAddress();
  console.log(`✔ CredentialRegistry successfully deployed to: ${credentialRegistryAddress}\n`);

  console.log("===============================================================");
  console.log("Deployment Summary:");
  console.log(`Network: ${(await ethers.provider.getNetwork()).name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);
  console.log(`ISSUER_REGISTRY_ADDRESS=${issuerRegistryAddress}`);
  console.log(`CREDENTIAL_REGISTRY_ADDRESS=${credentialRegistryAddress}`);
  console.log("===============================================================");

  return {
    issuerRegistryAddress,
    credentialRegistryAddress,
  };
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = main;
