// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Nox, ebool, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";
import {RiskPolicyPack} from "./RiskPolicyPack.sol";

contract RiskManager is Ownable2Step {
    euint256 public poolCapEncrypted;
    mapping(address => euint256) public issuerCapEncrypted;
    euint256 public invoiceCapEncrypted;

    euint256 public poolOutstandingEncrypted;
    mapping(address => euint256) public issuerOutstandingEncrypted;

    uint256 public poolCapPlain;
    mapping(address => uint256) public issuerCapPlain;
    uint256 public invoiceCapPlain;

    uint256 public poolOutstandingPlain;
    mapping(address => uint256) public issuerOutstandingPlain;

    address public confidentialVault;
    address public plainVault;
    address public servicingRouter;
    RiskPolicyPack public policyPack;

    event ConfidentialVaultUpdated(address indexed vault);
    event PlainVaultUpdated(address indexed vault);
    event ServicingRouterUpdated(address indexed router);
    event PolicyPackUpdated(address indexed policyPack);

    event PoolCapPlainUpdated(uint256 cap);
    event IssuerCapPlainUpdated(address indexed issuer, uint256 cap);
    event InvoiceCapPlainUpdated(uint256 cap);

    event PoolCapEncryptedUpdated(bytes32 capHandle);
    event IssuerCapEncryptedUpdated(address indexed issuer, bytes32 capHandle);
    event InvoiceCapEncryptedUpdated(bytes32 capHandle);

    event PlainFundingConsumed(address indexed issuer, uint256 amount, uint256 newIssuerOutstanding, uint256 newPoolOutstanding);
    event PlainRepaymentRecorded(address indexed issuer, uint256 amount, uint256 newIssuerOutstanding, uint256 newPoolOutstanding);

    event EncryptedFundingCommitted(address indexed issuer, bytes32 amountHandle, bytes32 newIssuerOutstanding, bytes32 newPoolOutstanding);
    event EncryptedRepaymentCommitted(address indexed issuer, bytes32 amountHandle, bytes32 newIssuerOutstanding, bytes32 newPoolOutstanding);

    error Unauthorized(address sender);
    error RiskLimitExceeded();

    constructor() Ownable(msg.sender) {
        poolCapEncrypted = euint256.wrap(bytes32(0));
        invoiceCapEncrypted = euint256.wrap(bytes32(0));
        poolOutstandingEncrypted = euint256.wrap(bytes32(0));
        Nox.allowThis(poolCapEncrypted);
        Nox.allowThis(invoiceCapEncrypted);
        Nox.allowThis(poolOutstandingEncrypted);
        Nox.allow(poolCapEncrypted, owner());
        Nox.allow(invoiceCapEncrypted, owner());
        Nox.allow(poolOutstandingEncrypted, owner());
    }

    function setConfidentialVault(address vault) external onlyOwner {
        confidentialVault = vault;
        emit ConfidentialVaultUpdated(vault);
    }

    function setPlainVault(address vault) external onlyOwner {
        plainVault = vault;
        emit PlainVaultUpdated(vault);
    }

    function setServicingRouter(address router) external onlyOwner {
        servicingRouter = router;
        emit ServicingRouterUpdated(router);
    }

    function setPolicyPack(RiskPolicyPack newPolicyPack) external onlyOwner {
        policyPack = newPolicyPack;
        emit PolicyPackUpdated(address(newPolicyPack));
    }

    function setPoolCapPlain(uint256 cap) external onlyOwner {
        poolCapPlain = cap;
        emit PoolCapPlainUpdated(cap);
    }

    function setIssuerCapPlain(address issuer, uint256 cap) external onlyOwner {
        issuerCapPlain[issuer] = cap;
        emit IssuerCapPlainUpdated(issuer, cap);
    }

    function setInvoiceCapPlain(uint256 cap) external onlyOwner {
        invoiceCapPlain = cap;
        emit InvoiceCapPlainUpdated(cap);
    }

    function setPoolCapEncryptedPublic(uint256 cap) external onlyOwner {
        poolCapEncrypted = Nox.toEuint256(cap);
        Nox.allowThis(poolCapEncrypted);
        Nox.allow(poolCapEncrypted, owner());
        emit PoolCapEncryptedUpdated(euint256.unwrap(poolCapEncrypted));
    }

    function setInvoiceCapEncryptedPublic(uint256 cap) external onlyOwner {
        invoiceCapEncrypted = Nox.toEuint256(cap);
        Nox.allowThis(invoiceCapEncrypted);
        Nox.allow(invoiceCapEncrypted, owner());
        emit InvoiceCapEncryptedUpdated(euint256.unwrap(invoiceCapEncrypted));
    }

    function setIssuerCapEncryptedPublic(address issuer, uint256 cap) external onlyOwner {
        issuerCapEncrypted[issuer] = Nox.toEuint256(cap);
        Nox.allowThis(issuerCapEncrypted[issuer]);
        Nox.allow(issuerCapEncrypted[issuer], owner());
        emit IssuerCapEncryptedUpdated(issuer, euint256.unwrap(issuerCapEncrypted[issuer]));
    }

    function setPoolCapEncrypted(externalEuint256 capHandle, bytes calldata proof) external onlyOwner {
        poolCapEncrypted = Nox.fromExternal(capHandle, proof);
        Nox.allowThis(poolCapEncrypted);
        Nox.allow(poolCapEncrypted, owner());
        emit PoolCapEncryptedUpdated(euint256.unwrap(poolCapEncrypted));
    }

    function setInvoiceCapEncrypted(externalEuint256 capHandle, bytes calldata proof) external onlyOwner {
        invoiceCapEncrypted = Nox.fromExternal(capHandle, proof);
        Nox.allowThis(invoiceCapEncrypted);
        Nox.allow(invoiceCapEncrypted, owner());
        emit InvoiceCapEncryptedUpdated(euint256.unwrap(invoiceCapEncrypted));
    }

    function setIssuerCapEncrypted(
        address issuer,
        externalEuint256 capHandle,
        bytes calldata proof
    ) external onlyOwner {
        issuerCapEncrypted[issuer] = Nox.fromExternal(capHandle, proof);
        Nox.allowThis(issuerCapEncrypted[issuer]);
        Nox.allow(issuerCapEncrypted[issuer], owner());
        emit IssuerCapEncryptedUpdated(issuer, euint256.unwrap(issuerCapEncrypted[issuer]));
    }

    function consumePlainFunding(address issuer, uint256 amount) public {
        if (msg.sender != plainVault) revert Unauthorized(msg.sender);
        if (amount == 0) revert RiskLimitExceeded();
        if (invoiceCapPlain != 0 && amount > invoiceCapPlain) revert RiskLimitExceeded();
        if (poolCapPlain != 0 && poolOutstandingPlain + amount > poolCapPlain) revert RiskLimitExceeded();
        uint256 issuerCap = issuerCapPlain[issuer];
        if (issuerCap != 0 && issuerOutstandingPlain[issuer] + amount > issuerCap) revert RiskLimitExceeded();

        issuerOutstandingPlain[issuer] += amount;
        poolOutstandingPlain += amount;
        emit PlainFundingConsumed(issuer, amount, issuerOutstandingPlain[issuer], poolOutstandingPlain);
    }

    function consumePlainFunding(address issuer, bytes32 obligorHash, uint8 riskTier, uint256 amount) external {
        consumePlainFunding(issuer, amount);
        RiskPolicyPack pack = policyPack;
        if (address(pack) != address(0)) {
            pack.consumePlainFunding(issuer, obligorHash, riskTier, amount);
        }
    }

    function recordPlainRepayment(address issuer, uint256 amount) public {
        if (msg.sender != plainVault) revert Unauthorized(msg.sender);
        if (amount == 0) revert RiskLimitExceeded();

        uint256 issuerOut = issuerOutstandingPlain[issuer];
        uint256 poolOut = poolOutstandingPlain;

        issuerOutstandingPlain[issuer] = amount >= issuerOut ? 0 : issuerOut - amount;
        poolOutstandingPlain = amount >= poolOut ? 0 : poolOut - amount;

        emit PlainRepaymentRecorded(issuer, amount, issuerOutstandingPlain[issuer], poolOutstandingPlain);
    }

    function recordPlainRepayment(address issuer, bytes32 obligorHash, uint8 riskTier, uint256 amount) external {
        recordPlainRepayment(issuer, amount);
        RiskPolicyPack pack = policyPack;
        if (address(pack) != address(0)) {
            pack.recordPlainRepayment(issuer, obligorHash, riskTier, amount);
        }
    }

    function checkConfidentialFunding(
        address issuer,
        euint256 amount
    )
        external
        returns (
            ebool issuerOk,
            ebool poolOk,
            ebool invoiceOk,
            euint256 newIssuerOutstanding,
            euint256 newPoolOutstanding
        )
    {
        if (msg.sender != confidentialVault) revert Unauthorized(msg.sender);
        return _checkConfidentialFunding(issuer, amount);
    }

    function verifyConfidentialFunding(
        address issuer,
        bytes32 obligorHash,
        uint8 riskTier,
        euint256 amount,
        bytes calldata proofsBundle
    ) external returns (euint256 newIssuerOutstanding, euint256 newPoolOutstanding) {
        if (msg.sender != confidentialVault) revert Unauthorized(msg.sender);

        bytes[] memory proofs = abi.decode(proofsBundle, (bytes[]));
        require(proofs.length == 5);
        (ebool issuerOk, ebool poolOk, ebool invoiceOk, euint256 issuerOut, euint256 poolOut) = _checkConfidentialFunding(
            issuer,
            amount
        );
        require(_publicDecryptBool(issuerOk, proofs[0]));
        require(_publicDecryptBool(poolOk, proofs[1]));
        require(_publicDecryptBool(invoiceOk, proofs[2]));

        if (address(policyPack) != address(0)) {
            policyPack.enforceAndCommitConfidentialFunding(
                issuer,
                obligorHash,
                riskTier,
                amount,
                abi.encode(proofs[3], proofs[4])
            );
        }
        return (issuerOut, poolOut);
    }

    function _publicDecryptBool(ebool handle, bytes memory decryptionProof) private view returns (bool) {
        bytes memory result = INoxCompute(Nox.noxComputeContract()).validateDecryptionProof(
            ebool.unwrap(handle),
            decryptionProof
        );
        require(result.length == 1);
        require(result[0] == 0x00 || result[0] == 0x01);
        return result[0] != 0x00;
    }

    function _checkConfidentialFunding(
        address issuer,
        euint256 amount
    )
        private
        returns (
            ebool issuerOk,
            ebool poolOk,
            ebool invoiceOk,
            euint256 newIssuerOutstanding,
            euint256 newPoolOutstanding
        )
    {
        euint256 issuerOut = issuerOutstandingEncrypted[issuer];
        newIssuerOutstanding = Nox.add(issuerOut, amount);
        newPoolOutstanding = Nox.add(poolOutstandingEncrypted, amount);

        euint256 issuerCap = issuerCapEncrypted[issuer];
        issuerOk = Nox.le(newIssuerOutstanding, issuerCap);
        poolOk = Nox.le(newPoolOutstanding, poolCapEncrypted);
        invoiceOk = Nox.le(amount, invoiceCapEncrypted);

        Nox.allowPublicDecryption(issuerOk);
        Nox.allowPublicDecryption(poolOk);
        Nox.allowPublicDecryption(invoiceOk);

        Nox.allowThis(newIssuerOutstanding);
        Nox.allowThis(newPoolOutstanding);
        Nox.allow(newIssuerOutstanding, confidentialVault);
        Nox.allow(newPoolOutstanding, confidentialVault);

        Nox.allowThis(issuerOk);
        Nox.allowThis(poolOk);
        Nox.allowThis(invoiceOk);
        Nox.allow(issuerOk, confidentialVault);
        Nox.allow(poolOk, confidentialVault);
        Nox.allow(invoiceOk, confidentialVault);
    }

    function commitConfidentialFunding(
        address issuer,
        euint256 amount,
        euint256 newIssuerOutstanding,
        euint256 newPoolOutstanding
    ) external {
        if (msg.sender != confidentialVault) revert Unauthorized(msg.sender);

        issuerOutstandingEncrypted[issuer] = newIssuerOutstanding;
        poolOutstandingEncrypted = newPoolOutstanding;

        Nox.allowThis(newIssuerOutstanding);
        Nox.allowThis(newPoolOutstanding);
        Nox.allow(newIssuerOutstanding, owner());
        Nox.allow(newPoolOutstanding, owner());
        Nox.allow(newIssuerOutstanding, confidentialVault);
        Nox.allow(newPoolOutstanding, confidentialVault);

        emit EncryptedFundingCommitted(
            issuer,
            euint256.unwrap(amount),
            euint256.unwrap(newIssuerOutstanding),
            euint256.unwrap(newPoolOutstanding)
        );
    }

    function commitConfidentialRepayment(address issuer, bytes32 obligorHash, uint8 riskTier, euint256 amount) external {
        if (msg.sender != servicingRouter) revert Unauthorized(msg.sender);

        euint256 issuerOut = issuerOutstandingEncrypted[issuer];
        euint256 poolOut = poolOutstandingEncrypted;

        euint256 newIssuerOutstanding = Nox.sub(issuerOut, amount);
        euint256 newPoolOutstanding = Nox.sub(poolOut, amount);

        issuerOutstandingEncrypted[issuer] = newIssuerOutstanding;
        poolOutstandingEncrypted = newPoolOutstanding;

        Nox.allowThis(newIssuerOutstanding);
        Nox.allowThis(newPoolOutstanding);
        Nox.allow(newIssuerOutstanding, owner());
        Nox.allow(newPoolOutstanding, owner());

        emit EncryptedRepaymentCommitted(
            issuer,
            euint256.unwrap(amount),
            euint256.unwrap(newIssuerOutstanding),
            euint256.unwrap(newPoolOutstanding)
        );

        RiskPolicyPack pack = policyPack;
        if (address(pack) != address(0)) {
            pack.commitConfidentialRepayment(issuer, obligorHash, riskTier, amount);
        }
    }
}
