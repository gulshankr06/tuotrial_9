require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Secret from .env or fallback as in tutorial
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 3000;

// Part 1: Seeded users with hashed passwords
const users = [
  { 
    id: 1, 
    email: 'asha@campus.edu', 
    role: 'customer', 
    name: 'Asha Sharma',
    hash: bcrypt.hashSync('customer123', 10) 
  },
  { 
    id: 2, 
    email: 'mealhub@campus.edu', 
    role: 'restaurant', 
    name: 'MealHub Canteen',
    hash: bcrypt.hashSync('resto123', 10) 
  },
  { 
    id: 3, 
    email: 'admin@campus.edu', 
    role: 'admin', 
    name: 'Campus Admin',
    hash: bcrypt.hashSync('admin123', 10) 
  }
];

// Catalogue items (seeded)
const initialItems = [
  { id: 1, name: 'Veg Thali', price: 90 },
  { id: 2, name: 'Paneer Roll', price: 70 }
];
let items = JSON.parse(JSON.stringify(initialItems));
let nextId = 3;

// Object-level check demonstration: Orders (From "Where to go next" in PDF)
const initialOrders = [
  { id: 101, customerId: 1, customerEmail: 'asha@campus.edu', item: 'Veg Thali', total: 90, status: 'Preparing' },
  { id: 102, customerId: 99, customerEmail: 'rahul@campus.edu', item: 'Paneer Roll', total: 70, status: 'Delivered' }
];
let orders = JSON.parse(JSON.stringify(initialOrders));
let nextOrderId = 103;

// Helpers
function sanitizeUser(user) {
  const { hash, ...safe } = user;
  return safe;
}

// Public demo information route (gives the test credentials for the UI)
app.get('/api/demo-accounts', (req, res) => {
  res.json({
    accounts: [
      { email: 'asha@campus.edu', password: 'customer123', role: 'customer', name: 'Asha (Customer)' },
      { email: 'mealhub@campus.edu', password: 'resto123', role: 'restaurant', name: 'MealHub (Restaurant)' },
      { email: 'admin@campus.edu', password: 'admin123', role: 'admin', name: 'Campus Admin (Admin)' }
    ]
  });
});

// Part 2: The login route -- password in, token out
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);

  if (!user || !bcrypt.compareSync(password || '', user.hash)) {
    return res.status(401).json({ error: 'bad login' });
  }

  // Token carries who they are and their role
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name }, 
    SECRET, 
    { expiresIn: '1h' }
  );

  res.json({ 
    token, 
    user: sanitizeUser(user),
    message: `Logged in successfully as ${user.role}`
  });
});

// Part 3: The auth middleware -- who are you?
function auth(req, res, next) {
  const authHeader = req.get('Authorization') || '';
  const token = authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'invalid or missing token' });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    next(); // ok -> carry on
  } catch (err) {
    res.status(401).json({ error: 'invalid or missing token' });
  }
}

// Part 5: Authorization -- are you allowed?
function requireRole(...allowed) {
  return (req, res, next) => {
    if (req.user && allowed.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ 
        error: 'forbidden',
        detail: `Your role '${req.user ? req.user.role : 'none'}' is not authorized. Allowed roles: [${allowed.join(', ')}]`
      });
    }
  };
}

// GET /items -- any authenticated user may read the menu
app.get('/items', auth, (req, res) => {
  res.json(items);
});

// POST /items -- only a restaurant (or admin) may add a dish
app.post('/items', auth, requireRole('restaurant', 'admin'), (req, res) => {
  const { name, price } = req.body;
  if (!name || String(name).trim() === '') {
    return res.status(422).json({ error: 'name required' });
  }

  const item = { 
    id: nextId++, 
    name: String(name).trim(), 
    price: Number(price) || 0 
  };
  items.push(item);
  res.status(201).json(item);
});

// "Where to go next" Extension 1: Admin-only deletion
app.delete('/items/:id', auth, requireRole('admin'), (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const index = items.findIndex(i => i.id === itemId);
  if (index === -1) {
    return res.status(404).json({ error: 'item not found' });
  }
  const deleted = items.splice(index, 1)[0];
  res.json({ message: 'Item deleted', item: deleted });
});

// "Where to go next" Extension 2: Object-level authorization check (IDOR prevention)
// A customer may read ONLY their own orders. Restaurants and Admins can view all orders.
app.get('/orders', auth, (req, res) => {
  if (req.user.role === 'customer') {
    const userOrders = orders.filter(o => o.customerId === req.user.sub);
    return res.json({
      role: req.user.role,
      userOrdersOnly: true,
      orders: userOrders
    });
  }

  // restaurant or admin sees all orders
  res.json({
    role: req.user.role,
    userOrdersOnly: false,
    orders
  });
});

app.get('/orders/:id', auth, (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'order not found' });
  }

  // Object-level check: Customer cannot view other customers' orders!
  if (req.user.role === 'customer' && order.customerId !== req.user.sub) {
    return res.status(403).json({ 
      error: 'forbidden', 
      detail: `IDOR guard: You are customer #${req.user.sub}. You cannot access order #${orderId} belonging to customer #${order.customerId}.`
    });
  }

  res.json(order);
});

app.post('/orders', auth, (req, res) => {
  const { item, total } = req.body;
  if (!item) return res.status(422).json({ error: 'item required' });

  const newOrder = {
    id: nextOrderId++,
    customerId: req.user.sub,
    customerEmail: req.user.email,
    item,
    total: Number(total) || 0,
    status: 'Received'
  };
  orders.push(newOrder);
  res.status(201).json(newOrder);
});

// Reset catalogue state for easy testing
app.post('/api/reset', (req, res) => {
  items = JSON.parse(JSON.stringify(initialItems));
  nextId = 3;
  orders = JSON.parse(JSON.stringify(initialOrders));
  nextOrderId = 103;
  res.json({ message: 'Catalogue & orders reset to defaults' });
});

// Health / status endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', secured: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Secured Catalogue on http://localhost:${PORT}`);
});

