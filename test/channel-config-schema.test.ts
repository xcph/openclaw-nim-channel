import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const channelSource = fs.readFileSync(path.join(repoRoot, "src/channel.ts"), "utf8");
const configSchemaSource = fs.readFileSync(path.join(repoRoot, "src/config-schema.ts"), "utf8");

test("channel.ts reuses config schema exports instead of inlining schema", () => {
  assert.match(
    channelSource,
    /import\s*\{\s*nimChannelConfigJsonSchema,\s*nimChannelConfigUiHints,\s*\}\s*from "\.\/config-schema\.js";/,
  );
  assert.match(channelSource, /schema:\s*nimChannelConfigJsonSchema,/);
  assert.match(channelSource, /uiHints:\s*nimChannelConfigUiHints,/);
  assert.doesNotMatch(channelSource, /configSchema:\s*\{\s*schema:\s*\{\s*type:\s*"object"/s);
});

test("config-schema.ts declares anti-spam and legacy login in shared schema source", () => {
  assert.match(configSchemaSource, /antispamEnabled:\s*\{\s*type:\s*"boolean"\s*\}/);
  assert.match(configSchemaSource, /legacyLogin:\s*\{\s*type:\s*"boolean"\s*\}/);
  assert.match(configSchemaSource, /antispamEnabled:\s*\{\s*label:\s*"Anti-spam Protection"/);
  assert.match(configSchemaSource, /"advanced\.legacyLogin":\s*\{\s*label:\s*"Legacy Login Mode"/);
});
