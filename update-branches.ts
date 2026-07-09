// usage: node update-branches.ts

import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const UPDATE_CHAIN: [[string, string], ...[string, string][]] = [
  ["base", "express"],
  ["express", "fullstack"],
  ["fullstack", "fullstack-react"],
  ["fullstack-react", "workspaces"],
  ["fullstack-react", "main"], // nb: package-lock regeneration could result in these two diverging
];

function execWithLog(
  file: string,
  args: readonly string[],
  options?: { stdio?: "inherit"; encoding?: "utf8" },
) {
  if (process.env["VERBOSE"]) {
    console.log(`% ${file} ${args.map((arg) => JSON.stringify(arg)).join(" ")}`);
  }
  return String(execFileSync(file, args, options));
}

function die(message: string) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function isPorcelain() {
  return "" === execWithLog("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
}

function exactlyPackageJsonConflicts(): boolean {
  const conflicts = execWithLog("git", ["diff", "--name-only", "--diff-filter=U"], {
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
    execWithLog("git", ["checkout", "--ours", "package-lock.json"], {
      stdio: "inherit",
    });
    execWithLog("git", ["add", "package-lock.json"]);
    execWithLog("git", ["commit", "--no-edit"], { stdio: "inherit" });
  }
}

function regeneratePackageLock() {
  console.log("Regenerating package-lock.json via npm install");
  rmSync("package-lock.json", { force: true });
  rmSync("node_modules", { recursive: true, force: true });

  // --min-release-age provides some protection against supply chain attacks
  execWithLog("npm", ["install", "--min-release-age=5"], { stdio: "inherit" });
  if (!isPorcelain()) {
    console.log("** Something changed - if it's just package-lock.json changed, we can add");
    execWithLog("git", ["add", "package-lock.json"], { stdio: "inherit" });
    execWithLog("git", ["commit", "-m", "Regenerate package-lock.json"], {
      stdio: "inherit",
    });
    if (!isPorcelain()) {
      die("Something unexpected has happened with package-lock regeneration.");
    }
  } else {
    console.log("** Nothing's changed after regenerating package-lock.json, continue");
  }

  execWithLog("npm", ["run", "check"], { stdio: "inherit" });
  execWithLog("npm", ["run", "lint"], { stdio: "inherit" });

  // Run npm outdated just to have the output go in terminal
  try {
    execWithLog("npm", ["outdated"], { stdio: "inherit" });
  } catch {
    /* non-semver out-of-date stuff will lead to an error exit */
  }
}

function main() {
  if (!isPorcelain()) {
    die("working tree not clean");
  }

  // Handle this orphan branch
  execWithLog("git", ["pull", "--ff-only"], { stdio: "inherit" });
  regeneratePackageLock();
  execWithLog("git", ["push", "origin"], { stdio: "inherit" });

  // Handle base Sourdough package
  execWithLog("git", ["checkout", UPDATE_CHAIN[0][0]], { stdio: "inherit" });
  regeneratePackageLock();
  execWithLog("git", ["push", "origin", UPDATE_CHAIN[0][0]], {
    stdio: "inherit",
  });

  // Handle primary Sourdough branches
  for (const [last, next] of UPDATE_CHAIN) {
    execWithLog("git", ["checkout", next], { stdio: "inherit" });
    execWithLog("git", ["pull", "--ff-only"], { stdio: "inherit" });
    mergeIntoCurrent(last, next);
    regeneratePackageLock();
    execWithLog("git", ["push", "origin", next], { stdio: "inherit" });
  }

  console.log("Complete");
  execWithLog("git", ["checkout", "scripts"], { stdio: "inherit" });
}
main();
