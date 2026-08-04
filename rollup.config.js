import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";

const staticFileFolders = ["lang", "packs", "templates"];

// foundry-vtt-types is pinned to 13.346.0-beta (matching upstream), but tsconfig sets
// `moduleResolution: "node"`, which cannot read that package's `exports` map or its
// `.d.mts` entrypoint. The types therefore load only partially and
// @rollup/plugin-typescript emits a large, benign set of diagnostics (mostly "property
// does not exist" on game/foundry globals). Suppress only these known noise codes so the
// build log is usable; ANY other TS code (e.g. a real new type error) still surfaces.
// `npm run typecheck` (tsc --noEmit) remains the full, unfiltered type gate.
//
// The real fix is `moduleResolution: "bundler"`, which halves the TS2339 count, but it
// surfaces ~1750 genuine strictness errors (strict + noUncheckedIndexedAccess) and so
// needs its own effort. Upstream shares this tsconfig, so it belongs there too.
const SUPPRESSED_TS_CODES = new Set([
  "TS2304", "TS2314", "TS2315", "TS2322", "TS2339", "TS2345", "TS2353",
  "TS2445", "TS2488", "TS2531", "TS2532", "TS2538", "TS2551", "TS2554",
  "TS2559", "TS2571", "TS2578", "TS2683", "TS2694", "TS2722", "TS2739",
  "TS2769", "TS6133", "TS7006", "TS7008", "TS7019", "TS7030", "TS7053",
  "TS18046", "TS18047", "TS18048",
]);

export default {
  input: "src/ose.js",
  output: {
    file: "dist/ose.js",
    format: "es",
    sourcemap: true,
  },
  onwarn(warning, defaultHandler) {
    if (warning.plugin === "typescript" && SUPPRESSED_TS_CODES.has(warning.pluginCode)) {
      return;
    }
    defaultHandler(warning);
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      compilerOptions: {
        outDir: "dist",
      },
    }),
    copy({
      targets: staticFileFolders.map((folderName) => ({
        src: `src/${folderName}`,
        dest: "dist",
      })),
    }),
  ],
};
