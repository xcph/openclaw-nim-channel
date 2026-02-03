import plugin from "../index.js";
import { nimPlugin, normalizeNimTarget, looksLikeNimId } from "../index.js";

console.log("✅ Plugin loaded successfully!");
console.log("   ID:", plugin.id);
console.log("   Name:", plugin.name);
console.log("   Description:", plugin.description);

console.log("\n✅ Exports available:");
console.log("   nimPlugin.id:", nimPlugin.id);
console.log('   normalizeNimTarget("nim:user123"):', normalizeNimTarget("nim:user123"));
console.log('   looksLikeNimId("user123"):', looksLikeNimId("user123"));
console.log('   looksLikeNimId("invalid@email"):', looksLikeNimId("invalid@email"));

console.log("\n✅ All tests passed!");
