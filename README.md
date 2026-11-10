# CS543 · Web Services · API Security Tutorial
## CampusEats Secured Catalogue (Backend & Frontend)

This repository contains the complete implementation of the **API Security Tutorial** from **CS543: Web Services** (Dr. Pramit Mazumdar, IIIT Vadodara). It is structured into a dedicated **backend** API service and an interactive **frontend** dashboard.

---

## 📁 Project Architecture

```
api/
├── backend/
│   ├── .env                    # Environment variables (JWT_SECRET, PORT)
│   ├── package.json            # Dependencies: express, jsonwebtoken, bcryptjs, cors, dotenv
│   └── server.js               # Complete secured Express API (Parts 0–7 + Extensions)
│
├── frontend/
│   ├── package.json            # Lightweight server dependencies
│   ├── server.js               # Static frontend server on port 5173
│   └── public/
│       ├── index.html          # Web UI dashboard
│       ├── style.css           # Styling, dark mode, color-coded HTTP statuses
│       └── app.js              # Token management, JWT parsing, API client, live cURL log
│
├── test-tutorial.js            # Automated test runner testing all PDF requirements
├── start-all.js                # One-command runner for both backend & frontend
└── package.json                # Root scripts
```

---

## 🚀 How to Run

### Option 1: Run Both Backend & Frontend Together
From the project root:
```bash
npm start
```
* Or: `node start-all.js`
* Backend API will run at: **http://localhost:3000**
* Frontend UI will run at: **http://localhost:5173**

---

### Option 2: Run Separately in Two Terminals

#### Terminal 1 (Backend):
```bash
cd backend
npm start
```
> Server runs on `http://localhost:3000`

#### Terminal 2 (Frontend):
```bash
cd frontend
npm start
```
> Open your browser at `http://localhost:5173`

---

## 🧪 Automated Verification Script

An automated test script is included that executes every check specified in the PDF tutorial:
```bash
node test-tutorial.js
```

### Verified Checks:
1. **Unauthenticated GET /items** → Returns `401 Unauthorized` ("I don't know who you are").
2. **Bad Credentials POST /login** → Returns `401 Unauthorized` (`bad login`).
3. **Valid Login (Restaurant & Customer)** → Issues signed JWT (`header.payload.signature`).
4. **Authenticated GET /items** → Returns `200 OK` with menu array.
5. **Restaurant POST /items** → Returns `201 Created` and appends dish.
6. **Customer POST /items** → Returns `403 Forbidden` ("I know you, but you cannot do this").
7. **Blank Dish Name Validation** → Returns `422 Unprocessable Entity` ("Validation is separate from security").
8. **Tampered Token Check** → Modifying the payload without knowing `SECRET` produces `401 Invalid Token`.
9. **Object-Level Authorization (IDOR Check)** → Customer cannot access another customer's order (`403 Forbidden`).

---

## 👥 Seeded Demo Accounts

| User | Email | Password | Role | Permissions |
|------|-------|----------|------|-------------|
| **Asha** | `asha@campus.edu` | `customer123` | `customer` | Read catalogue (`GET /items`), read own orders |
| **MealHub** | `mealhub@campus.edu` | `resto123` | `restaurant` | Read catalogue, add dishes (`POST /items`), view all orders |
| **Admin** | `admin@campus.edu` | `admin123` | `admin` | Full access: read/add/delete dishes, view all orders |

---

## 📖 Tutorial Implementation Breakdown

### Part 0: Tools & Setup
- `jsonwebtoken`: `jwt.sign()` for minting signed tokens and `jwt.verify()` for signature validation.
- `bcryptjs`: `bcrypt.hashSync()` for one-way password hashing at startup; `bcrypt.compareSync()` for verifying login attempts.

### Part 1: Storing Passwords Securely
- Never store plaintext passwords. bcrypt produces a salt and one-way cryptographic hash.
- Passwords can never be "decrypted" — only compared via `bcrypt.compareSync()`.

### Part 2: POST /login
- Receives `{ email, password }`.
- Verifies hash; on match, issues a JWT with claims `{ sub: user.id, role: user.role }` signed with `SECRET` and `expiresIn: '1h'`.

### Part 3: Authentication Middleware (`auth`)
- Intercepts requests, extracts `Authorization: Bearer <token>`.
- Calls `jwt.verify(token, SECRET)`. If invalid, tampered, or expired, returns `401 Unauthorized`.
- On success, attaches `req.user` and calls `next()`.

### Part 4: Testing Authentication
- `GET /items` without token → `401 Unauthorized`.
- `GET /items` with valid Bearer token → `200 OK`.

### Part 5: Role Authorization Middleware (`requireRole`)
- `requireRole(...allowed)` checks `allowed.includes(req.user.role)`.
- If role does not match, returns `403 Forbidden`.

### Part 6: Testing Authorization
- Restaurant token → `201 Created`.
- Customer token → `403 Forbidden`.

### Part 7: Security Fundamentals & Checklist
- **401 vs 403 Distinction**: 401 means *unauthenticated* (unknown identity); 403 means *unauthorized* (known identity lacks permission).
- **Tamper Resistance**: Payload tampering breaks the HMAC signature because attacker does not possess `JWT_SECRET`.
- **Validation vs Security**: Input validation (`422 name required`) runs separately from authentication and authorization.
- **Where to go next**:
  - `admin` role with dish deletion capability (`DELETE /items/:id`).
  - Object-level authorization preventing IDOR (Insecure Direct Object Reference) on `/orders/:id`.
  - Secret stored in `.env`.

