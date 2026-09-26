// Node module-customization hook used only by scripts/eval-chat.mjs (see the
// top comment there for why this exists instead of tsx / --experimental-
// strip-types). Registered with node:module `register()`.
//
// It does two things a bundler normally does for us:
//   1. Resolves extensionless relative specifiers (e.g. "./context", the
//      style every web/lib/**/*.ts file in this repo uses) to the sibling
//      .ts/.tsx file, since Node's own ESM resolver requires an explicit
//      extension and does not guess.
//   2. Strips TypeScript syntax with the `typescript` package's
//      transpileModule (already a devDependency under web/node_modules —
//      no new dependency is added), and stubs the `"server-only"` import to
//      an empty module. A real Next build aliases "server-only" away on the
//      server side via webpack; run outside a bundler it would otherwise
//      throw its client-guard error unconditionally.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const webDir = path.resolve(import.meta.dirname, "..", "web");
const ts = require(path.join(webDir, "node_modules", "typescript", "lib", "typescript.js"));

const SERVER_ONLY_STUB = "eval-chat-stub:server-only";
const TS_EXTENSIONS = [".ts", ".tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: SERVER_ONLY_STUB, shortCircuit: true };
  }
  if (specifier.startsWith(".") && context.parentURL) {
    const parentPath = fileURLToPath(context.parentURL);
    const base = path.resolve(path.dirname(parentPath), specifier);
    for (const ext of TS_EXTENSIONS) {
      if (existsSync(base + ext)) {
        return { url: pathToFileURL(base + ext).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === SERVER_ONLY_STUB) {
    return { format: "module", source: "export {};", shortCircuit: true };
  }
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const filePath = fileURLToPath(url);
    const source = await readFile(filePath, "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: filePath,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
