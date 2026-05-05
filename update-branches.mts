import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const UPDATE_CHAIN: [string, string][] = [
  ["base", "express"],
  ["express", "fullstack"],
  ["fullstack", "fullstack-react"],
  ["fullstack-react", "main"],
];

function die(message: string) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function isPorcelain() {
  return (
    "" ==
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
  );
}

function exactlyPackageJsonConflicts(): boolean {
  const conflicts = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=U"],
    {
      encoding: "utf8",
    },
  )
    .split("\n")
    .map((s) => s.trim())
    .filter((line) => line !== "");
  return conflicts.length === 1 && conflicts[0] === "package-lock.json";
}

function mergeIntoCurrent(from: string, into: string) {
  console.log(`\n=== Merging ${from} into ${into} ===`);

  const merge = spawnSync(
    "git",
    ["merge", from, "-m", `Merge branch ${from} into ${into}`],
    { stdio: "inherit" },
  );

  if (merge.status !== 0) {
    // Only acceptable failure is conflicts that are exclusively package-lock.json
    if (!exactlyPackageJsonConflicts()) {
      die(`git merge failed`);
    }

    // Resolve lockfile conflict with our version
    execFileSync("git", ["checkout", "--ours", "package-lock.json"], {
      stdio: "inherit",
    });
    execFileSync("git", ["add", "package-lock.json"], { stdio: "inherit" });
    execFileSync("git", ["commit", "--no-edit"], { stdio: "inherit" });
  }

  console.log("Regenerating package-lock.json via npm install");
  rmSync("package-lock.json");
  rmSync("node_modules", { recursive: true, force: true });
  execFileSync("npm", ["install"], { stdio: "inherit" });
  if (!isPorcelain()) {
    execFileSync("git", ["add", "package-lock.json"], { stdio: "inherit" });
    if (!isPorcelain()) {
      die("Some non-package-lock.json artifact remains after merge.");
    }
    execFileSync("git", ["commit", "-m", "Regenerate package-lock.json"], {
      stdio: "inherit",
    });
  }
}

function main() {
  if (!isPorcelain()) {
    die("working tree not clean");
  }

  for (const [last, next] of UPDATE_CHAIN) {
    execFileSync("git", ["checkout", next], { stdio: "inherit" });
    mergeIntoCurrent(last, next);
    execFileSync("git", ["push", "origin", next], { stdio: "inherit" });
  }

  console.log("Complete");
}
main();
