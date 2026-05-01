import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import solc from "solc";

const abi = ethers.AbiCoder.defaultAbiCoder();

function keccakAbi(types, values) {
  return ethers.keccak256(abi.encode(types, values));
}

function getProjectPaths() {
  const contractsRoot = path.resolve("contracts");
  return {
    contractsRoot,
    localBases: [
      contractsRoot,
      path.join(contractsRoot, "identity"),
      path.join(contractsRoot, "attestations"),
      path.join(contractsRoot, "invoice"),
      path.join(contractsRoot, "servicing"),
      path.join(contractsRoot, "risk"),
      path.join(contractsRoot, "disclosure"),
      path.join(contractsRoot, "vault"),
      path.join(contractsRoot, "mocks"),
      path.join(contractsRoot, "token"),
    ],
    nodeModules: path.resolve("node_modules"),
  };
}

function tryReadSync(abs) {
  try {
    return { contents: fsSync.readFileSync(abs, "utf8") };
  } catch {
    return null;
  }
}

async function compile(roots) {
  const { contractsRoot, localBases, nodeModules } = getProjectPaths();

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
    if (fatal.length) {
      throw new Error(fatal.map((e) => e.formattedMessage).join("\n"));
    }
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

const NOX_COMPUTE_31337 = "0x44C00793aD4975617b3B5Fc27D4FB78E772c8236";
const TEE_UINT256 = 35;

describe("Box / Nox factoring vault", function () {
  it("plaintext mode: ECDSA + attestation invoices + ERC20 vault flow", async function () {
    const [deployer, operator, investor, issuer, auditor, attester, debtor] = await ethers.getSigners();

    const artifacts = await compile([
      "identity/IIdentityRegistry.sol",
      "identity/IdentityRegistry.sol",
      "attestations/IAttestationRegistry.sol",
      "attestations/AttestationRegistry.sol",
      "invoice/IInvoiceProofVerifier.sol",
      "invoice/EcdsaAuditorVerifier.sol",
      "invoice/AttestationVerifier.sol",
      "invoice/InvoiceRegistry.sol",
      "risk/RiskManager.sol",
      "mocks/MockERC20.sol",
      "vault/PlainFactoringVault.sol",
    ]);

    const identity = await deploy(artifacts, "IdentityRegistry", deployer);
    const attestations = await deploy(artifacts, "AttestationRegistry", deployer);
    const ecdsaVerifier = await deploy(artifacts, "EcdsaAuditorVerifier", deployer);
    const attestationVerifier = await deploy(artifacts, "AttestationVerifier", deployer, [
      await attestations.getAddress(),
    ]);
    const invoices = await deploy(artifacts, "InvoiceRegistry", deployer, [await identity.getAddress()]);
    const usdc = await deploy(artifacts, "MockERC20", deployer, ["MockUSDC", "mUSDC"]);
    const vault = await deploy(artifacts, "PlainFactoringVault", deployer, [
      await usdc.getAddress(),
      await identity.getAddress(),
      await invoices.getAddress(),
    ]);
    const risk = await deploy(artifacts, "RiskManager", deployer);
    await risk.setPlainVault(await vault.getAddress());
    await risk.setPoolCapPlain(600_000n);
    await risk.setIssuerCapPlain(issuer.address, 600_000n);
    await risk.setInvoiceCapPlain(600_000n);
    await vault.setRiskManager(await risk.getAddress());

    await invoices.setVault(await vault.getAddress(), true);

    await identity.setVerified(investor.address, 1n, true);
    await identity.setVerified(issuer.address, 2n, true);
    await identity.setVerified(operator.address, 3n, true);

    await ecdsaVerifier.setAuditor(auditor.address, true);
    const schemaId = ethers.id("INVOICE_SCHEMA_V1");
    await attestationVerifier.setSchemaAllowed(schemaId, true);
    await attestationVerifier.setAttesterAllowed(attester.address, true);

    const faceValue = 1_000_000n;
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
    const settlementRecipient = issuer.address;
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("invoice-metadata-v1"));
    const invoiceRef1 = ethers.keccak256(ethers.toUtf8Bytes("inv-ecdsa-1"));
    const invoiceRef2 = ethers.keccak256(ethers.toUtf8Bytes("inv-attest-1"));
    const obligorHash = ethers.keccak256(ethers.toUtf8Bytes("obligor-acme-lei-123"));
    const obligorGroupHash = ethers.keccak256(ethers.toUtf8Bytes("obligor-group-acme-holdco"));
    const riskTier = 2;

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "InvoiceProof", version: "1", chainId, verifyingContract: await ecdsaVerifier.getAddress() };
    const types = {
      InvoiceProof: [
        { name: "issuer", type: "address" },
        { name: "faceValue", type: "uint256" },
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
      issuer: issuer.address,
      faceValue,
      dueDate,
      settlementRecipient,
      metadataHash,
      invoiceRef: invoiceRef1,
      obligorHash,
      obligorGroupHash,
      riskTier,
      validUntil,
    });
    const ecdsaProof = abi.encode(["uint64", "bytes"], [validUntil, signature]);

    const tx1 = await invoices
      .connect(issuer)
      .createInvoice(
        faceValue,
        dueDate,
        settlementRecipient,
        metadataHash,
        invoiceRef1,
        obligorHash,
        obligorGroupHash,
        riskTier,
        await ecdsaVerifier.getAddress(),
        ecdsaProof,
      );
    const receipt1 = await tx1.wait();
    const invoiceId1 = receipt1.logs
      .map((l) => {
        try {
          return invoices.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((d) => d && d.name === "InvoiceCreated").args.invoiceId;

    const ctxHash = keccakAbi(
      ["address", "uint256", "uint64", "address", "bytes32", "bytes32", "bytes32", "bytes32", "uint8"],
      [
        issuer.address,
        faceValue,
        dueDate,
        settlementRecipient,
        metadataHash,
        invoiceRef2,
        obligorHash,
        obligorGroupHash,
        riskTier,
      ],
    );
    const expirationTime = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
    const uid = await attestations.connect(attester).attest.staticCall(schemaId, issuer.address, ctxHash, expirationTime);
    await attestations.connect(attester).attest(schemaId, issuer.address, ctxHash, expirationTime);
    const attestationProof = abi.encode(["bytes32"], [uid]);

    const tx2 = await invoices
      .connect(issuer)
      .createInvoice(
        faceValue,
        dueDate,
        settlementRecipient,
        metadataHash,
        invoiceRef2,
        obligorHash,
        obligorGroupHash,
        riskTier,
        await attestationVerifier.getAddress(),
        attestationProof,
      );
    const receipt2 = await tx2.wait();
    const invoiceId2 = receipt2.logs
      .map((l) => {
        try {
          return invoices.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((d) => d && d.name === "InvoiceCreated").args.invoiceId;

    await usdc.mint(investor.address, 2_000_000n);
    await usdc.connect(investor).approve(await vault.getAddress(), 2_000_000n);
    await vault.connect(investor).deposit(2_000_000n);

    await vault.connect(operator).fundInvoice(invoiceId1, 500_000n);
    await usdc.mint(debtor.address, 600_000n);
    await usdc.connect(debtor).approve(await vault.getAddress(), 600_000n);
    await vault.connect(debtor).repayInvoice(invoiceId1, 600_000n);

    const inv1 = await invoices.getInvoice(invoiceId1);
    expect(inv1.status).to.equal(3n);

    const reqTx = await vault.connect(investor).requestRedeem(1_000_000n);
    const reqReceipt = await reqTx.wait();
    const requestId = reqReceipt.logs
      .map((l) => {
        try {
          return vault.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((d) => d && d.name === "RedeemRequested").args.requestId;
    await vault.connect(operator).fulfillRedeem(requestId, 900_000n);

    const inv2 = await invoices.getInvoice(invoiceId2);
    expect(inv2.status).to.equal(1n);
  });

  it("privacy upgrade: confidential invoice terms (faceValue encrypted handle) + no public repaid signal in encrypted mode", async function () {
    const [deployer, issuer, auditor] = await ethers.getSigners();

    const artifacts = await compile([
      "identity/IIdentityRegistry.sol",
      "identity/IdentityRegistry.sol",
      "invoice/IConfidentialInvoiceProofVerifier.sol",
      "invoice/ConfidentialEcdsaAuditorVerifier.sol",
      "invoice/InvoiceRegistry.sol",
      "disclosure/DisclosureManager.sol",
      "mocks/MockNoxCompute.sol",
    ]);

    const identity = await deploy(artifacts, "IdentityRegistry", deployer);
    const verifier = await deploy(artifacts, "ConfidentialEcdsaAuditorVerifier", deployer);
    const invoices = await deploy(artifacts, "InvoiceRegistry", deployer, [await identity.getAddress()]);
    const disclosure = await deploy(artifacts, "DisclosureManager", deployer);
    await disclosure.setAuditor(auditor.address, true);
    await disclosure.setDisclosureOfficer(deployer.address, true);

    await identity.setVerified(issuer.address, 2n, true);
    await verifier.setAuditor(auditor.address, true);

    await ethers.provider.send("hardhat_setCode", [NOX_COMPUTE_31337, artifacts.get("MockNoxCompute").deployedBytecode]);
    const mockCompute = new ethers.Contract(NOX_COMPUTE_31337, artifacts.get("MockNoxCompute").abi, issuer);

    const faceValue = 1_000_000n;
    const faceValuePublic = await mockCompute.wrapAsPublicHandle(
      ethers.zeroPadValue(ethers.toBeHex(faceValue), 32),
      TEE_UINT256,
    );
    const zero = await mockCompute.wrapAsPublicHandle(ethers.ZeroHash, TEE_UINT256);
    const faceValueHandle = await mockCompute.add(faceValuePublic, zero);

    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
    const settlementRecipient = issuer.address;
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("invoice-metadata-confidential"));
    const invoiceRef = ethers.keccak256(ethers.toUtf8Bytes("inv-conf-1"));
    const obligorHash = ethers.keccak256(ethers.toUtf8Bytes("obligor-acme-lei-123"));
    const obligorGroupHash = ethers.keccak256(ethers.toUtf8Bytes("obligor-group-acme-holdco"));
    const riskTier = 2;

    const chainId = (await ethers.provider.getNetwork()).chainId;
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
      issuer: issuer.address,
      faceValueHandle,
      dueDate,
      settlementRecipient,
      metadataHash,
      invoiceRef,
      obligorHash,
      obligorGroupHash,
      riskTier,
      validUntil,
    });
    const proof = abi.encode(["uint64", "bytes"], [validUntil, signature]);

    const tx = await invoices
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
    const receipt = await tx.wait();
    const invoiceId = receipt.logs
      .map((l) => {
        try {
          return invoices.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((d) => d && d.name === "InvoiceCreatedConfidential").args.invoiceId;

    const inv = await invoices.getInvoice(invoiceId);
    expect(inv.confidential).to.equal(true);
    expect(inv.faceValue).to.equal(0n);
    expect(inv.faceValueEncrypted).to.not.equal(ethers.ZeroHash);

    const viewerAllowedBefore = await mockCompute.isAllowed(inv.faceValueEncrypted, auditor.address);
    expect(viewerAllowedBefore).to.equal(false);
    await disclosure.discloseInvoice(await invoices.getAddress(), invoiceId, auditor.address, 1);
    const viewerAllowedAfter = await mockCompute.isAllowed(inv.faceValueEncrypted, auditor.address);
    expect(viewerAllowedAfter).to.equal(true);
  });

  it("ERC-7984 mode: confidential cashflows + confidential invoice terms", async function () {
    const [deployer, operator, investor, issuer, auditor] = await ethers.getSigners();

    const artifacts = await compile([
      "identity/IIdentityRegistry.sol",
      "identity/IdentityRegistry.sol",
      "invoice/IConfidentialInvoiceProofVerifier.sol",
      "invoice/ConfidentialEcdsaAuditorVerifier.sol",
      "invoice/InvoiceRegistry.sol",
      "servicing/ServicingRouter.sol",
      "risk/RiskManager.sol",
      "risk/RiskPolicyPack.sol",
      "disclosure/DisclosureManager.sol",
      "mocks/MockERC20.sol",
      "mocks/MockNoxCompute.sol",
      "token/WrappedMockUSDC.sol",
      "vault/ERC7984FactoringVault.sol",
    ]);

    await ethers.provider.send("hardhat_setCode", [NOX_COMPUTE_31337, artifacts.get("MockNoxCompute").deployedBytecode]);

    const identity = await deploy(artifacts, "IdentityRegistry", deployer);
    await identity.setVerified(investor.address, 1n, true);
    await identity.setVerified(issuer.address, 2n, true);
    await identity.setVerified(operator.address, 3n, true);

    const verifier = await deploy(artifacts, "ConfidentialEcdsaAuditorVerifier", deployer);
    await verifier.setAuditor(auditor.address, true);

    const invoices = await deploy(artifacts, "InvoiceRegistry", deployer, [await identity.getAddress()]);
    const servicing = await deploy(artifacts, "ServicingRouter", deployer, [await invoices.getAddress()]);
    await servicing.setDisputeWindow(0);
    await invoices.setServicer(await servicing.getAddress(), true);
    const risk = await deploy(artifacts, "RiskManager", deployer);
    await risk.setConfidentialVault(ethers.ZeroAddress);
    await risk.setServicingRouter(await servicing.getAddress());
    await risk.setPoolCapEncryptedPublic(2_000_000n);
    await risk.setIssuerCapEncryptedPublic(issuer.address, 2_000_000n);
    await risk.setInvoiceCapEncryptedPublic(1_500_000n);
    const pack = await deploy(artifacts, "RiskPolicyPack", deployer);
    await pack.setRiskManager(await risk.getAddress());
    const obligorHashKey = ethers.keccak256(ethers.toUtf8Bytes("obligor-acme-lei-123"));
    const obligorGroupHashKey = ethers.keccak256(ethers.toUtf8Bytes("obligor-group-acme-holdco"));
    await pack.setIssuerObligorCapPlain(issuer.address, obligorHashKey, 0n);
    await pack.setIssuerGroupCapPlain(issuer.address, obligorGroupHashKey, 0n);
    await pack.setTierCapPlain(2, 0n);
    await pack.setIssuerObligorCapEncryptedPublic(issuer.address, obligorHashKey, 2_000_000n);
    await pack.setIssuerGroupCapEncryptedPublic(issuer.address, obligorGroupHashKey, 2_000_000n);
    await pack.setTierCapEncryptedPublic(2, 2_000_000n);
    await risk.setPolicyPack(await pack.getAddress());
    const disclosure = await deploy(artifacts, "DisclosureManager", deployer);
    await disclosure.setAuditor(auditor.address, true);
    await disclosure.setDisclosureOfficer(deployer.address, true);
    const usdc = await deploy(artifacts, "MockERC20", deployer, ["MockUSDC", "mUSDC"]);
    const wrapper = await deploy(artifacts, "WrappedMockUSDC", deployer, [await usdc.getAddress()]);
    const vault = await deploy(artifacts, "ERC7984FactoringVault", deployer, [
      await wrapper.getAddress(),
      await identity.getAddress(),
      await invoices.getAddress(),
      operator.address,
    ]);
    await invoices.setVault(await vault.getAddress(), true);
    await vault.setServicingRouter(await servicing.getAddress());
    await vault.setRiskManager(await risk.getAddress());
    await risk.setConfidentialVault(await vault.getAddress());
    await servicing.setRiskManager(await risk.getAddress());
    await invoices.setRiskManager(await risk.getAddress());
    await risk.setInvoiceRegistry(await invoices.getAddress());

    const mockCompute = new ethers.Contract(NOX_COMPUTE_31337, artifacts.get("MockNoxCompute").abi, issuer);
    const faceValue = 1_000_000n;
    const faceValuePublic = await mockCompute.wrapAsPublicHandle(
      ethers.zeroPadValue(ethers.toBeHex(faceValue), 32),
      TEE_UINT256,
    );
    const zero = await mockCompute.wrapAsPublicHandle(ethers.ZeroHash, TEE_UINT256);
    const faceValueHandle = await mockCompute.add(faceValuePublic, zero);

    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
    const settlementRecipient = issuer.address;
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes("invoice-metadata-confidential-erc7984"));
    const invoiceRef = ethers.keccak256(ethers.toUtf8Bytes("inv-conf-erc7984-1"));
    const obligorHash = ethers.keccak256(ethers.toUtf8Bytes("obligor-acme-lei-123"));
    const obligorGroupHash = ethers.keccak256(ethers.toUtf8Bytes("obligor-group-acme-holdco"));
    const riskTier = 2;

    const chainId = (await ethers.provider.getNetwork()).chainId;
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
      issuer: issuer.address,
      faceValueHandle,
      dueDate,
      settlementRecipient,
      metadataHash,
      invoiceRef,
      obligorHash,
      obligorGroupHash,
      riskTier,
      validUntil,
    });
    const proof = abi.encode(["uint64", "bytes"], [validUntil, signature]);

    const tx = await invoices
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
    const receipt = await tx.wait();
    const invoiceId = receipt.logs
      .map((l) => {
        try {
          return invoices.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((d) => d && d.name === "InvoiceCreatedConfidential").args.invoiceId;

    await usdc.mint(investor.address, 2_000_000n);
    await usdc.connect(investor).approve(await wrapper.getAddress(), 2_000_000n);
    const minted = await wrapper.connect(investor).wrap.staticCall(investor.address, 2_000_000n);
    await wrapper.connect(investor).wrap(investor.address, 2_000_000n);
    await wrapper
      .connect(investor)
      ["confidentialTransferAndCall(address,bytes32,bytes)"](await vault.getAddress(), minted, "0x");

    const operatorCompute = new ethers.Contract(NOX_COMPUTE_31337, artifacts.get("MockNoxCompute").abi, operator);
    const fundAmount = 500_000n;
    const fundHandle = await operatorCompute.wrapAsPublicHandle(
      ethers.zeroPadValue(ethers.toBeHex(fundAmount), 32),
      TEE_UINT256,
    );
    const riskBundle = abi.encode(
      ["bytes[]"],
      [["0x01", "0x01", "0x01", "0x01", "0x01", "0x01"]],
    );
    await vault.connect(operator)["fundInvoice(uint256,bytes32,bytes,bytes)"](invoiceId, fundHandle, "0x", riskBundle);

    await invoices.connect(issuer).requestRiskTierMigration(invoiceId, 3);
    const tierBundle = abi.encode(["bytes[]"], [["0x01", "0x01"]]);
    await invoices.approveRiskTierMigration(invoiceId, tierBundle);

    const tier2HandleAfterMigration = await pack.tierOutstandingEncrypted(2);
    const tier3HandleAfterMigration = await pack.tierOutstandingEncrypted(3);
    const tier2ValAfterMigration = BigInt(
      await mockCompute.validateDecryptionProof(
        tier2HandleAfterMigration,
        ethers.zeroPadValue(ethers.toBeHex(0n), 32),
      ),
    );
    const tier3ValAfterMigration = BigInt(
      await mockCompute.validateDecryptionProof(
        tier3HandleAfterMigration,
        ethers.zeroPadValue(ethers.toBeHex(500_000n), 32),
      ),
    );
    expect(tier2ValAfterMigration).to.equal(0n);
    expect(tier3ValAfterMigration).to.equal(500_000n);

    const repayAmount = 200_000n;
    const repayHandle = await operatorCompute.wrapAsPublicHandle(
      ethers.zeroPadValue(ethers.toBeHex(repayAmount), 32),
      TEE_UINT256,
    );
    const repayTx = await wrapper
      .connect(issuer)
      ["confidentialTransferAndCall(address,bytes32,bytes)"](
        await vault.getAddress(),
        repayHandle,
        abi.encode(["uint256"], [invoiceId]),
      );
    const repayReceipt = await repayTx.wait();
    const paymentId = repayReceipt.logs
      .map((l) => {
        try {
          return servicing.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((d) => d && d.name === "PaymentReported").args.paymentId;
    await servicing.finalizePayment(invoiceId, paymentId, riskBundle);

    const tier3HandleAfterRepay = await pack.tierOutstandingEncrypted(3);
    const tier3ValAfterRepay = BigInt(
      await mockCompute.validateDecryptionProof(
        tier3HandleAfterRepay,
        ethers.zeroPadValue(ethers.toBeHex(300_000n), 32),
      ),
    );
    expect(tier3ValAfterRepay).to.equal(300_000n);

    const inv = await invoices.getInvoice(invoiceId);
    expect(inv.confidential).to.equal(true);
    expect(inv.faceValue).to.equal(0n);
    expect(inv.status).to.equal(2n);
    expect(inv.repaidAmountEncrypted).to.not.equal(ethers.ZeroHash);
    expect(inv.riskTier).to.equal(3);

    await disclosure.discloseInvestorShares(await vault.getAddress(), investor.address, auditor.address);
    const sharesHandle = await vault.sharesOf(investor.address);
    const viewerAllowedShares = await mockCompute.isAllowed(sharesHandle, auditor.address);
    expect(viewerAllowedShares).to.equal(true);
  });
});
