import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import solc from "solc";
import { ethers } from "ethers";

const MNEMONIC = "test test test test test test test test test test test junk";
const RPC_URL = "http://127.0.0.1:8545";
const NOX_COMPUTE_31337 = "0x44C00793aD4975617b3B5Fc27D4FB78E772c8236";
const TEE_UINT256 = 35;

const abi = ethers.AbiCoder.defaultAbiCoder();

function tryReadSync(abs) {
  try {
    return { contents: fsSync.readFileSync(abs, "utf8") };
  } catch {
    return null;
  }
}

async function compile(roots) {
  const contractsRoot = path.resolve("contracts");
  const localBases = [
    contractsRoot,
    path.join(contractsRoot, "identity"),
    path.join(contractsRoot, "invoice"),
    path.join(contractsRoot, "servicing"),
    path.join(contractsRoot, "risk"),
    path.join(contractsRoot, "disclosure"),
    path.join(contractsRoot, "vault"),
    path.join(contractsRoot, "mocks"),
    path.join(contractsRoot, "token"),
  ];
  const nodeModules = path.resolve("node_modules");

  const sources = {};
  for (const rel of roots) {
    const abs = path.join(contractsRoot, rel);
    sources[rel] = { content: await fs.readFile(abs, "utf8") };
  }

  function findImport(importPath) {
    if (importPath.startsWith("@")) {
      const abs = path.join(nodeModules, importPath);
      const res = tryReadSync(abs);
      return res ?? { error: `File not found: ${importPath}` };
    }

    if (!importPath.startsWith(".") && importPath.includes("/")) {
      const abs = path.join(nodeModules, importPath);
      const res = tryReadSync(abs);
      if (res) return res;
    }

    const candidates = localBases.map((base) => path.resolve(base, importPath));
    for (const abs of candidates) {
      const res = tryReadSync(abs);
      if (res) return res;
    }
    return { error: `File not found: ${importPath}` };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
  if (output.errors) {
    const fatal = output.errors.filter((e) => e.severity === "error");
    if (fatal.length) throw new Error(fatal.map((e) => e.formattedMessage).join("\n"));
  }

  const artifacts = new Map();
  for (const file of Object.keys(output.contracts)) {
    for (const contractName of Object.keys(output.contracts[file])) {
      const c = output.contracts[file][contractName];
      artifacts.set(contractName, {
        abi: c.abi,
        bytecode: `0x${c.evm.bytecode.object}`,
        deployedBytecode: `0x${c.evm.deployedBytecode.object}`,
      });
    }
  }
  return artifacts;
}

async function deploy(artifacts, name, signer, args = []) {
  const { abi: contractAbi, bytecode } = artifacts.get(name);
  const factory = new ethers.ContractFactory(contractAbi, bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.NonceManager(
    ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, "m/44'/60'/0'/0/0").connect(provider),
  );
  const operator = new ethers.NonceManager(
    ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, "m/44'/60'/0'/0/1").connect(provider),
  );
  const investor = new ethers.NonceManager(
    ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, "m/44'/60'/0'/0/2").connect(provider),
  );
  const issuer = new ethers.NonceManager(
    ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, "m/44'/60'/0'/0/3").connect(provider),
  );
  const auditor = new ethers.NonceManager(
    ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, "m/44'/60'/0'/0/4").connect(provider),
  );

  const deployerAddr = await deployer.getAddress();
  const operatorAddr = await operator.getAddress();
  const investorAddr = await investor.getAddress();
  const issuerAddr = await issuer.getAddress();
  const auditorAddr = await auditor.getAddress();

  const artifacts = await compile([
    "identity/IdentityRegistry.sol",
    "invoice/InvoiceRegistry.sol",
    "invoice/IConfidentialInvoiceProofVerifier.sol",
    "invoice/ConfidentialEcdsaAuditorVerifier.sol",
    "servicing/ServicingRouter.sol",
    "risk/RiskManager.sol",
    "risk/RiskPolicyPack.sol",
    "disclosure/DisclosureManager.sol",
    "mocks/MockERC20.sol",
    "mocks/MockNoxCompute.sol",
    "token/WrappedMockUSDC.sol",
    "vault/ERC7984FactoringVault.sol",
  ]);

  await provider.send("hardhat_setCode", [NOX_COMPUTE_31337, artifacts.get("MockNoxCompute").deployedBytecode]);
  const mockCompute = new ethers.Contract(NOX_COMPUTE_31337, artifacts.get("MockNoxCompute").abi, issuer);

  const identity = await deploy(artifacts, "IdentityRegistry", deployer);
  await (await identity.setVerified(investorAddr, 1n, true)).wait();
  await (await identity.setVerified(issuerAddr, 2n, true)).wait();
  await (await identity.setVerified(operatorAddr, 3n, true)).wait();
  const invoices = await deploy(artifacts, "InvoiceRegistry", deployer, [await identity.getAddress()]);
  const servicing = await deploy(artifacts, "ServicingRouter", deployer, [await invoices.getAddress()]);
  const risk = await deploy(artifacts, "RiskManager", deployer);
  const pack = await deploy(artifacts, "RiskPolicyPack", deployer);
  const disclosure = await deploy(artifacts, "DisclosureManager", deployer);
  const verifier = await deploy(artifacts, "ConfidentialEcdsaAuditorVerifier", deployer);
  const usdc = await deploy(artifacts, "MockERC20", deployer, ["MockUSDC", "mUSDC"]);
  const wrapper = await deploy(artifacts, "WrappedMockUSDC", deployer, [await usdc.getAddress()]);
  const vault = await deploy(artifacts, "ERC7984FactoringVault", deployer, [
    await wrapper.getAddress(),
    await identity.getAddress(),
    await invoices.getAddress(),
    operatorAddr,
  ]);

  console.log("Deployments", {
    invoices: await invoices.getAddress(),
    vault: await vault.getAddress(),
    servicing: await servicing.getAddress(),
    risk: await risk.getAddress(),
    pack: await pack.getAddress(),
    disclosure: await disclosure.getAddress(),
  });

  await (await invoices.setVault(await vault.getAddress(), true)).wait();
  await (await invoices.setServicer(await servicing.getAddress(), true)).wait();
  await (await invoices.setRiskManager(await risk.getAddress())).wait();
  await (await servicing.setDisputeWindow(0)).wait();
  await (await servicing.setRiskManager(await risk.getAddress())).wait();

  await (await risk.setServicingRouter(await servicing.getAddress())).wait();
  await (await risk.setConfidentialVault(await vault.getAddress())).wait();
  await (await risk.setInvoiceRegistry(await invoices.getAddress())).wait();
  await (await risk.setPoolCapEncryptedPublic(5_000_000n)).wait();
  await (await risk.setIssuerCapEncryptedPublic(issuerAddr, 5_000_000n)).wait();
  await (await risk.setInvoiceCapEncryptedPublic(3_000_000n)).wait();

  await (await pack.setRiskManager(await risk.getAddress())).wait();
  const obligorHash = ethers.keccak256(ethers.toUtf8Bytes("obligor-acme-lei-123"));
  const obligorGroupHash = ethers.keccak256(ethers.toUtf8Bytes("obligor-group-acme-holdco"));
  await (await pack.setIssuerObligorCapEncryptedPublic(issuerAddr, obligorHash, 5_000_000n)).wait();
  await (await pack.setIssuerGroupCapEncryptedPublic(issuerAddr, obligorGroupHash, 5_000_000n)).wait();
  await (await pack.setTierCapEncryptedPublic(2, 5_000_000n)).wait();
  await (await pack.setTierCapEncryptedPublic(3, 5_000_000n)).wait();
  await (await risk.setPolicyPack(await pack.getAddress())).wait();

  await (await vault.setServicingRouter(await servicing.getAddress())).wait();
  await (await vault.setRiskManager(await risk.getAddress())).wait();

  await (await disclosure.setAuditor(auditorAddr, true)).wait();
  await (await disclosure.setDisclosureOfficer(deployerAddr, true)).wait();
  await (await verifier.setAuditor(auditorAddr, true)).wait();

  const faceValue = 1_000_000n;
  const faceValueBytes = ethers.zeroPadValue(ethers.toBeHex(faceValue), 32);
  const faceValuePublic = await mockCompute.wrapAsPublicHandle.staticCall(faceValueBytes, TEE_UINT256);
  await (await mockCompute.wrapAsPublicHandle(faceValueBytes, TEE_UINT256)).wait();

  const zero = await mockCompute.wrapAsPublicHandle.staticCall(ethers.ZeroHash, TEE_UINT256);
  await (await mockCompute.wrapAsPublicHandle(ethers.ZeroHash, TEE_UINT256)).wait();

  const faceValueHandle = await mockCompute.add.staticCall(faceValuePublic, zero);
  await (await mockCompute.add(faceValuePublic, zero)).wait();

  const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
  const settlementRecipient = issuerAddr;
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("invoice-metadata-demo"));
  const invoiceRef = ethers.keccak256(ethers.toUtf8Bytes("inv-demo-1"));
  const riskTier = 2;

  const { chainId } = await provider.getNetwork();
  const domain = {
    name: "ConfidentialInvoiceProof",
    version: "1",
    chainId,
    verifyingContract: await verifier.getAddress(),
  };
  const types = {
    ConfidentialInvoiceProof: [
      { name: "issuer", type: "address" },
      { name: "faceValueHandle", type: "bytes32" },
      { name: "dueDate", type: "uint64" },
      { name: "settlementRecipient", type: "address" },
      { name: "metadataHash", type: "bytes32" },
      { name: "invoiceRef", type: "bytes32" },
      { name: "obligorHash", type: "bytes32" },
      { name: "obligorGroupHash", type: "bytes32" },
      { name: "riskTier", type: "uint8" },
      { name: "validUntil", type: "uint64" },
    ],
  };
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
  const signature = await auditor.signTypedData(domain, types, {
    issuer: issuerAddr,
    faceValueHandle,
    dueDate,
    settlementRecipient: issuerAddr,
    metadataHash,
    invoiceRef,
    obligorHash,
    obligorGroupHash,
    riskTier,
    validUntil,
  });
  const proof = abi.encode(["uint64", "bytes"], [validUntil, signature]);

  const txCreate = await invoices
    .connect(issuer)
    .createInvoiceConfidential(
      faceValueHandle,
      "0x",
      dueDate,
      settlementRecipient,
      metadataHash,
      invoiceRef,
      obligorHash,
      obligorGroupHash,
      riskTier,
      await verifier.getAddress(),
      proof,
    );
  console.log("txCreate", txCreate.hash);
  const createReceipt = await txCreate.wait();
  const created = createReceipt.logs
    .map((l) => {
      try {
        return invoices.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((d) => d && d.name === "InvoiceCreatedConfidential");
  const invoiceId = created.args.invoiceId;
  console.log("InvoiceCreatedConfidential", { invoiceId: invoiceId.toString() });

  await (await usdc.mint(investorAddr, 2_000_000n)).wait();
  const txApprove = await usdc.connect(investor).approve(await wrapper.getAddress(), 2_000_000n);
  console.log("txApproveUSDC", txApprove.hash);
  await txApprove.wait();

  const minted = await wrapper.connect(investor).wrap.staticCall(investorAddr, 2_000_000n);
  const txWrap = await wrapper.connect(investor).wrap(investorAddr, 2_000_000n);
  console.log("txWrap", txWrap.hash);
  await txWrap.wait();

  const txDeposit = await wrapper
    .connect(investor)
    .confidentialTransferAndCall(await vault.getAddress(), minted, "0x");
  console.log("txDeposit", txDeposit.hash);
  await txDeposit.wait();

  const operatorCompute = mockCompute.connect(operator);
  const fundAmount = 500_000n;
  const fundBytes = ethers.zeroPadValue(ethers.toBeHex(fundAmount), 32);
  const fundHandle = await operatorCompute.wrapAsPublicHandle.staticCall(fundBytes, TEE_UINT256);
  await (await operatorCompute.wrapAsPublicHandle(fundBytes, TEE_UINT256)).wait();
  const riskBundle = abi.encode(["bytes[]"], [["0x01", "0x01", "0x01", "0x01", "0x01", "0x01"]]);

  const txFund = await vault
    .connect(operator)
    ["fundInvoice(uint256,bytes32,bytes,bytes)"](invoiceId, fundHandle, "0x", riskBundle);
  console.log("txFund", txFund.hash);
  await txFund.wait();

  const txRequestTier = await invoices.connect(issuer).requestRiskTierMigration(invoiceId, 3);
  console.log("txRequestTier", txRequestTier.hash);
  await txRequestTier.wait();
  const tierBundle = abi.encode(["bytes[]"], [["0x01", "0x01"]]);
  const txApproveTier = await invoices.approveRiskTierMigration(invoiceId, tierBundle);
  console.log("txApproveTier", txApproveTier.hash);
  await txApproveTier.wait();

  const repayAmount = 200_000n;
  const repayBytes = ethers.zeroPadValue(ethers.toBeHex(repayAmount), 32);
  const repayHandle = await operatorCompute.wrapAsPublicHandle.staticCall(repayBytes, TEE_UINT256);
  await (await operatorCompute.wrapAsPublicHandle(repayBytes, TEE_UINT256)).wait();
  const txRepay = await wrapper
    .connect(issuer)
    .confidentialTransferAndCall(await vault.getAddress(), repayHandle, abi.encode(["uint256"], [invoiceId]));
  console.log("txRepay", txRepay.hash);
  const repayReceipt = await txRepay.wait();
  const reported = repayReceipt.logs
    .map((l) => {
      try {
        return servicing.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((d) => d && d.name === "PaymentReported");
  const paymentId = reported.args.paymentId;
  console.log("PaymentReported", { invoiceId: invoiceId.toString(), paymentId: paymentId.toString() });

  const txFinalize = await servicing.finalizePayment(invoiceId, paymentId, riskBundle);
  console.log("txFinalize", txFinalize.hash);
  await txFinalize.wait();

  const txDiscloseInvoice = await disclosure.discloseInvoice(await invoices.getAddress(), invoiceId, auditorAddr, 1);
  console.log("txDiscloseInvoice", txDiscloseInvoice.hash);
  await txDiscloseInvoice.wait();

  const txDiscloseShares = await disclosure.discloseInvestorShares(await vault.getAddress(), investorAddr, auditorAddr);
  console.log("txDiscloseShares", txDiscloseShares.hash);
  await txDiscloseShares.wait();

  const inv = await invoices.getInvoice(invoiceId);
  console.log("FinalInvoice", {
    invoiceId: invoiceId.toString(),
    status: inv.status.toString(),
    riskTier: inv.riskTier.toString(),
    faceValueHandle: inv.faceValueEncrypted,
    repaidHandle: inv.repaidAmountEncrypted,
  });
}

await main();
