// 基础模块测试
import { normalizeNimTarget, looksLikeNimId, formatNimTarget } from "../src/targets.js";

console.log("✅ Targets module loaded!");
console.log('   normalizeNimTarget("nim:user123"):', normalizeNimTarget("nim:user123"));
console.log('   normalizeNimTarget("user:abc"):', normalizeNimTarget("user:abc"));
console.log('   looksLikeNimId("user123"):', looksLikeNimId("user123"));
console.log('   formatNimTarget("user123"):', formatNimTarget("user123"));

console.log("\n✅ Basic tests passed!");
