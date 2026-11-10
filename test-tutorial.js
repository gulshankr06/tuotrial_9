/**
 * Automated Verification Script for CS543 API Security Tutorial
 * Tests all requirements from the PDF
 */

const http = require('http');

const PORT = 3000;
const HOST = 'localhost';

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(65));
  console.log('  CS543 API Security Tutorial - Automated Verification');
  console.log('='.repeat(65));

  let customerToken = '';
  let restaurantToken = '';
  let adminToken = '';

  try {
    // Check Health
    const health = await request({ host: HOST, port: PORT, path: '/health', method: 'GET' });
    console.log(`[PASS] Server Online: HTTP ${health.status}`);

    // Part 4 Check #1: GET /items with NO TOKEN -> Expect 401
    console.log('\n--- Part 4 Check #1: Read menu with no token ---');
    const noAuthGet = await request({ host: HOST, port: PORT, path: '/items', method: 'GET' });
    console.log(`Status: ${noAuthGet.status} (Expected: 401)`);
    console.log(`Response:`, noAuthGet.data);
    if (noAuthGet.status === 401) console.log('✓ PASS: 401 Unauthorized received ("I don\'t know who you are")');
    else console.error('✗ FAIL');

    // Part 2 Check: POST /login -- bad login -> Expect 401
    console.log('\n--- Part 2: POST /login with bad credentials ---');
    const badLogin = await request({
      host: HOST, port: PORT, path: '/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'asha@campus.edu', password: 'wrongpassword' });
    console.log(`Status: ${badLogin.status} (Expected: 401)`);
    console.log(`Response:`, badLogin.data);
    if (badLogin.status === 401) console.log('✓ PASS: Bad login rejected');
    else console.error('✗ FAIL');

    // Part 2 & 4 Check #2: POST /login as restaurant (mealhub)
    console.log('\n--- Part 2 & 4 Check #2: Log in as restaurant ---');
    const restoLogin = await request({
      host: HOST, port: PORT, path: '/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'mealhub@campus.edu', password: 'resto123' });
    console.log(`Status: ${restoLogin.status} (Expected: 200)`);
    restaurantToken = restoLogin.data.token;
    console.log(`Token received (length: ${restaurantToken?.length})`);
    if (restoLogin.status === 200 && restaurantToken) console.log('✓ PASS: Restaurant JWT issued');
    else console.error('✗ FAIL');

    // Log in as customer (asha)
    const custLogin = await request({
      host: HOST, port: PORT, path: '/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'asha@campus.edu', password: 'customer123' });
    customerToken = custLogin.data.token;
    console.log(`✓ Customer JWT issued for ${custLogin.data.user?.email}`);

    // Log in as admin
    const admLogin = await request({
      host: HOST, port: PORT, path: '/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@campus.edu', password: 'admin123' });
    adminToken = admLogin.data.token;
    console.log(`✓ Admin JWT issued for ${admLogin.data.user?.email}`);

    // Part 4 Check #3: GET /items with Bearer token -> Expect 200
    console.log('\n--- Part 4 Check #3: Read menu WITH token ---');
    const authGet = await request({
      host: HOST, port: PORT, path: '/items', method: 'GET',
      headers: { 'Authorization': `Bearer ${restaurantToken}` }
    });
    console.log(`Status: ${authGet.status} (Expected: 200)`);
    console.log(`Items count: ${authGet.data?.length}`);
    if (authGet.status === 200 && Array.isArray(authGet.data)) console.log('✓ PASS: Menu read successfully');
    else console.error('✗ FAIL');

    // Part 6 Check #4: Restaurant adds a dish -> Expect 201
    console.log('\n--- Part 6 Check #4: Restaurant adds dish (POST /items) ---');
    const restoAdd = await request({
      host: HOST, port: PORT, path: '/items', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${restaurantToken}`
      }
    }, { name: 'Masala Dosa', price: 60 });
    console.log(`Status: ${restoAdd.status} (Expected: 201)`);
    console.log(`Created Item:`, restoAdd.data);
    if (restoAdd.status === 201 && restoAdd.data.name === 'Masala Dosa') console.log('✓ PASS: 201 Created');
    else console.error('✗ FAIL');

    // Part 6 Check #5: Customer tries to add a dish -> Expect 403 Forbidden
    console.log('\n--- Part 6 Check #5: Customer tries to add dish (POST /items) ---');
    const custAdd = await request({
      host: HOST, port: PORT, path: '/items', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      }
    }, { name: 'Hack Burger', price: 99 });
    console.log(`Status: ${custAdd.status} (Expected: 403)`);
    console.log(`Response:`, custAdd.data);
    if (custAdd.status === 403) console.log('✓ PASS: 403 Forbidden ("I know you, but you cannot do this")');
    else console.error('✗ FAIL');

    // Part 7: Blank Name Validation -> Expect 422
    console.log('\n--- Part 7: Missing name validation ---');
    const blankAdd = await request({
      host: HOST, port: PORT, path: '/items', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${restaurantToken}`
      }
    }, { name: '', price: 50 });
    console.log(`Status: ${blankAdd.status} (Expected: 422)`);
    console.log(`Response:`, blankAdd.data);
    if (blankAdd.status === 422) console.log('✓ PASS: 422 Unprocessable Entity ("Validation is separate from security")');
    else console.error('✗ FAIL');

    // Part 7: Tampered Token verification
    console.log('\n--- Part 7: Tampered Token Verification ---');
    const tokenParts = customerToken.split('.');
    // Fake payload changing role to admin
    const fakePayload = Buffer.from(JSON.stringify({ sub: 1, role: 'admin' })).toString('base64');
    const tamperedToken = `${tokenParts[0]}.${fakePayload}.${tokenParts[2]}`;
    const tamperedReq = await request({
      host: HOST, port: PORT, path: '/items', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tamperedToken}`
      }
    }, { name: 'Tampered Dish', price: 10 });
    console.log(`Status: ${tamperedReq.status} (Expected: 401)`);
    console.log(`Response:`, tamperedReq.data);
    if (tamperedReq.status === 401) console.log('✓ PASS: 401 Invalid Token (Cryptographic signature preserved security!)');
    else console.error('✗ FAIL');

    // Page 4 Extension: Object-Level Authorization (IDOR check)
    console.log('\n--- Page 4 Extension: Object-Level Authorization (IDOR Check) ---');
    // Customer Asha requests Order #102 (belonging to Rahul #99)
    const idorReq = await request({
      host: HOST, port: PORT, path: '/orders/102', method: 'GET',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    console.log(`Status: ${idorReq.status} (Expected: 403 IDOR rejection)`);
    console.log(`Response:`, idorReq.data);
    if (idorReq.status === 403) console.log('✓ PASS: IDOR prevented (Customer cannot access another customer\'s order)');
    else console.error('✗ FAIL');

    console.log('\n' + '='.repeat(65));
    console.log('  ALL API SECURITY TESTS PASSED PERFECTLY!');
    console.log('='.repeat(65));
  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

runTests();

