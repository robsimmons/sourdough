// usage: node update-branches.ts

import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const UPDATE_CHAIN: [string, string][] = [
  ["base", "express"],
  ["express", "fullstack"],
  ["fullstack", "fullstack-react"],
  ["fullstack-react", "workspaces"],
  ["fullstack-react", "main"], // nb: package-lock regeneration could result in these two diverging
];

function die(message: string) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function isPorcelain() {
  return "" === execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
}

function exactlyPackageJsonConflicts(): boolean {
  const conflicts = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], {
    encoding: "utf8",
  })
    .split("\n")
    .map((s) => s.trim())
    .filter((line) => line !== "");
  return conflicts.length === 1 && conflicts[0] === "package-lock.json";
}

function mergeIntoCurrent(from: string, into: string) {
  console.log(`\n=== Merging ${from} into ${into} ===`);

  const merge = spawnSync("git", ["merge", from, "-m", `Merge branch ${from} into ${into}`], {
    stdio: "inherit",
  });

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
}

function regeneratePackageLock() {
  console.log("Regenerating package-lock.json via npm install");
  rmSync("package-lock.json", { force: true });
  rmSync("node_modules", { recursive: true, force: true });

  // --min-release-age provides some protection against supply chain attacks
  execFileSync("npm", ["install", "--min-release-age=7"], { stdio: "inherit" });
  if (!isPorcelain()) {
    console.log("** Something changed - if it's just package-lock.json changed, we can add");
    execFileSync("git", ["add", "package-lock.json"], { stdio: "inherit" });
    execFileSync("git", ["commit", "-m", "Regenerate package-lock.json"], {
      stdio: "inherit",
    });
    if (!isPorcelain()) {
      die("Something unexpected has happened with package-lock regeneration.");
    }
  } else {
    console.log("** Nothing's changed after regenerating package-lock.json, continue");
  }

  execFileSync("npm", ["run", "check"], { stdio: "inherit" });
  execFileSync("npm", ["run", "lint"], { stdio: "inherit" });

  // Run npm outdated just to have the output go in terminal
  try {
    execFileSync("npm", ["outdated"], { stdio: "inherit" });
  } catch {
    /* non-semver out-of-date stuff will lead to an error exit */
  }
}

function main() {
  if (!isPorcelain()) {
    die("working tree not clean");
  }

  // Handle this orphan branch
  execFileSync("git", ["pull", "--ff-only"], { stdio: "inherit" });
  regeneratePackageLock();
  execFileSync("git", ["push", "origin"], { stdio: "inherit" });

  // Handle base Sourdough package
  execFileSync("git", ["checkout", "base"], { stdio: "inherit" });
  regeneratePackageLock();
  execFileSync("git", ["push", "origin", "base"], {
    stdio: "inherit",
  });

  // Handle primary Sourdough branches
  for (const [last, next] of UPDATE_CHAIN) {
    execFileSync("git", ["checkout", next], { stdio: "inherit" });
    execFileSync("git", ["pull", "--ff-only"], { stdio: "inherit" });
    mergeIntoCurrent(last, next);
    regeneratePackageLock();
    execFileSync("git", ["push", "origin", next], { stdio: "inherit" });
  }

  console.log("Complete");
  execFileSync("git", ["checkout", "scripts"], { stdio: "inherit" });
}
main();
