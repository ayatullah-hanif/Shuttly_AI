// tests/conversation_tests.js
const axios = require('axios');
const { executeTool } = require('../server/controllers/tools');

// Test configuration
const SERVER_URL = 'http://localhost:3000';

// Test cases
const TEST_CONVERSATIONS = [
  {
    id: 1,
    name: 'Price check - Preset locations',
    messages: [
      'Hi',
      'I want to check the price from Ojota to Oshodi'
    ],
    expectedIntent: 'price_check',
    expectedKeywords: ['₦', 'price', 'Ojota', 'Oshodi']
  },
  {
    id: 2,
    name: 'Bus status check',
    messages: [
      'Are there buses at Maryland right now?'
    ],
    expectedIntent: 'bus_status',
    expectedKeywords: ['bus', 'Maryland', 'minutes', 'wait']
  },
  {
    id: 3,
    name: 'City selection',
    messages: [
      'Show me cities',
      'What stops are in Lagos?'
    ],
    expectedIntent: 'get_stops',
    expectedKeywords: ['Lagos', 'stops', 'Ojota', 'Berger']
  },
  {
    id: 4,
    name: 'Complaint logging',
    messages: [
      'I want to make a complaint',
      'The bus was very dirty and the driver was rude'
    ],
    expectedIntent: 'complaint',
    expectedKeywords: ['complaint', 'feedback', 'thank']
  },
  {
    id: 5,
    name: 'Multi-city query',
    messages: [
      'How much from Challenge in Ibadan to Dugbe?'
    ],
    expectedIntent: 'price_check',
    expectedKeywords: ['₦', 'Challenge', 'Dugbe']
  },
  {
    id: 6,
    name: 'Location query - nearest stop',
    messages: [
      'What is the nearest stop to me?'
    ],
    expectedIntent: 'nearest_stop',
    expectedKeywords: ['location', 'nearest', 'share']
  },
  {
    id: 7,
    name: 'Route information',
    messages: [
      'Tell me about routes from Ojota'
    ],
    expectedIntent: 'route_info',
    expectedKeywords: ['Ojota', 'route']
  },
  {
    id: 8,
    name: 'Waiting time prediction',
    messages: [
      'How long do I have to wait at Berger?'
    ],
    expectedIntent: 'waiting_time',
    expectedKeywords: ['wait', 'Berger', 'minutes']
  },
  {
    id: 9,
    name: 'Multiple stops query',
    messages: [
      'What are the stops in Ilorin?'
    ],
    expectedIntent: 'get_stops',
    expectedKeywords: ['Ilorin', 'stops']
  },
  {
    id: 10,
    name: 'Ambiguous query',
    messages: [
      'Bus'
    ],
    expectedIntent: 'clarification',
    expectedKeywords: ['help', 'can', 'price', 'status']
  }
];

// Tool tests
async function testTools() {
  console.log('\n🔧 Testing Tools...\n');
  
  const toolTests = [
    {
      name: 'getCities',
      tool: 'getCities',
      args: {}
    },
    {
      name: 'getBusStops - Lagos',
      tool: 'getBusStops',
      args: { city_name: 'Lagos' }
    },
    {
      name: 'getPrice - Ojota to Oshodi',
      tool: 'getPrice',
      args: { 
        origin_stop_name: 'Ojota', 
        destination_stop_name: 'Oshodi',
        city_name: 'Lagos'
      }
    },
    {
      name: 'getBusStatus - Maryland',
      tool: 'getBusStatus',
      args: { stop_name: 'Maryland', city_name: 'Lagos' }
    },
    {
      name: 'findNearestStop - GPS coordinates',
      tool: 'findNearestStop',
      args: { latitude: 6.5833, longitude: 3.3833 }
    }
  ];
  
  for (const test of toolTests) {
    try {
      const result = await executeTool(test.tool, test.args);
      
      if (result.success) {
        console.log(`✅ ${test.name}: PASSED`);
        console.log(`   Response: ${JSON.stringify(result).substring(0, 100)}...`);
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        console.log(`   Error: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR`);
      console.log(`   ${error.message}`);
    }
  }
}

// Server health check
async function testServerHealth() {
  console.log('\n🏥 Testing Server Health...\n');
  
  try {
    const response = await axios.get(`${SERVER_URL}/health`);
    
    if (response.data.status === 'ok') {
      console.log('✅ Server is healthy');
      return true;
    } else {
      console.log('❌ Server health check failed');
      return false;
    }
  } catch (error) {
    console.log(`❌ Cannot connect to server: ${error.message}`);
    console.log(`   Make sure server is running on ${SERVER_URL}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║      ShuttlyAI Test Suite             ║');
  console.log('╚════════════════════════════════════════╝');
  
  // Test server health
  const serverHealthy = await testServerHealth();
  
  if (!serverHealthy) {
    console.log('\n⚠️  Server is not running. Starting tool tests only...\n');
  }
  
  // Test tools
  await testTools();
  
  console.log('\n📋 Test Conversation Scenarios:');
  console.log('(These would be tested with actual WhatsApp integration)\n');
  
  TEST_CONVERSATIONS.forEach(test => {
    console.log(`${test.id}. ${test.name}`);
    console.log(`   Messages: ${test.messages.join(' → ')}`);
    console.log(`   Expected: ${test.expectedIntent}`);
    console.log('');
  });
  
  console.log('\n✅ Tests completed!\n');
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  TEST_CONVERSATIONS,
  testTools,
  testServerHealth,
  runTests
};