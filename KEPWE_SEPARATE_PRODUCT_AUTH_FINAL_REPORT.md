# KEPWE PORTALS: TRUE SEPARATE PRODUCT AUTHENTICATION & ACCESS CONTROL REPORT
**Final Architecture, Database Schemas, Backend Middleware, Attack Tests & Verification Report**

---

## 1. Executive Summary

A true, multi-product workspace authentication, authorization, and isolation system has been engineered and deployed across the KEPWE platform. Product separation is **not merely cosmetic**: it is strictly enforced at the **PostgreSQL database tier (`product_memberships` table)**, the **backend API middleware tier (`requireProductAccess` guard)**, and the **cryptographic session token tier (workspace-scoped JWTs)**.

- **Main KEPWE Login (`/login`)**: Remains a global identity login that redirects to KEPWE Home (`/`) upon completion. It **does NOT** grant blanket access to any individual product workspaces.
- **Dedicated Portals**:
  1. **Customer Portal** (`/customer-portal/login`, `/customer-portal/signup`, `/customer-portal`)
  2. **Sales CRM** (`/crm/login`, `/crm/signup`, `/crm`)
  3. **IndexPilot** (`/indexpilot/login`, `/indexpilot/signup`, `/app/dashboard`)
  4. **Kepwe Ledger** (`/ledger/login`, `/ledger/signup`, `/ledger/app`)
  5. **Kepwe Credit** (`/credit/login`, `/credit/signup`, `/credit/workspace`)
  6. **Kepwe Quant** (`/quant/login`, `/quant/signup`, `/quant/dashboard`)
- **Customer Portal ≠ Ledger Workspace**: The Customer Portal and Kepwe Ledger are strictly separated at the database, routing, and UI levels. Customer Portal users cannot access Ledger APIs, and Ledger users cannot access Customer Portal APIs.
- **Portals Dropdown Navigation**: Directly routes to the product dashboard if the authenticated session already possesses valid database membership for that product; otherwise, opens that product's dedicated authentication entry point (`/[product]/login`).
- **Cross-Product Access Defense**: If an authenticated user enters an unauthorized product workspace, the system rejects them with HTTP 403 `PRODUCT_ACCESS_DENIED` (API level) and displays the dedicated `ProductAccessRequired` interface (UI level) with clear options to create an account for that workspace or switch accounts.
- **Test Suite Results**: 100% of all backend test suites passed, including the new `separate-product-auth.test.js` attack test suite. Frontend production build passed with 0 errors.

---

## 2. Product Membership & Auth Architecture

```
                                  +-----------------------+
                                  |   users (Global DB)   |
                                  |  id, email, password  |
                                  +-----------+-----------+
                                              |
                          1-to-many explicit memberships
                                              |
                                              v
                             +---------------------------------+
                             |    product_memberships Table    |
                             |  user_id + product (UNIQUE)     |
                             |  role, status, company_id       |
                             +----------------+----------------+
                                              |
                  +---------------------------+---------------------------+
                  |                           |                           |
                  v                           v                           v
         [product: 'ledger']         [product: 'quant']          [product: 'crm']
           Ledger Workspace            Quant Workspace               Sales CRM
         /api/ledger/* (200)         /api/quant/* (200)          /api/leads (200)
         /api/quant/* (403)          /api/ledger/* (403)         /api/portal/* (403)
```

### Key Architectural Invariants:
1. **User Identity vs. Product Authorization**: A user account in `users` represents an overall identity. Possession of a `users` record grants **zero automatic access** to any of the 6 product workspaces.
2. **Explicit Database Authorization**: Access to any product workspace requires an active record in `product_memberships` where `user_id = $userId` AND `product = $canonicalProduct` AND `status = 'ACTIVE'`.
3. **Defense Against Token Spoofing**: While JWTs carry the `product` workspace scope and cached `memberships` list, backend API route guards **validate directly against PostgreSQL via `hasProductAccess(userId, product)`** to guarantee that manually edited or forged JWT claims cannot bypass authorization.
4. **Defense Against URL Parameter Manipulation**: Query string modifications (such as changing `?product=ledger` to `?product=quant`) are strictly ignored by backend authorization guards. The database membership is the sole authority.
5. **Scoped Email OTP Challenge**: During registration or login via Email OTP, the challenge payload is cryptographically bound to the target product. Verifying a Quant OTP only provisions or activates a Quant membership; it cannot grant access to Ledger, CRM, or Customer Portal.

