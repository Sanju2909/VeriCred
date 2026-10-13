# Frontend Client — VeriCred Platform

Responsive Single Page Application (SPA) for the **Decentralized Digital Identity and Verifiable Credentials Platform**, built with React 18, Vite, React Router 6, and modern CSS3.

---

## 🏛️ Application Architecture

```text
frontend/
├── src/
│   ├── components/
│   │   ├── Alert.jsx             # Reusable error, success, and warning banners
│   │   ├── DashboardLayout.jsx   # Role-specific dashboard shell wrapper
│   │   ├── Footer.jsx            # Academic project metadata footer
│   │   ├── LoadingSpinner.jsx    # Accessible animated loader
│   │   ├── Modal.jsx             # Accessible modal dialog (QR & JSON views)
│   │   ├── Navbar.jsx            # Top navigation & session header
│   │   ├── ProtectedRoute.jsx    # Role-based route guard
│   │   ├── Sidebar.jsx           # Dashboard sidebar navigation
│   │   └── StatusBadge.jsx       # Multi-state badge (Valid, Revoked, Expired, Roles)
│   ├── context/
│   │   └── AuthContext.jsx       # Session management & user profile state
│   ├── pages/
│   │   ├── AdminDashboard.jsx    # Platform governance & user role directory
│   │   ├── Home.jsx              # Landing page with instant verification lookup
│   │   ├── IssuerDashboard.jsx   # Credential issuance, registry & revocation controls
│   │   ├── Login.jsx             # Login with demo quick-fill helpers
│   │   ├── NotFound.jsx          # 404 handler
│   │   ├── Register.jsx          # Student & Employer registration
│   │   ├── StudentVault.jsx      # Digital wallet, QR code sharing & JSON export
│   │   └── VerifyPortal.jsx      # Multi-tier cryptographic & on-chain verification
│   ├── services/
│   │   └── api.js                # Centralized Fetch API client for backend
│   ├── App.jsx                   # Master routing configuration
│   ├── index.css                 # Navy/Indigo design system & responsive styling
│   └── main.jsx                  # React DOM root entry
├── index.html                    # HTML5 entry with Inter font
├── package.json
├── README.md
└── vite.config.js                # Vite development server & bundler config
```

---

## 🚀 Available Scripts

### 1. Install Dependencies
```powershell
cd frontend
npm.cmd install
```

### 2. Run Development Server
```powershell
npm.cmd run dev
```
Starts the Vite dev server on `http://localhost:5173`.

### 3. Build Production Bundle
```powershell
npm.cmd run build
```
Generates an optimized, minified production distribution in `frontend/dist/`.

### 4. Preview Production Build
```powershell
npm.cmd run preview
```

---

## ⚙️ Environment Variables

Configuration is loaded from `frontend/.env` (or `.env.example`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Base URL of the backend REST API |
| `VITE_BLOCKCHAIN_NETWORK_NAME` | `Hardhat Localhost` | Display name of the active EVM network |
| `VITE_CHAIN_ID` | `31337` | EVM Chain ID |

---

## 🔒 Security & Role-Based Access Control

- **Client-side Non-tampering**: Role checks in `ProtectedRoute.jsx` manage navigation and view visibility, while every data mutation and query is enforced cryptographically and at the database level by the Express backend.
- **Zero Key Exposure**: Private signing keys are never loaded into frontend bundles, `localStorage`, or browser session state.

