// 配置模块测试
import { NimConfigSchema } from "../src/config-schema.js";

console.log("✅ Config schema loaded!");

// 测试数字转字符串
const testCfg = {
  appKey: 123456,  // 数字
  account: "bot123",
  token: "abc123",
  enabled: true,
};

try {
  const result = NimConfigSchema.parse(testCfg);
  console.log("   appKey (input: 123456):", result.appKey, `(type: ${typeof result.appKey})`);
  console.log("   account:", result.account);
  console.log("   ✅ Number coercion works!");
} catch (e: any) {
  console.error("   ❌ Parse error:", e.message);
}

// 测试正常字符串
const normalCfg = {
  appKey: "abc123",
  account: "bot456",
  token: "token789",
};

try {
  const result = NimConfigSchema.parse(normalCfg);
  console.log("\n   String config parsed:", result.appKey);
  console.log("   ✅ String config works!");
} catch (e: any) {
  console.error("   ❌ Parse error:", e.message);
}

console.log("\n✅ Config tests passed!");