---

## 3. Database Schema & Migrations

The database migration is located in `backend/db/product_memberships_schema.sql` and automatically applied upon server startup in `backend/src/config/db.js`:

```sql
CREATE TABLE IF NOT EXISTS product_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product VARCHAR(50) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  company_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT unique_user_product UNIQUE (user_id, product)
);

CREATE INDEX IF NOT EXISTS idx_product_memberships_user 
  ON product_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_product_memberships_product 
  ON product_memberships(product);

CREATE INDEX IF NOT EXISTS idx_product_memberships_status 
  ON product_memberships(status);
```

### Canonical Product Keys:
- `customer-portal` (aliases: `portal`, `customer`)
- `crm` (alias: `sales-crm`)
- `indexpilot` (aliases: `algo`, `trading`)
- `ledger` (alias: `accounting`)
- `credit` (alias: `loans`)
- `quant` (alias: `quant-finance`)

---

## 4. Backend Authorization Middleware & APIs

### `requireProductAccess(product)` Middleware (`backend/src/middleware/product-auth.js`)
```javascript
export function requireProductAccess(productName) {
  const canonicalProduct = canonicalizeProduct(productName);
  return async (req, res, next) => {
    // 1. Enforce authentication first (401 if missing)
    if (!req.userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'You must be signed in to access this product workspace.',
      });
    }

    // 2. Platform admins retain administrative oversight
    if (req.user?.role === 'admin') {
      req.activeProduct = canonicalProduct;
      return next();
    }

    // 3. Database-backed verification (zero trust in client claims)
    const allowed = await hasProductAccess(req.userId, canonicalProduct);
    if (!allowed) {
      return res.status(403).json({
        error: 'PRODUCT_ACCESS_DENIED',
        message: `You do not have access to the ${canonicalProduct} workspace.`,
        requiredProduct: canonicalProduct,
      });
    }

    req.activeProduct = canonicalProduct;
    next();
  };
}
```

### Protected API Endpoints:
| Product | Guarded API Routes | Middleware Applied |
| :--- | :--- | :--- |
| **Customer Portal** | `/api/portal/*`, `/api/customer-portal/*` | `requireProductAccess('customer-portal')` |
| **Sales CRM** | `/api/crm/*`, `/api/leads/*` (management) | `requireProductAccess('crm')` |
| **IndexPilot** | `/api/algo/*`, `/api/indexpilot/*`, `/api/broker/*` | `requireProductAccess('indexpilot')` |
| **Kepwe Ledger** | `/api/ledger/*`, `/api/v1/*` | `requireProductAccess('ledger')` |
| **Kepwe Credit** | `/api/credit/*` | `requireProductAccess('credit')` |
| **Kepwe Quant** | `/api/quant/*` | `requireProductAccess('quant')` |

---

## 5. Frontend Routes & Workspace Navigation

### 1. Dedicated Authentication Routes:
- `/customer-portal/login` & `/customer-portal/signup`
- `/crm/login` & `/crm/signup`
- `/indexpilot/login` & `/indexpilot/signup`
- `/ledger/login` & `/ledger/signup`
- `/credit/login` & `/credit/signup`
- `/quant/login` & `/quant/signup`
- `/login` & `/signup` (Common KEPWE Login)

### 2. Destination Workspaces:
- Customer Portal: `/customer-portal` (and `/portal/onboarding-checklist`)
- Sales CRM: `/crm`
- IndexPilot: `/app/dashboard` (and trading desk routes `/app/*`)
- Kepwe Ledger: `/ledger/app`
- Kepwe Credit: `/credit/workspace`
- Kepwe Quant: `/quant/dashboard`
- Common KEPWE: `/` (Home)

### 3. Portals Dropdown Logic (`Header.jsx`):
```javascript
const getPortalLink = (productKey, destination) => {
  if (isLoggedIn && Array.isArray(authState?.user?.memberships) && authState.user.memberships.includes(productKey)) {
    return destination;
  }
  return `/${productKey}/login`;
};
```

