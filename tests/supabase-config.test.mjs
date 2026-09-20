import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const configPath = fileURLToPath(new URL("../supabase/config.toml", import.meta.url));

// @req FOUND-04
test("local supabase config declares the api, db and studio services", () => {
  const config = readFileSync(configPath, "utf8");
  assert.match(config, /\[api\]/, "expected an [api] section");
  assert.match(config, /\[db\]/, "expected a [db] section");
  assert.match(config, /\[studio\]/, "expected a [studio] section");
  assert.match(config, /port = 55322/, "expected the default database port");
});

// @req FOUND-04
test("local supabase config avoids the stock ports, which another stack owns", () => {
  const config = readFileSync(configPath, "utf8");
  const stockPorts = config.match(/^\s*(?:shadow_)?port = 543\d\d/gm) ?? [];
  assert.deepEqual(
    stockPorts,
    [],
    `config still uses stock 543xx ports: ${stockPorts.join(", ")}`,
  );
});
