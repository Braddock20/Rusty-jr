import fs from "node:fs";

const file = "src/providers/eadriatic.ts";
let source = fs.readFileSync(file, "utf8");

const oldRegex = String.raw`/HTTP\\s+\d+\s*:\s*([\\s\\S]*)/i`;
const newRegex = String.raw`/HTTP\s+\d+\s*:\s*([\s\S]*)/i`;

if (!source.includes(oldRegex)) {
  console.error("STOP: Expected old retry regex not found. No change made.");
  process.exit(1);
}

source = source.replace(oldRegex, newRegex);
fs.writeFileSync(file, source);

const indexFile = "src/index.ts";
let index = fs.readFileSync(indexFile, "utf8");

const oldHealth =
  "eadriatic: { ok: eadriatic.ok, count: eadriatic.data.length, error: eadriatic.error ?? null },";

const newHealth =
  "eadriatic: { ok: eadriatic.ok, count: eadriatic.data.length, error: eadriatic.error ?? null, meta: eadriatic.meta ?? null },";

if (!index.includes(oldHealth)) {
  console.error("STOP: Expected eAdriatic health entry not found.");
  process.exit(1);
}

index = index.replace(oldHealth, newHealth);
fs.writeFileSync(indexFile, index);

console.log("Both patches applied.");