---

## 6. Automated Attack Tests & Verification Suite

The dedicated test suite `backend/test/separate-product-auth.test.js` executed 7 rigorous security tests against a running HTTP server:

```
================================================================
  KEPWE PORTALS: SEPARATE PRODUCT AUTHENTICATION & ACCESS CONTROL  
================================================================

[TEST 1] Setting up distinct isolated users in database...
  ✓ User A (Ledger only) created
  ✓ User B (Quant only) created
  ✓ User C (CRM only) created
  ✓ User D (Common KEPWE only) created
  ✓ Database product_memberships table verified: strict product isolation confirmed.

[TEST 2] Generating workspace-scoped tokens...
  ✓ Generated valid cryptographic JWT access tokens.

[TEST 3] Authorized workspace access tests...
  ✓ User A successfully accessed Ledger Workspace dashboard (HTTP 200).
  ✓ User B successfully accessed Quant Workspace dashboard (HTTP 200).
  ✓ User C successfully accessed Sales CRM leads (HTTP 200).

[TEST 4] Cross-Product Access Denial (Security Invariants)...
  ✓ ATTACK BLOCKED: User A (Ledger token) rejected from Quant API (HTTP 403 PRODUCT_ACCESS_DENIED).
  ✓ ATTACK BLOCKED: User B (Quant token) rejected from Ledger API (HTTP 403 PRODUCT_ACCESS_DENIED).
  ✓ ATTACK BLOCKED: User C (CRM token) rejected from Customer Portal API (HTTP 403 PRODUCT_ACCESS_DENIED).
  ✓ ATTACK BLOCKED: User A (Ledger token) rejected from Customer Portal API (HTTP 403 PRODUCT_ACCESS_DENIED).
  ✓ ATTACK BLOCKED: User B (Quant token) rejected from Credit API (HTTP 403 PRODUCT_ACCESS_DENIED).
  ✓ Main KEPWE Login isolation verified: User D has no automatic product access.

[TEST 5] Tampering Defense: Spoofed JWT Product Claim & Query Params...
  ✓ TAMPER BLOCKED: Manually forged JWT product claim rejected by backend DB verification (HTTP 403).
  ✓ TAMPER BLOCKED: Query parameter manipulation ?product=quant rejected (HTTP 403).

[TEST 6] Product-Specific Email OTP Challenge & Signup...
  ✓ Scoped Quant signup OTP requested successfully.
  ✓ Quant account created via product OTP. Verified user has ONLY quant membership.
  ✓ Verified: New user accesses Quant (HTTP 200), denied from Ledger (HTTP 403).

[TEST 7] Unauthenticated Request Testing...
  ✓ All protected product endpoints return HTTP 401 when unauthenticated.

================================================================
  ALL SEPARATE PRODUCT AUTH & ACCESS CONTROL TESTS PASSED!     
================================================================
```

### Full Backend Suite (`npm test`):
- `algo-engine.test.js`: **PASSED**
- `ledger.test.js`: **PASSED**
- `accounting-engine-production.test.js`: **ALL 14 TESTS PASSED (100% ACCURACY)**
- `comprehensive-audit-e2e.test.js`: **ALL 25-STEP PRODUCTION FLOW & 7 ADAPTERS PASSED**
- `persistence-and-invariants.test.js`: **ALL PERSISTENCE, MULTI-TENANT & INVARIANT TESTS PASSED**
- `runtime-smoke-and-security.test.js`: **ALL 5 RUNTIME HTTP SMOKE & SECURITY TESTS PASSED**
- `separate-product-auth.test.js`: **ALL 7 SEPARATE PRODUCT AUTH & ACCESS CONTROL TESTS PASSED**

### Frontend Production Build (`npm run build`):
- Modules transformed: 1,981 modules
- Output bundle: `dist/index.html` (1.01 kB), `dist/assets/index-*.js` (3,484 kB), `dist/assets/index-*.css` (366 kB)
- Status: **0 errors, Build Successful**

---

## 7. Files Changed Summary

