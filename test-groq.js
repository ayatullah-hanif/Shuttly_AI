// test-groq.js
require('dotenv').config();
const axios = require('axios');

async function testGroq() {
  console.log('🧪 Testing Groq API...\n');
  
  // Check if API key is loaded
  console.log('API Key exists:', !!process.env.GROQ_API_KEY);
  console.log('API Key starts with:', process.env.GROQ_API_KEY?.substring(0, 10));
  console.log('');

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: 'Say hello in one word' }
        ],
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Groq API is working!');
    console.log('Response:', response.data.choices[0].message.content);
    
  } catch (error) {
    console.log('❌ Groq API Error:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data);
    console.log('');
    
    if (error.response?.status === 401) {
      console.log('🔑 API key is invalid or expired');
      console.log('   Go to https://console.groq.com and create a new key');
    } else if (error.response?.status === 400) {
      console.log('📝 Request format issue:');
      console.log(JSON.stringify(error.response?.data, null, 2));
    }
  }
}

testGroq();