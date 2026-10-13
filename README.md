# 🥖 Bread Bar API

[![CI](https://github.com/Bothokakula/bread-bar-api/actions/workflows/ci.yml/badge.svg)](https://github.com/Bothokakula/bread-bar-api/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socketdotio&logoColor=white)

A secure REST API and real-time backend for **Bread Bar**, a food business with a customer ordering app and a staff management app. It handles accounts, menu, stock, orders, delivery areas, promotions, payments, reviews, loyalty points, reports and live order updates.

Built as part of a **Work-Integrated Learning (WIL) project (INSY7315)** at The IIE's Varsity College, where student teams build software for a real client.

## 👤 My role

Our team **Alpha Devs** (Wavhudi, Kim, Karabo, Tshego and me) split Task 2 by area. **I owned the back end and the database:**

- Designed the **MongoDB data model** (11 Mongoose models) and the **REST API** (10 route groups)
- Implemented **authentication and security**:
  - two isolated JWT systems for customers and staff
  - refresh-token rotation with reuse detection
  - bcrypt hashing, account lockout and rate limiting
  - RBAC with a permission map, Zod validation and audit logging
- Built the **order workflow**:
  - a state machine with legal transitions only
  - server-side pricing in cents and promotion maths
  - all-or-nothing stock deduction per recipe, plus loyalty points
- Added **real-time updates** with Socket.IO rooms per role (kitchen, customer, driver, managers)
- Wrote **39 automated tests** (unit, HTTP security tests with Supertest, and integration tests on an in-memory MongoDB)

The front-end apps and the CI/CD pipeline were built by teammates. The pages in `public/` are a small sign-in demo for testing the API.

## Highlights

- **Security mapped to requirements:** each non-functional security requirement from the design phase maps to its implementation (see the table in section 4).
- **The client can't tamper with prices:** totals are always recalculated on the server from the menu, promotions and delivery fees.
- **Customer data isolation:** a customer requesting another customer's order gets a `404`, and the customer ID always comes from the token.
- **Clean layering:** routes → controllers → services → models, with a central error handler that never leaks stack traces.

---

## 1. Two separate login systems

| | Customer Mobile App | Business Management App (owner & staff) |
|---|---|---|
| Base URL | `/api/customer/auth` | `/api/staff/auth` |
| Database collection | `customers` | `staffs` (completely separate) |
| Register with | name, email, password (phone optional) | **invite code** + name, email, password, **6-digit PIN** |
| Log in with | email + password | email + password + **staff PIN** |
| JWT signed with | `JWT_CUSTOMER_SECRET`, audience `breadbar-customer-app` | `JWT_STAFF_SECRET`, audience `breadbar-business-app` |
| Session length | 15-min access token, 30-day refresh token | 15-min access token, 12-hour refresh token (one shift) |

Because the two token types use different secrets **and** audiences, a customer token is
rejected by every staff route, even if someone edits the role inside it.

## 2. How staff access is kept inside the business

Three secrets that only Bread Bar has:

1. **Business Setup Key (owner only).** The owner account is created once with
   `POST /api/staff/auth/setup-owner`, which needs `BUSINESS_SETUP_KEY` from the server's
   environment variables. A unique database index guarantees only one owner can ever exist.
   Rotate or remove the key after setup.
2. **One-time invite code (every employee).** The owner/manager generates a code like
   `BB-7KQ2-M9XD-4PWT` for a specific email and role, then hands it to the employee in person.
   The code works **once**, **only with that email**, **expires in 48 hours**, and only its
   SHA-256 hash is stored. The employee's role comes from the invite, never from the request.
3. **Personal staff PIN (every login).** Each staff member chooses a 6-digit PIN
   (weak PINs like `123456` or `000000` are refused). Login needs email + password + PIN,
   so a leaked password alone does not open the business app. The error never says which
   of the three was wrong.

Who may invite or deactivate whom:

| Actor | Can invite / deactivate |
|---|---|
| Owner | kitchen, delivery, manager, admin |
| System Admin | kitchen, delivery, manager |
| Manager | kitchen, delivery |
| Kitchen / Delivery | nobody |

Nobody can create or deactivate the owner. Deactivating staff logs them out of every device immediately.

### Staff onboarding flow

```
Owner (once):  POST /api/staff/auth/setup-owner   { setupKey, name, email, password, pin }
Owner:         POST /api/staff/invites            { email: "thabo@...", role: "kitchen" }
               → returns inviteCode (shown ONCE) → give to Thabo in person
Thabo:         POST /api/staff/auth/register      { inviteCode, name, email, password, pin }
Thabo (daily): POST /api/staff/auth/login         { email, password, pin }
```

## 3. Endpoints

**Customer auth** – `/api/customer/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | public, rate-limited | Create customer account |
| POST | `/login` | public, rate-limited | Log in |
| POST | `/refresh` | refresh token | Get new tokens (rotation) |
| POST | `/logout` | refresh token | End this session |
| POST | `/logout-all` | customer JWT | End all sessions |
| GET | `/me` | customer JWT | Profile + loyalty points |

**Staff auth** – `/api/staff/auth`: `/setup-owner`, `/register`, `/login`, `/refresh`, `/logout`, `/logout-all`, `/me` (same pattern).

**Staff management** – `/api/staff` (staff JWT required)

| Method | Path | Permission |
|---|---|---|
| POST | `/invites` | `staff:invite` |
| GET | `/` | `staff:read` |
| PATCH | `/:id/deactivate` | `staff:deactivate` |
| GET | `/audit-logs?page=&limit=` | `audit:read` |

**Orders** – `/api/orders` (examples of protected routes)

| Method | Path | Who |
|---|---|---|
| POST | `/` | Customer – prices & totals calculated on the server |
| GET | `/mine` | Customer – own orders only |
| GET | `/` | Kitchen, manager, owner |
| GET | `/deliveries/assigned` | Delivery staff – their deliveries only |
| GET | `/:id` | Customer (own order only) or staff with access |
| PATCH | `/:id/status` | Staff – each transition needs its own permission |
| POST | `/:id/cancel` | Customer – only while the order is still `Received`. Stock is put back. |

Status changes follow the state diagram: `Received → Preparing → Ready → OutForDelivery/Collected → Completed`,
with `Cancelled` allowed from Received or Preparing. Illegal jumps return `409`.
A customer cannot cancel once the kitchen has moved the order to `Preparing`.
Cancelling from `Received` returns the ingredients. Cancelling from `Preparing` does not.

`POST /` body is `{ orderType, items: [{ menuItemId, quantity }], paymentMethod, paymentReference?, deliveryAddress? }`.
`paymentMethod` is `cash`, `card`, or `eft`. Do not send prices, totals, or card numbers.
Cash is recorded as `pay_on_collection`. Card and EFT are `pending`, with an optional reference.
The server prices each line from the menu, applies the single best active promotion, then adds the delivery fee.

Loyalty is **1 point per R10** of `totalAmount`, added once when the status becomes `Completed`.

**Menu** – `/api/menu`

| Method | Path | Who |
|---|---|---|
| GET | `/?category=&q=` | Public – available items only |
| GET | `/manage` | `menu:manage` – includes hidden items and recipes |
| POST | `/` | `menu:manage` |
| PATCH | `/:id` | `menu:manage` |
| PATCH | `/:id/availability` | `menu:manage` – body `{ isAvailable }` |
| DELETE | `/:id` | `menu:manage` – deletes the item, or marks it unavailable if an order already uses it |

**Stock** – `/api/stock` (`stock:manage`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List items. Each row includes `isLow` when quantity is at or below the reorder level. |
| POST | `/` | Create `{ name, unit, quantityOnHand, reorderLevel }` |
| PATCH | `/:id` | Update a stock item |

Placing an order deducts each menu item's recipe. If any ingredient is short, nothing is deducted and the API returns `409 INSUFFICIENT_STOCK`.

**Delivery areas** – `/api/delivery-areas`

| Method | Path | Who |
|---|---|---|
| GET | `/` | Public – active suburbs and fees |
| GET | `/manage` | `delivery_areas:manage` |
| POST | `/` | `delivery_areas:manage` – `{ suburb, fee }` |
| PATCH | `/:id` | `delivery_areas:manage` |
| DELETE | `/:id` | `delivery_areas:manage` – hides the suburb (`isActive: false`) |

**Promotions** – `/api/promotions`

| Method | Path | Who |
|---|---|---|
| GET | `/active` | Public – promotions that are active right now |
| GET | `/` | `promotions:manage` |
| POST | `/` | `promotions:manage` – `discountType` is `percent` or `fixed` |
| PATCH | `/:id` | `promotions:manage` |
| DELETE | `/:id` | `promotions:manage` – sets `isActive` to false |

**Reviews** – `/api/reviews`

| Method | Path | Who |
|---|---|---|
| GET | `/` | Public – latest 20 reviews (name, rating, comment) |
| POST | `/` | Customer – `{ orderId, rating, comment? }` and only for their own completed order |

**Reports** – `/api/reports` (`reports:read`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard` | Today's completed-order count, sales total, and best sellers |
| GET | `/sales?period=daily\|weekly\|monthly` | Completed sales grouped by day (today, last 7 days, or last 30 days) |

Cancelled orders are excluded. Days use the `Africa/Johannesburg` timezone.

**Live updates (Socket.IO)**

Connect with the access token: `io(url, { auth: { token } })`.
Rooms are assigned from the role on the account: kitchen and managers join `kitchen`, each customer joins `customer:<id>`, each driver joins `delivery:<id>`, and managers join `managers`.

| Event | Who receives it |
|---|---|
| `order:created` | Kitchen |
| `order:updated` | Kitchen, that customer, and the assigned driver |
| `stock:low` | Managers |
| `menu:updated` | Every connected client (menu, promotion, or delivery-area change) |

Error format for every failure:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Please check the highlighted fields",
             "details": [{ "field": "pin", "message": "PIN must be exactly 6 digits" }] } }