1. `backend/db/product_memberships_schema.sql` (NEW): DDL schema for user-to-product workspace memberships with indexes and unique constraints.
2. `backend/src/config/db.js`: Added automatic execution of `product_memberships_schema.sql` on database connection.
3. `backend/src/services/product-membership.service.js` (NEW): Canonicalization, membership CRUD, database access verification, and login audit tracking.
4. `backend/src/middleware/product-auth.js` (NEW): `requireProductAccess(product)` middleware with database verification and 403 `PRODUCT_ACCESS_DENIED` enforcement.
5. `backend/src/middleware/auth.js`: Integrated workspace-scoped product claim, memberships export, and secret getter.
6. `backend/src/services/auth.service.js`: Added product parameter handling to login, registration, and user profile serialization.
7. `backend/src/services/auth.session.service.js`: Added user memberships to session profiles.
8. `backend/src/routes/auth.routes.js`: Product-scoped email OTP challenge, product signup verification, membership activation endpoint, and product access checking API.
9. `backend/src/routes/portal.routes.js`: Path-scoped Customer Portal access middleware (`['/portal', '/customer-portal']`).
10. `backend/src/routes/algo.routes.js`: Path-scoped IndexPilot access middleware (`['/algo', '/broker', '/indexpilot']`).
11. `backend/src/routes/ledger.routes.js`: Path-scoped Ledger access middleware (`/ledger`).
12. `backend/src/routes/v1/ledger-v1.routes.js`: Enforced Ledger product access across accounting engine endpoints.
13. `backend/src/routes/credit.routes.js` (NEW): Dedicated Credit product router with `requireProductAccess('credit')`.
14. `backend/src/routes/quant.routes.js` (NEW): Dedicated Quant product router with `requireProductAccess('quant')`.
15. `backend/src/app.js`: Cleaned route mountings for product routers.
16. `src/context/AppContext.jsx`: Added `memberships` state, updated login/signup with product context, and implemented `hasProductAccess(product)` helper.
17. `src/pages/LoginPage.jsx`: Multi-product detection from URL/props, product branding (headings, subheads, tags), product-specific signup links, and scoped OTP submission.
18. `src/pages/SignupPage.jsx`: Multi-product detection, product branding, product-specific login links, and scoped registration OTP submission.
19. `src/components/common/Header.jsx`: Implemented intelligent `getPortalLink(productKey, destination)` for Desktop and Mobile Portals dropdowns.
20. `src/App.jsx`: Added `ProductAccessRequired` interface, updated all 6 product route guards, added routes for each product's `/login` and `/signup`, and mounted `/credit/workspace`.
21. `backend/test/separate-product-auth.test.js` (NEW): Comprehensive attack, tampering, and isolation test suite.
22. `backend/package.json`: Included `separate-product-auth.test.js` in standard `npm test`.

---

## 8. Verification & Delivery Status

- [x] Main KEPWE Login is separate from product logins
- [x] Main KEPWE Login redirects to KEPWE Home (`/`)
- [x] Customer Portal has its own login (`/customer-portal/login`) & signup (`/customer-portal/signup`)
- [x] Sales CRM has its own login (`/crm/login`) & signup (`/crm/signup`)
- [x] IndexPilot has its own login (`/indexpilot/login`) & signup (`/indexpilot/signup`)
- [x] Kepwe Ledger has its own login (`/ledger/login`) & signup (`/ledger/signup`)
- [x] Kepwe Credit has its own login (`/credit/login`) & signup (`/credit/signup`)
- [x] Kepwe Quant has its own login (`/quant/login`) & signup (`/quant/signup`)
- [x] Each login page features the official KEPWE logo, `#214ECF` styling, and product-specific branding
- [x] Each product has distinct database representation in `product_memberships`
- [x] Backend enforces authorization via `requireProductAccess` (returns HTTP 403 `PRODUCT_ACCESS_DENIED`)
- [x] Customer Portal ≠ Kepwe Ledger (different routes, memberships, dashboards)
- [x] Selecting a portal from the menu opens its LOGIN first when unauthorized
- [x] Successful product authentication opens only that product's dashboard
- [x] URL and JWT tampering cannot bypass product authorization
- [x] Cross-product attacks return 403
- [x] Existing multi-tenant isolation, OTP security, profile photos, and accounting engine invariants preserved
- [x] All automated tests pass (100%)
- [x] Frontend production build passes (100%)
