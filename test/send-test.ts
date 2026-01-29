/**
 * NIM 发送消息测试脚本
 * 
 * 运行: npx tsx test/send-test.ts <接收者账号> <消息内容>
 */

import { createNimClient } from "../src/client.js";

async function main() {
  const args = process.argv.slice(2);
  const targetAccount = args[0];
  const messageText = args.slice(1).join(" ") || "Hello from MoltBot NIM!";

  if (!targetAccount) {
    console.error("Usage: npx tsx test/send-test.ts <receiver_account> [message]");
    console.error("");
    console.error("Example:");
    console.error('  NIM_APP_KEY=xxx NIM_ACCOUNT=bot1 NIM_TOKEN=xxx npx tsx test/send-test.ts user1 "Hello!"');
    process.exit(1);
  }

  console.log("🚀 Starting NIM send test...");

  // 从环境变量读取配置
  const config = {
    appKey: process.env.NIM_APP_KEY || "",
    account: process.env.NIM_ACCOUNT || "",
    token: process.env.NIM_TOKEN || "",
  };

  if (!config.appKey || !config.account || !config.token) {
    console.error("❌ Missing NIM credentials. Please set:");
    console.error("   NIM_APP_KEY, NIM_ACCOUNT, NIM_TOKEN");
    process.exit(1);
  }

  try {
    // 创建客户端
    console.log("📡 Creating NIM client...");
    const client = await createNimClient(config);

    // 登录
    console.log("🔐 Logging in...");
    const loginResult = await client.login();
    
    if (!loginResult) {
      console.error("❌ Login failed!");
      process.exit(1);
    }
    
    console.log("✅ Login successful!");

    // 等待一小段时间确保连接稳定
    await new Promise(r => setTimeout(r, 1000));

    // 发送消息
    console.log(`📤 Sending message to ${targetAccount}...`);
    console.log(`   Content: "${messageText}"`);
    
    const result = await client.sendText(targetAccount, messageText, "p2p");
    
    if (result.success) {
      console.log("✅ Message sent successfully!");
      console.log(`   Client Message ID: ${result.clientMsgId}`);
    } else {
      console.error("❌ Send failed:", result.error);
    }

    // 等待一下以确保消息发送完成
    await new Promise(r => setTimeout(r, 2000));

    // 清理
    console.log("🔚 Logging out...");
    await client.destroy();
    console.log("✅ Done!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
