// CS543 Web Services · API Security Tutorial Client
const API_BASE = 'http://localhost:3000';

// State
let currentToken = null;
let currentUser = null;

// DOM Elements
const backendStatusEl = document.getElementById('backendStatus');
const sessionRoleBadge = document.getElementById('sessionRoleBadge');
const tokenValidityStatus = document.getElementById('tokenValidityStatus');
const rawTokenDisplay = document.getElementById('rawTokenDisplay');
const decodedPayloadDisplay = document.getElementById('decodedPayloadDisplay');
const authHeaderDisplay = document.getElementById('authHeaderDisplay');
const itemsListEl = document.getElementById('itemsList');
const itemCountEl = document.getElementById('itemCount');
const terminalLog = document.getElementById('terminalLog');
const conceptCallout = document.getElementById('conceptCallout');
const calloutTitle = document.getElementById('calloutTitle');
const calloutBody = document.getElementById('calloutBody');
const ordersListBox = document.getElementById('ordersListBox');
const idorResult = document.getElementById('idorResult');

// Modal Elements
const customLoginModal = document.getElementById('customLoginModal');
const customLoginForm = document.getElementById('customLoginForm');
const btnCustomLoginModal = document.getElementById('btnCustomLoginModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');

// Init
document.addEventListener('DOMContentLoaded', () => {
  checkBackendHealth();
  setupEventListeners();
  updateUI();
  // Try fetching catalogue initially (unauthenticated to demonstrate initial state)
  fetchItems(false);
});

// Setup Events
function setupEventListeners() {
  // Quick sign-in buttons
  document.getElementById('btnQuickCustomer').addEventListener('click', () => {
    login('asha@campus.edu', 'customer123');
  });
  document.getElementById('btnQuickRestaurant').addEventListener('click', () => {
    login('mealhub@campus.edu', 'resto123');
  });
  document.getElementById('btnQuickAdmin').addEventListener('click', () => {
    login('admin@campus.edu', 'admin123');
  });

  // Auth actions
  document.getElementById('btnLogout').addEventListener('click', logout);
  document.getElementById('btnTamperToken').addEventListener('click', tamperToken);

  // Modal events
  btnCustomLoginModal.addEventListener('click', () => customLoginModal.classList.add('open'));
  btnCloseModal.addEventListener('click', () => customLoginModal.classList.remove('open'));
  btnCancelModal.addEventListener('click', () => customLoginModal.classList.remove('open'));
  customLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('customEmail').value.trim();
    const password = document.getElementById('customPassword').value;
    customLoginModal.classList.remove('open');
    login(email, password);
  });

  // Form add dish
  document.getElementById('addItemForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('dishName').value.trim();
    const price = document.getElementById('dishPrice').value;
    addItem(name, price);
  });

  // Catalogue refresh & Reset
  document.getElementById('btnRefreshItems').addEventListener('click', () => fetchItems(true));
  document.getElementById('btnResetData').addEventListener('click', resetBackendData);
  document.getElementById('btnClearTerminal').addEventListener('click', clearTerminal);

  // Orders / IDOR
  document.getElementById('btnRefreshOrders').addEventListener('click', fetchOrders);
  document.getElementById('btnTestIDOR').addEventListener('click', testDirectOrderId);

  // Tutorial Test Runner
  document.querySelectorAll('.test-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const testKey = e.currentTarget.getAttribute('data-test');
      runTutorialTest(testKey);
    });
  });
}

// Preset helper for form
window.setDishPreset = function(name, price) {
  document.getElementById('dishName').value = name;
  document.getElementById('dishPrice').value = price;
};

// Backend Health Check
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (res.ok) {
      backendStatusEl.innerHTML = `<span class="dot online"></span><span class="label">Backend: Online (port 3000)</span>`;
    } else {
      throw new Error('Not 200');
    }
  } catch (err) {
    backendStatusEl.innerHTML = `<span class="dot offline"></span><span class="label">Backend: Offline</span>`;
  }
}

