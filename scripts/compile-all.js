import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import solc from "solc";

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.isFile() && p.endsWith(".sol")) files.push(p);
  }
  return files;
}

function tryReadSync(abs) {
  try {
    return { contents: fsSync.readFileSync(abs, "utf8") };
  } catch {
    return null;
  }
}

async function main() {
  const root = process.cwd();
  const contractsRoot = path.join(root, "contracts");
  const files = await walk(contractsRoot);

  const sources = {};
  for (const abs of files) {
    const key = path.relative(contractsRoot, abs).replaceAll("\\", "/");
    sources[key] = { content: await fs.readFile(abs, "utf8") };
  }

  const localBases = [
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
  ];

  const nodeModules = path.join(root, "node_modules");
  const noxProtocolRoot = path.join(nodeModules, "@iexec-nox", "nox-protocol-contracts", "contracts");
  const noxProtocolBases = [
    noxProtocolRoot,
    path.join(noxProtocolRoot, "sdk"),
    path.join(noxProtocolRoot, "shared"),
    path.join(noxProtocolRoot, "interfaces"),
    path.join(noxProtocolRoot, "libraries"),
  ];

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

    const candidates = [...localBases, ...noxProtocolBases].map((base) => path.resolve(base, importPath));
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
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
  const errors = output.errors ?? [];
  const fatal = errors.filter((e) => e.severity === "error");
  if (fatal.length) {
    process.stderr.write(fatal.map((e) => e.formattedMessage).join("\n"));
    process.exit(1);
  }
  process.stdout.write(`Compiled ${Object.keys(output.contracts ?? {}).length} source files\n`);
}

await main();
