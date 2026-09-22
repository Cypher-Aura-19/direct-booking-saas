import { config as loadDotenv } from "dotenv";
import path from "node:path";

// Vitest (unlike `next dev`/`next build`) does not load .env.local on its
// own. @next/env — Next's own loader — was tried first, but it deliberately
// skips .env.local whenever NODE_ENV=test (Next's convention routes test
// envs through .env.test.local instead), and Vitest always sets
// NODE_ENV=test. A plain dotenv load has no such filtering, so it's what
// actually makes the NEXT_PUBLIC_* vars in web/.env.local available to
// every test file.
//
// Resolved against process.cwd() (vitest's root, this file's own directory)
// rather than import.meta.url: under the jsdom test environment, jsdom's
// polyfilled URL global makes `new URL("./x", import.meta.url)` throw
// ("must be of scheme file"), which only surfaces here because this file is
// the one setup file shared by both the node- and jsdom-environment suites.
loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

import "@testing-library/jest-dom/vitest";