// Logging to Terminal
function logTerminal({ cmd, method, url, headers = {}, body = null, status, responseData }) {
  const entry = document.createElement('div');
  entry.className = 'terminal-entry';

  let statusClass = `s${status}`;
  let statusText = `${status}`;
  if (status === 200) statusText += ' OK';
  else if (status === 201) statusText += ' Created';
  else if (status === 401) statusText += ' Unauthorized';
  else if (status === 403) statusText += ' Forbidden';
  else if (status === 422) statusText += ' Unprocessable Entity';

  let html = '';
  if (cmd) {
    html += `<span class="term-cmd">$ ${escapeHtml(cmd)}</span><br/>`;
  }

  html += `<span class="term-dim">HTTP/1.1</span> <span class="term-status ${statusClass}">${escapeHtml(statusText)}</span><br/>`;
  
  if (headers && Object.keys(headers).length > 0) {
    html += `<span class="term-header">Headers:</span> <span class="term-dim">${escapeHtml(JSON.stringify(headers))}</span><br/>`;
  }

  if (body) {
    html += `<span class="term-header">Request Body:</span> <span class="term-body-json">${escapeHtml(JSON.stringify(body))}</span><br/>`;
  }

  if (responseData) {
    html += `<span class="term-header">Response:</span> <span class="term-body-json">${escapeHtml(JSON.stringify(responseData, null, 2))}</span>`;
  }

  entry.innerHTML = html;
  terminalLog.appendChild(entry);
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

function clearTerminal() {
  terminalLog.innerHTML = `<div class="terminal-entry welcome"><span class="term-dim"># Terminal cleared. Ready for next API request.</span></div>`;
}

// Explain Concept in Callout
function showConcept(type, customText = '') {
  if (type === 401) {
    calloutTitle.innerText = '401 Unauthorized — Authentication Failure';
    calloutBody.innerHTML = `<strong>"I don't know who you are."</strong><br/>
    The server received either no <code>Authorization</code> header or a token whose cryptographic signature could not be verified with <code>SECRET</code>.
    ${customText ? `<br/><br/><em>${customText}</em>` : ''}`;
  } else if (type === 403) {
    calloutTitle.innerText = '403 Forbidden — Authorization Failure';
    calloutBody.innerHTML = `<strong>"I know who you are, but you are not allowed to do this."</strong><br/>
    Authentication succeeded (the JWT signature is valid and the user is identified), but the user's role does not meet the requirement of <code>requireRole('restaurant', 'admin')</code>.
    ${customText ? `<br/><br/><em>${customText}</em>` : ''}`;
  } else if (type === 422) {
    calloutTitle.innerText = '422 Unprocessable Entity — Validation Failure';
    calloutBody.innerHTML = `<strong>"Validation is separate from security."</strong><br/>
    Security asks <em>who are you / may you?</em>. Validation asks <em>is the input data clean and valid?</em>. The dish name was empty.`;
  } else if (type === 201) {
    calloutTitle.innerText = '201 Created — Authorization & Creation Succeeded';
    calloutBody.innerHTML = `<strong>All three guards passed:</strong><br/>
    1. <code>auth</code>: Valid JWT signature (who are you → OK)<br/>
    2. <code>requireRole</code>: User has allowed role <code>restaurant</code> or <code>admin</code> (may you → OK)<br/>
    3. Route Handler: Added dish to catalogue and returned 201.`;
  } else if (type === 200) {
    calloutTitle.innerText = '200 OK — Authenticated Catalogue Access';
    calloutBody.innerHTML = `Any authenticated user (customer, restaurant, or admin) may read the catalogue (<code>GET /items</code>).`;
  }
}

// Decode JWT without external library
function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { header, payload, signature: parts[2] };
  } catch (e) {
    return null;
  }
}

