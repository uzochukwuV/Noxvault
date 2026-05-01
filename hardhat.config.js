import "@nomicfoundation/hardhat-ethers";

export default {
  solidity: {
    version: "0.8.28",
    path: "./node_modules/solc/soljson.js",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
