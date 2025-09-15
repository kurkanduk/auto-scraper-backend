// Test script for message pools functionality
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testMessagePools() {
  console.log('🧪 Testing Message Pools Functionality\n');

  try {
    // 1. Create messages for Otomoto
    console.log('1. Creating messages for Otomoto...');
    const otomotoMessages = [
      {
        content: 'Dobrý deň, zaujíma ma vaše auto. Je stále k dispozícii?',
        source: 'otomoto',
        isActive: true
      },
      {
        content: 'Ahoj, chcel by som sa opýtať na vaše auto. Môžete mi poslať viac informácií?',
        source: 'otomoto',
        isActive: true
      }
    ];

    for (const message of otomotoMessages) {
      const response = await axios.post(`${BASE_URL}/message-pool`, message);
      console.log(`✅ Created Otomoto message: ${response.data.id}`);
    }

    // 2. Create messages for AutoScout
    console.log('\n2. Creating messages for AutoScout...');
    const autoScoutMessages = [
      {
        content: 'Hallo, ich interessiere mich für Ihr Auto. Ist es noch verfügbar?',
        source: 'auto-scout',
        isActive: true
      },
      {
        content: 'Guten Tag, ich würde gerne mehr Informationen zu Ihrem Fahrzeug erhalten.',
        source: 'auto-scout',
        isActive: true
      }
    ];

    for (const message of autoScoutMessages) {
      const response = await axios.post(`${BASE_URL}/message-pool`, message);
      console.log(`✅ Created AutoScout message: ${response.data.id}`);
    }

    // 3. Test filtering by source
    console.log('\n3. Testing filtering by source...');
    
    const otomotoResponse = await axios.get(`${BASE_URL}/message-pool/source/otomoto`);
    console.log(`📱 Otomoto messages (${otomotoResponse.data.length}):`);
    otomotoResponse.data.forEach(msg => {
      console.log(`   - ${msg.content}`);
    });

    const autoScoutResponse = await axios.get(`${BASE_URL}/message-pool/source/auto-scout`);
    console.log(`\n🚗 AutoScout messages (${autoScoutResponse.data.length}):`);
    autoScoutResponse.data.forEach(msg => {
      console.log(`   - ${msg.content}`);
    });

    // 4. Test general endpoint with query parameter
    console.log('\n4. Testing general endpoint with query parameter...');
    const queryResponse = await axios.get(`${BASE_URL}/message-pool?source=otomoto`);
    console.log(`📱 Query parameter test - Otomoto messages: ${queryResponse.data.length}`);

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Otomoto messages: ${otomotoResponse.data.length}`);
    console.log(`   - AutoScout messages: ${autoScoutResponse.data.length}`);
    console.log(`   - Total messages: ${otomotoResponse.data.length + autoScoutResponse.data.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testMessagePools();