// Update UI
function updateUI() {
  // Update button active states
  document.getElementById('btnQuickCustomer').classList.toggle('active', currentUser?.role === 'customer');
  document.getElementById('btnQuickRestaurant').classList.toggle('active', currentUser?.role === 'restaurant');
  document.getElementById('btnQuickAdmin').classList.toggle('active', currentUser?.role === 'admin');

  if (currentToken && currentUser) {
    sessionRoleBadge.innerText = `${currentUser.role.toUpperCase()}: ${currentUser.email}`;
    sessionRoleBadge.className = `badge ${currentUser.role}`;

    const parsed = parseJwt(currentToken);
    if (parsed) {
      tokenValidityStatus.innerText = 'Status: Valid JWT (Signature & Expiry verified on server)';
      tokenValidityStatus.style.color = '#34d399';

      const parts = currentToken.split('.');
      rawTokenDisplay.innerHTML = `
        <span class="jwt-part-header" title="Header (Algorithm & Type)">${escapeHtml(parts[0])}</span>.<span class="jwt-part-payload" title="Payload (User ID, Role, Expiry)">${escapeHtml(parts[1])}</span>.<span class="jwt-part-sig" title="Signature (HMAC-SHA256)">${escapeHtml(parts[2])}</span>
      `;

      decodedPayloadDisplay.innerText = JSON.stringify(parsed.payload, null, 2);
      authHeaderDisplay.innerText = `Authorization: Bearer ${currentToken.substring(0, 24)}...`;
    }
  } else {
    sessionRoleBadge.innerText = 'Not Authenticated';
    sessionRoleBadge.className = 'badge';
    tokenValidityStatus.innerText = 'Status: No Token';
    tokenValidityStatus.style.color = '#94a3b8';
    rawTokenDisplay.innerHTML = '<span class="term-dim">No active token. Click a user above to log in and receive a signed JWT.</span>';
    decodedPayloadDisplay.innerText = JSON.stringify({ sub: null, role: null, status: 'Logged out' }, null, 2);
    authHeaderDisplay.innerText = 'Authorization: (none)';
  }
}

// Part 2: POST /login -- password in, token out
async function login(email, password) {
  const curlCmd = `curl -X POST ${API_BASE}/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"${email}","password":"${password}"}'`;

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    logTerminal({
      cmd: curlCmd,
      method: 'POST',
      url: '/login',
      body: { email, password: '••••••••' },
      status: res.status,
      responseData: data
    });

    if (res.ok && data.token) {
      currentToken = data.token;
      currentUser = data.user;
      updateUI();
      showConcept(200, `Logged in as ${currentUser.role}. Server verified bcrypt hash and returned signed JWT.`);
      fetchItems(true);
      fetchOrders();
    } else {
      logout();
      showConcept(401, 'Bad credentials. Check email and password.');
    }
  } catch (err) {
    logTerminal({
      cmd: curlCmd,
      method: 'POST',
      url: '/login',
      status: 0,
      responseData: { error: 'Network error or backend unreachable' }
    });
  }
}

// Logout
function logout() {
  currentToken = null;
  currentUser = null;
  updateUI();
  ordersListBox.innerHTML = '<div class="term-dim" style="padding:10px;">Log in to view customer orders.</div>';
  idorResult.innerHTML = '';
}

// Tamper Token (Part 7: Why token cannot be forged)
function tamperToken() {
  if (!currentToken) {
    alert('Please log in first before testing token tampering.');
    return;
  }

  const parts = currentToken.split('.');
  if (parts.length !== 3) return;

  try {
    // Decode payload, modify role to admin, re-encode base64, but leave signature as is!
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    payload.role = 'admin';
    payload.forged = true;
    
    // Base64 encode altered payload
    const forgedPayloadBase64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    // Assembled tampered token: original header + FORGED payload + OLD signature
    currentToken = `${parts[0]}.${forgedPayloadBase64}.${parts[2]}`;
    
    tokenValidityStatus.innerText = 'Status: ⚠️ TAMPERED TOKEN (Signature mismatch!)';
    tokenValidityStatus.style.color = '#ef4444';

    rawTokenDisplay.innerHTML = `
      <span class="jwt-part-header">${escapeHtml(parts[0])}</span>.<span class="jwt-part-payload" style="background:rgba(239,68,68,0.3); padding:2px;">${escapeHtml(forgedPayloadBase64)}</span>.<span class="jwt-part-sig">${escapeHtml(parts[2])}</span>
    `;

    decodedPayloadDisplay.innerText = JSON.stringify(payload, null, 2);

    logTerminal({
      cmd: '# Attacker modified token payload: changed role to "admin" without SECRET',
      status: 'TAMPERED',
      responseData: { warning: 'Token signature will fail verification on server (Part 7)' }
    });

    showConcept(401, 'Token was tampered with! The server recomputes HMAC-SHA256(header.payload, SECRET) and will reject this with 401.');
  } catch (e) {
    console.error('Tamper error', e);
  }
}

