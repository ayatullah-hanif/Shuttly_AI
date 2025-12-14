// test-ai.js
const { handleConversation } = require('./server/services/llama');
const { executeTool } = require('./server/controllers/tools');

async function testAI() {
  console.log('🤖 Testing Llama AI...\n');

  // Tool executor
  const toolExecutor = async (toolName, args) => {
    console.log(`🔧 Calling tool: ${toolName}`);
    return await executeTool(toolName, args);
  };

  // Test queries
  const queries = [
    'Hello',
    'How much from Ojota to Oshodi?',
    'Are there buses at Maryland?',
    'Show me cities',
    'I want to make a complaint about the dirty bus'
  ];

  for (const query of queries) {
    console.log(`\n👤 User: ${query}`);
    console.log('─'.repeat(50));

    const result = await handleConversation(query, [], toolExecutor);

    if (result.success) {
      console.log(`🤖 Bot: ${result.response}\n`);
    } else {
      console.log(`❌ Error: ${result.response}\n`);
    }

    // Wait a bit between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('✅ AI Testing Complete!');
}

testAI().catch(console.error);