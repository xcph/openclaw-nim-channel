/**
 * NIM 插件手动测试脚本
 * 
 * 运行: npx tsx test/manual-test.ts
 */

import { createNimClient } from "../src/client.js";

async function main() {
  console.log("🚀 Starting NIM client test...");

  // 从环境变量读取配置
  const config = {
    appKey: process.env.NIM_APP_KEY || "",
    account: process.env.NIM_ACCOUNT || "",
    token: process.env.NIM_TOKEN || "",
  };

  if (!config.appKey || !config.account || !config.token) {
    console.error("❌ Missing NIM credentials. Please set:");
    console.error("   NIM_APP_KEY, NIM_ACCOUNT, NIM_TOKEN");
    console.error("");
    console.error("Example:");
    console.error('   NIM_APP_KEY=xxx NIM_ACCOUNT=bot1 NIM_TOKEN=xxx npx tsx test/manual-test.ts');
    process.exit(1);
  }

  try {
    // 创建客户端
    console.log("📡 Creating NIM client...");
    const client = await createNimClient(config);

    // 注册消息回调
    client.onMessage((msg) => {
      console.log("📨 Received message:", {
        from: msg.from,
        to: msg.to,
        type: msg.type,
        text: msg.text,
        sessionType: msg.sessionType,
      });
    });

    // 注册连接状态回调
    client.onConnectionChange((state) => {
      console.log("🔗 Connection state:", state);
    });

    // 登录
    console.log("🔐 Logging in...");
    const loginResult = await client.login();
    
    if (loginResult) {
      console.log("✅ Login successful!");
      console.log(`   Account: ${client.account}`);
      console.log("");
      console.log("📝 Now listening for messages...");
      console.log("   Press Ctrl+C to exit");
      
      // 保持进程运行
      await new Promise(() => {});
    } else {
      console.error("❌ Login failed!");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