// Part 3 & 4: GET /items -- any authenticated user may read the menu
async function fetchItems(sendAuth = true) {
  const headers = {};
  let curlCmd = `curl -i ${API_BASE}/items`;

  if (sendAuth && currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
    curlCmd = `curl -i ${API_BASE}/items -H "Authorization: Bearer <token>"`;
  }

  try {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'GET',
      headers
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    logTerminal({
      cmd: curlCmd,
      method: 'GET',
      url: '/items',
      headers: sendAuth && currentToken ? { Authorization: 'Bearer eyJhbGci...' } : {},
      status: res.status,
      responseData: data
    });

    if (res.ok) {
      renderCatalogue(data);
      showConcept(200);
    } else {
      itemsListEl.innerHTML = `
        <div class="empty-state">
          <p>🔒 HTTP ${res.status}: ${data?.error || 'Authentication required'}</p>
          <small>Provide a valid Bearer token to read the catalogue.</small>
        </div>
      `;
      itemCountEl.innerText = '0 items';
      showConcept(res.status, data?.error);
    }
  } catch (err) {
    console.error(err);
  }
}

// Render Items in Catalogue
function renderCatalogue(items) {
  itemCountEl.innerText = `${items.length} dishes`;
  if (!items || items.length === 0) {
    itemsListEl.innerHTML = '<div class="empty-state">Catalogue is empty.</div>';
    return;
  }

  itemsListEl.innerHTML = items.map(item => `
    <div class="item-card">
      <div class="item-id-badge">Dish #${item.id}</div>
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-footer">
        <span class="item-price">₹${item.price}</span>
        ${currentUser?.role === 'admin' ? `
          <button class="btn btn-danger btn-xs" onclick="deleteItem(${item.id})">Delete</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Part 5 & 6: POST /items -- only a restaurant (or admin) may add a dish
async function addItem(name, price) {
  const headers = { 'Content-Type': 'application/json' };
  let curlCmd = `curl -X POST ${API_BASE}/items \\
  -H "Content-Type: application/json" \\`;

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
    curlCmd += `\n  -H "Authorization: Bearer <token>" \\`;
  }

  const payload = { name, price: Number(price) || 0 };
  curlCmd += `\n  -d '${JSON.stringify(payload)}'`;

  try {
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    logTerminal({
      cmd: curlCmd,
      method: 'POST',
      url: '/items',
      headers: currentToken ? { Authorization: 'Bearer ...' } : {},
      body: payload,
      status: res.status,
      responseData: data
    });

    showConcept(res.status, data.detail || data.error);

    if (res.status === 201) {
      document.getElementById('dishName').value = '';
      document.getElementById('dishPrice').value = '';
      fetchItems(true);
    }
  } catch (err) {
    console.error(err);
  }
}

// Admin-only Extension: DELETE /items/:id
window.deleteItem = async function(id) {
  if (!confirm(`Are you sure you want to delete dish #${id}?`)) return;

  const headers = {};
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

  try {
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
      headers
    });
    const data = await res.json();

    logTerminal({
      cmd: `curl -X DELETE ${API_BASE}/items/${id} -H "Authorization: Bearer <token>"`,
      method: 'DELETE',
      url: `/items/${id}`,
      status: res.status,
      responseData: data
    });

    if (res.ok) {
      fetchItems(true);
    } else {
      alert(`Delete failed: ${data.error || 'Unauthorized'}`);
    }
  } catch (err) {
    console.error(err);
  }
};

