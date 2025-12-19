import http from 'http';

console.log('🔍 Testing servers...\n');

async function test(port, path, name) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`✅ ${name}`);
        console.log(`   URL: http://localhost:${port}${path}`);
        console.log(`   Status: ${res.statusCode}`);
        if (data.length < 200) {
          console.log(`   Response: ${data.substring(0, 200)}`);
        }
        console.log('');
        resolve(true);
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${name} - ${err.code || err.message}`);
      console.log(`   URL: http://localhost:${port}${path}`);
      console.log('');
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log(`❌ ${name} - TIMEOUT`);
      console.log(`   URL: http://localhost:${port}${path}`);
      console.log('');
      resolve(false);
    });

    req.end();
  });
}

const backend = await test(3002, '/api/llm/status', 'Backend API');
const backend2 = await test(3002, '/api/chats', 'Backend Chats');
const frontend = await test(5174, '/', 'Frontend App');

if (backend && frontend) {
  console.log('🎉 All servers are working!');
  process.exit(0);
} else {
  console.log('⚠️ Some servers are not responding.');
  console.log('\nPlease ensure:');
  console.log('  1. Backend is running: npm run dev:backend');
  console.log('  2. Frontend is running: cd frontend && npm run dev');
  process.exit(1);
}

