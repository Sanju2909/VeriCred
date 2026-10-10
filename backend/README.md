# Backend API & Authentication Service

RESTful API backend for the **Decentralized Digital Identity and Verifiable Credentials Platform**, built with Node.js, Express, MongoDB (Mongoose), JWT, and asymmetric cryptographic utilities.

---

## 🏛️ Architecture Overview

```text
backend/
├── src/
│   ├── config/
│   │   ├── db.js              # MongoDB Mongoose connection & fallback handling
│   │   └── environment.js     # Environment variables loader & validator
│   ├── controllers/
│   │   ├── authController.js  # Registration, login, logout, profile handlers
│   │   └── userController.js  # User query & role management (Admin)
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT verification & RBAC authorization
│   │   ├── errorHandler.js    # Centralized JSON error format handler
│   │   ├── rateLimiter.js     # Brute-force & API DDoS protection
│   │   ├── requestLogger.js   # PII-redacted request logger
│   │   └── validateRequest.js # express-validator interceptor
│   ├── models/
│   │   ├── User.js            # User accounts, password hashes, DIDs, roles
│   │   ├── IssuerProfile.js   # Institutional profiles & on-chain addresses
│   │   ├── Credential.js      # Off-chain verifiable credentials & signatures
│   │   └── AuditEvent.js      # Security and authorization audit log
│   ├── routes/
│   │   ├── authRoutes.js      # /api/auth
│   │   ├── healthRoutes.js    # /api/health
│   │   ├── userRoutes.js      # /api/users
│   │   └── index.js           # Master router
│   ├── services/
│   │   └── authService.js     # Core business logic for authentication
│   ├── utils/
│   │   ├── apiResponse.js     # Standard response envelope utility
│   │   ├── jwtUtils.js        # HMAC-SHA256 JWT generation and verification
│   │   ├── logger.js          # Sensitive data redaction logger
│   │   └── passwordUtils.js   # bcryptjs password hashing (12 rounds)
│   ├── validators/
│   │   └── authValidators.js  # Input validation & privilege escalation protection
│   └── app.js                 # Express application configuration
├── tests/
│   ├── auth.test.js           # Comprehensive auth, RBAC & validation tests
│   └── health.test.js         # Health endpoint & error handler tests
├── .env.example
├── package.json
├── README.md
└── server.js                  # Server entry point with graceful shutdown
```

---

## 🔒 Security & RBAC Model

### Roles
- **`ADMIN`**: Platform governance. Manages issuer approvals, user roles, and system health.
- **`ISSUER`**: Academic institution / university. Authorized to issue and revoke credentials.
- **`HOLDER`**: Student / Graduate. Stores credentials and presents verifiable QR codes.
- **`VERIFIER`**: Employer / Third party. Verifies cryptographic signatures and on-chain status.

### Privilege Escalation Prevention
Public registration via `POST /api/auth/register` allows **only** `HOLDER` and `VERIFIER` roles. Any attempt to register as `ADMIN` or `ISSUER` is strictly rejected by request validation.

---

## 🚀 Getting Started

### 1. Install Dependencies
```powershell
cd backend
npm.cmd install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Populate `MONGODB_URI` with your MongoDB Atlas connection string.

### 3. Bootstrap Initial Administrator
To create the platform administrator account securely:
```powershell
npm.cmd run seed:admin
```

### 4. Start Development Server
```powershell
npm.cmd run dev
```

### 5. Run Automated Tests
Tests use an isolated in-memory MongoDB runner (`mongodb-memory-server`) and do not require external Atlas credentials:
```powershell
npm.cmd test
```

---

## 📡 API Endpoints (Stage 3A)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Server uptime, environment, and DB status |
| `POST` | `/api/auth/register` | Public | Register new Holder or Verifier account |
| `POST` | `/api/auth/login` | Public | Authenticate user and receive JWT token |
| `POST` | `/api/auth/logout` | Authenticated | Terminate session |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile |
| `GET` | `/api/users` | Admin Only | List users with pagination and role filter |
| `GET` | `/api/users/:id` | Admin / Self | Get detailed user profile |
| `PATCH`| `/api/users/:id/role` | Admin Only | Update user role |