// Object-Level Authorization Check (IDOR Demonstration)
async function fetchOrders() {
  if (!currentToken) {
    ordersListBox.innerHTML = '<div class="term-dim" style="padding:10px;">Please log in to view orders.</div>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();

    logTerminal({
      cmd: `curl -i ${API_BASE}/orders -H "Authorization: Bearer <token>"`,
      method: 'GET',
      url: '/orders',
      status: res.status,
      responseData: data
    });

    if (res.ok) {
      const orders = data.orders || [];
      if (orders.length === 0) {
        ordersListBox.innerHTML = '<div class="term-dim" style="padding:10px;">No orders found.</div>';
        return;
      }

      ordersListBox.innerHTML = `
        <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:6px;">
          ${data.userOrdersOnly ? '🔒 Filtered: Showing ONLY your customer orders' : '👁️ Showing all campus orders (Restaurant/Admin view)'}
        </div>
        ${orders.map(o => `
          <div class="order-row">
            <div>
              <strong>#${o.id}</strong>: ${escapeHtml(o.item)} (₹${o.total})
              <div style="font-size:0.7rem; color:#64748b;">Customer #${o.customerId} (${escapeHtml(o.customerEmail)})</div>
            </div>
            <span class="code-pill code-200">${escapeHtml(o.status)}</span>
          </div>
        `).join('')}
      `;
    }
  } catch (e) {
    console.error(e);
  }
}

// Test IDOR: Try reading order #102
async function testDirectOrderId() {
  if (!currentToken) {
    alert('Please log in first to test IDOR check.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/orders/102`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    const data = await res.json();

    logTerminal({
      cmd: `curl -i ${API_BASE}/orders/102 -H "Authorization: Bearer <token>"`,
      method: 'GET',
      url: '/orders/102',
      status: res.status,
      responseData: data
    });

    if (res.status === 403) {
      idorResult.innerHTML = `<span style="color:#f97316;">🛡️ 403 Forbidden (IDOR Guard active): Customer cannot read another customer's order!</span>`;
      showConcept(403, data.detail);
    } else if (res.ok) {
      idorResult.innerHTML = `<span style="color:#10b981;">✅ 200 OK: Allowed (${currentUser.role} role or order owner).</span>`;
    } else {
      idorResult.innerHTML = `<span style="color:#ef4444;">HTTP ${res.status}: ${data.error}</span>`;
    }
  } catch (e) {
    console.error(e);
  }
}

// Reset data
async function resetBackendData() {
  try {
    const res = await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
    const data = await res.json();
    logTerminal({
      cmd: `curl -X POST ${API_BASE}/api/reset`,
      status: res.status,
      responseData: data
    });
    fetchItems(!!currentToken);
    fetchOrders();
  } catch (e) {
    console.error(e);
  }
}

// Tutorial Test Runner (Step-by-step verification matching PDF)
async function runTutorialTest(testKey) {
  if (testKey === 'no-token-get') {
    // Step 1: GET /items with no token -> Expect 401
    await fetchItems(false);
  } else if (testKey === 'auth-get') {
    // Step 2: GET /items with current token
    if (!currentToken) {
      alert('Please log in first (e.g. click Asha or MealHub) then run this step.');
      return;
    }
    await fetchItems(true);
  } else if (testKey === 'restaurant-post') {
    // Step 3: Add dish as restaurant -> Expect 201
    await login('mealhub@campus.edu', 'resto123');
    await addItem('Masala Dosa', 60);
  } else if (testKey === 'customer-post') {
    // Step 4: Add dish as customer -> Expect 403
    await login('asha@campus.edu', 'customer123');
    await addItem('Hack Burger', 99);
  } else if (testKey === 'blank-name-post') {
    // Step 5: Blank dish name -> Expect 422
    if (!currentToken || currentUser?.role === 'customer') {
      await login('mealhub@campus.edu', 'resto123');
    }
    await addItem('', 50);
  } else if (testKey === 'tampered-token') {
    // Step 6: Tampered signature -> Expect 401
    if (!currentToken) {
      await login('asha@campus.edu', 'customer123');
    }
    tamperToken();
    await fetchItems(true);
  }
}

// Utility: escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