```

## 4. Security features mapped to the Task 1 NFRs

| NFR | Implementation |
|---|---|
| NFR-S01 Authentication | bcrypt (12 rounds) for passwords and PINs; short-lived JWT access tokens; opaque refresh tokens stored as hashes with rotation and stolen-token (reuse) detection; account lockout after 5 failures for 15 min; equal-time responses for unknown emails |
| NFR-S02 RBAC | `config/roles.js` permission map; `requirePermission()` middleware; role read from the database on every request, not trusted from the token |
| NFR-S03 Data in transit | Helmet HSTS (1 year); TLS terminated at the AWS load balancer; `Cache-Control: no-store` |
| NFR-S04 Input validation | Zod schemas on every body/params/query; `.strict()` rejects unknown fields (blocks `role: "owner"` mass assignment); NoSQL-operator and prototype-pollution stripping; 10 kb body limit |
| NFR-S05 XSS | Strict input formats (names, IDs, codes); security headers via Helmet; React escaping on the frontend |
| NFR-S06 Customer data isolation | Ownership checks – another customer's order returns 404; `customerId` always comes from the token |
| NFR-S07 / NFR-DI01 Payment integrity | The client cannot send prices. Totals are calculated in cents from menu prices, the best active promotion, and the delivery-area fee. |
| NFR-R03 Error handling | Central handler; no stack traces or DB messages leave the server |
| NFR-AM01 Audit | Owner setup, staff registration, logins (incl. failures), invites and deactivations are logged with IP and user agent |
| Brute force / API abuse | Rate limits: 300 req/15 min general, 10 login attempts/15 min, 5 setup attempts/hour |

Sensitive fields (`passwordHash`, `pinHash`, `tokenVersion`, lockout counters) are
`select: false` and also stripped by `toJSON`, so they can't leak in responses.

## 5. Storing tokens in the apps

- **Customer app (React Native):** store the refresh token in `expo-secure-store`
  (Keychain / Keystore), never in AsyncStorage. Keep the access token in memory.
- **Business dashboard (React web):** keep the access token in memory only. When any
  request returns `TOKEN_EXPIRED`, call `/refresh` once and retry.
- On `SESSION_REVOKED` or `INVALID_REFRESH_TOKEN`, send the user back to the login screen.

## 6. Running it

```bash
npm install
cp .env.example .env     # fill in the values (see the comments in the file)
npm run dev              # starts on http://localhost:5000
npm run seed             # optional sample menu, stock, Eden Park delivery, and a promotion
npm test                 # security tests plus shop tests (in-memory MongoDB, no Atlas)
```

## 7. Project structure

```
src/
  config/       env.js, db.js, roles.js (RBAC), delivery.js (fees from the database)
  models/       Customer, Staff, StaffInvite, RefreshToken, AuditLog, MenuItem, Order, StockItem, DeliveryArea, Promotion, Review
  middleware/   authenticate, authorize, validate, sanitize, rateLimiters, errorHandler
  validators/   schemas.js (Zod)
  payments/     cash, card, and EFT strategies
  services/     customerAuth, staffAuth, staffManagement, session, order, orderWorkflow, menu, stock, promotion, review, report, orderEvents
  controllers/  thin HTTP handlers
  routes/       customerAuth, staffAuth, staffManagement, order, menu, stock, delivery areas, promotions, reviews, reports
  realtime/     Socket.IO gateway
  utils/        tokens (JWT), password (bcrypt), crypto, lockout, audit, money, loyalty, AppError
scripts/        seed.js
tests/          unit + HTTP security tests, plus shop integration tests
```
