const fs = require("fs-extra");
const path = require("path");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

/**
 * @typedef {{dataPath: Array<string>; symLinkName: string;}} FoundryConfig
 */

const argv = yargs(hideBin(process.argv))
  .option("clean", {
    alias: "c",
    type: "boolean",
    default: false,
  })
  .parseSync();

/**
 * @type {FoundryConfig}
 */
const foundryConfig = fs.readJSONSync(
  path.resolve(__dirname, "..", "foundryconfig.json")
);

function createSymlink() {
  foundryConfig.dataPath.forEach((dataPath) => {
     const linkDirectory = path.resolve(
      dataPath,
      "Data",
      "systems",
      foundryConfig.symLinkName
    );
    
    console.log(`Linking dist to ${linkDirectory}.`);
    const systemsDirectory = path.resolve(linkDirectory, "..");
    if (!fs.pathExistsSync(systemsDirectory)) {
      throw new Error(
        `Link directory parent folder "${systemsDirectory}" not found.`
      );
    }

    if (!fs.existsSync(linkDirectory)) {
      // link path doesn't exist, create it.
      const symType = process.platform === "win32" ? "junction" : "dir";
      fs.symlinkSync(path.resolve(__dirname, ".."), linkDirectory, symType);
    }
  });

  console.log(`Linking foundry files to ${path.join("foundry")}.`);
  let fileRoot = "";
  // As of 13.338, the Node install is *not* nested but electron installs *are*
  const nested = fs.existsSync(path.join(foundryConfig.installPath, "resources", "app"));

  if (nested) fileRoot = path.join(foundryConfig.installPath, "resources", "app");
  else fileRoot = foundryConfig.installPath;

  try {
    fs.mkdirSync("foundry");
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }

  // Javascript files
  for (const p of ["client", "common", "tsconfig.json"]) {
    try {
      const targetPath = path.join(fileRoot, p);
      const isDir = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
      const symType = process.platform === "win32" ? (isDir ? "junction" : "file") : undefined;
      fs.symlinkSync(targetPath, path.join("foundry", p), symType);
    } catch (e) {
      if (e.code === "EPERM" && process.platform === "win32") {
        try {
          fs.copyFileSync(path.join(fileRoot, p), path.join("foundry", p));
        } catch (copyErr) {
          if (copyErr.code !== "EEXIST") throw copyErr;
        }
      } else if (e.code !== "EEXIST") {
        throw e;
      }
    }
  }

  // Language files
  try {
    const targetPath = path.join(fileRoot, "public", "lang");
    const symType = process.platform === "win32" ? "junction" : "dir";
    fs.symlinkSync(targetPath, path.join("foundry", "lang"), symType);
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
}

function removeSymlink() {
  foundryConfig.dataPath.forEach((dataPath) => {
    const linkDirectory = path.resolve(
      dataPath,
      "Data",
      "systems",
      foundryConfig.symLinkName
    );
    console.log(`Removing build in ${linkDirectory}.`);
    fs.removeSync(linkDirectory);
  });

  console.log(`Removing foundry files in ${path.join("foundry")}.`);
  // Check if the foundry directory exists and is a directory
  if (fs.existsSync("foundry") && fs.lstatSync("foundry").isDirectory()) {
    // Remove the foundry directory
    fs.removeSync("foundry");
  }
}

if (argv.clean) {
  removeSymlink();
} else {
  createSymlink();
}
