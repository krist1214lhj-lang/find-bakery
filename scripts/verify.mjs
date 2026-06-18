import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error("[verify] npm CLI path is unavailable");
  process.exit(1);
}

verifyDocumentationReferences();

const checks = [
  ["local environment contract", ["run", "verify:env"]],
  ["database schema contract", ["run", "verify:schema"]],
  ["lint", ["run", "lint"]],
  ["typecheck", ["run", "typecheck"]],
  ["unit tests", ["test"]],
  ["production build", ["run", "build"]],
];

for (const [label, args] of checks) {
  console.log(`\n[verify] ${label}`);
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    if (result.error) {
      console.error(result.error.message);
    }
    console.error(`\n[verify] failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[verify] all checks passed");

function verifyDocumentationReferences() {
  console.log("[verify] documentation references");
  const markdownFiles = [
    join(root, "AGENTS.md"),
    ...findMarkdownFiles(join(root, "docs")),
  ];
  const missing = [];
  const pattern = /`(docs\/[^`]+\.md)`/g;

  for (const file of markdownFiles) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(pattern)) {
      const referencedPath = join(root, match[1]);
      if (!existsSync(referencedPath)) {
        missing.push(
          `${relative(root, file)} -> ${relative(root, referencedPath)}`,
        );
      }
    }
  }

  if (missing.length > 0) {
    console.error("Missing documentation references:");
    for (const item of missing) {
      console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log("[verify] documentation references passed");
}

function findMarkdownFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return findMarkdownFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}
