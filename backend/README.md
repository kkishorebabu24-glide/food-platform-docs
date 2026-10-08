# Society Food Platform — Backend API (`v1.2.1`)

> High-throughput asynchronous REST & WebSocket API built with **FastAPI**, **SQLAlchemy ORM**, **PostgreSQL**, and **Redis**, engineered for hyper-local apartment food sharing.

---

## 1. System Features & Status

| Module | Status | Description |
| :--- | :---: | :--- |
| **Auth & RBAC Security** | 🟢 Complete | Role-safe JWT tokens, Bcrypt hashing, cryptographic OTP, rate-limiting, and demotion protection for `resident`, `partner`, `admin`, `super_admin`. |
| **Partner Management** | 🟢 Complete | Home chef onboarding, kitchen profile customization, open/closed store toggle (`PATCH /sellers/me/open`), multi-photo uploads. |
| **Menu & Batches** | 🟢 Complete | Dish CRUD, portion inventory steppers, spice level tagging, auto-disable at 0 stock, duplicate batch cloning. |
| **Order Processing** | 🟢 Complete | Lifecycle state machine (`pending` → `accepted` → `preparing` → `ready` → `dispatched` → `delivered`), self-order guards, in-flight price concurrency checks. |
| **Direct P2PM UPI & SaaS Pass**| 🟢 Complete | Peer-to-peer bank settlements, UTR submission/capture, 50 free orders quota pass, and ₹5/order platform maintenance fee wallet. |
| **Admin & Super Admin** | 🟢 Complete | Multi-society governance, chef application approvals queue, member directory toggling, refund audits, and GMV analytics. |
| **Culinary Matching Engine** | 🟢 Complete | Cravings-to-chef compatibility scoring ($0-100\%$) with strict pure-vegetarian dietary shielding. |
| **WebSockets & Push** | 🟢 Complete | Sub-millisecond real-time order status and door delivery dispatch broadcasts (`/ws/orders/{id}`). |
| **Asynchronous Notifications** | 🟢 Complete | Background email dispatch (`aiosmtplib` BackgroundTasks) for orders, OTP verification, and status alerts. |
| **Double-Entry Ledger** | 🟢 Complete | Audit-compliant accounting ledger (`LedgerEntry`), partner balance tracking, and maintenance credits. |

---

## 2. API Endpoints Reference

### 🔐 Authentication & Session

- `POST /api/v1/auth/login` — Password authentication; respects DB role and protects admins from demotion.
- `POST /api/v1/auth/register` — Account registration with role selection (`resident` or `partner`).
- `POST /api/v1/auth/refresh` — Exchange refresh token for fresh access token.
- `GET  /api/v1/auth/me` — Retrieve active authenticated user profile.
- `POST /api/v1/auth/otp/request` — Request cryptographic 6-digit OTP code (rate-limited).
- `POST /api/v1/auth/otp/verify` — Verify OTP code and provision resident session.
- `POST /api/v1/auth/switch-role` — Session-based workspace persona switching.

### 🍳 Partner & Home Chef APIs

- `GET  /api/v1/sellers/me` — Fetch current chef kitchen profile, bio, photos, and UPI details.
- `PUT  /api/v1/sellers/me` — Update chef bio, specialties, and Direct UPI settlement settings.
- `PATCH /api/v1/sellers/me/open` — Toggle kitchen open/closed operational status.
- `POST /api/v1/sellers/photos` — Upload multiple high-resolution kitchen prep photos.
- `DELETE /api/v1/sellers/photos` — Remove a photo from chef showcase gallery.
- `POST /api/v1/sellers/banner` — Update kitchen storefront cover banner.

### 🍽️ Menu & Batch Inventory

- `GET  /api/v1/menus/sellers/{id}` — Fetch published menu for a specific home chef.
- `POST /api/v1/menus/` — Create new dish or scheduled pre-order batch.
- `PUT  /api/v1/menus/{id}` — Update dish details, price, spice level, or description.
- `DELETE /api/v1/menus/{id}` — Remove dish from catalog.
- `PATCH /api/v1/menus/{id}/availability` — Toggle dish in-stock / sold-out state.
- `PATCH /api/v1/menus/{id}/portions` — Atomic portion stepper increment/decrement.
- `POST /api/v1/menus/{id}/image` — Upload dish presentation photograph.

### 📦 Orders & Fulfillment

- `POST /api/v1/orders/` — Place order; enforces portion decrement, self-order block, and in-flight price checks.
- `GET  /api/v1/orders/` — List orders for active resident or partner with pagination.
- `GET  /api/v1/orders/{id}` — Order details protected by BOLA/IDOR authorization guards.
- `PUT  /api/v1/orders/{id}/status` — Advance order state (`accepted`, `cooking`, `ready`, `dispatched`, `delivered`).

### 💳 Direct UPI & SaaS Pass Ledger

- `GET  /api/v1/payments/balance` — Partner total earned and available wallet balance.
- `GET  /api/v1/payments/maintenance-status` — SaaS pass quota (remaining free orders out of 50).
- `GET  /api/v1/payments/ledger` — Transaction history and ₹5/order maintenance deduction ledger.
- `POST /api/v1/payments/topup` — Recharge maintenance wallet via UPI UTR confirmation.
- `POST /api/v1/payments/orders/{id}/confirm` — Chef confirms receipt of resident UPI transfer.

### 🛡️ Society Admin Console

- `GET  /api/v1/admin/analytics` — Platform GMV, total volume, active kitchens, and pending approvals.
- `GET  /api/v1/admin/sellers/pending` — Queue of chef partner applicants awaiting verification.
- `POST /api/v1/admin/sellers/{id}/approve` — Approve chef application and grant partner permissions.
- `POST /api/v1/admin/sellers/{id}/reject` — Reject applicant with reason feedback.
- `GET  /api/v1/admin/residents` — Member directory listing apartment units and account states.
- `PATCH /api/v1/admin/users/{id}/status` — Deactivate or reactivate a resident/partner account.
- `POST /api/v1/admin/orders/{id}/refund` — Execute order refund and record dispute resolution in ledger.

---

## 3. Local Development

### Prerequisites

- Python `3.12+`
- PostgreSQL `14+`
- Redis `7+`

### Setup Steps

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate virtual environment
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env

# 5. Run database migrations
alembic upgrade head

# 6. Start server with hot-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **Interactive API Docs (Swagger)**: `http://localhost:8000/docs`
- **ReDoc Specification**: `http://localhost:8000/redoc`
- **Health Check Endpoint**: `http://localhost:8000/health`

---

## 4. Automated Testing Suite

The backend is verified by **44 Pytest unit and integration tests** achieving a **100% pass rate**:

```bash
# Run full backend test suite
pytest tests/ -v

# Run authentication and role tests specifically
pytest tests/test_auth.py tests/test_otp_auth.py -v
```

### Test Coverage Highlights

| Test File | Tests | Coverage Scope |
| :--- | :---: | :--- |
| `test_auth.py` | 5 | Password login, registration, token refresh, role validation |
| `test_otp_auth.py` | 7 | Cryptographic OTP, 5-minute expiry, rate limiting (`429`), role downgrade guards |
| `test_direct_upi_and_saas_pass.py` | 3 | 50 free orders pass, ₹5 fee ledger, UPI settlements |
| `test_orders.py` | 9 | Atomic portion decrements, BOLA guards, self-order block, cart price concurrency |
| `test_matching.py` | 4 | Cravings matching algorithm, pure-veg compatibility protection |
| `test_delivery.py` | 2 | Doorstep delivery status transitions and flat routing |
| `test_payments.py` | 2 | Wallet top-ups, ledger credits, UTR confirmation |
| `test_preorders.py` | 1 | Pre-order slot scheduling, cut-off time calculations |
| `test_punctuality.py` | 3 | Punctuality scoring, ETA compliance, badges |
| `test_seller_photos_and_search.py` | 3 | Kitchen photo branding showcase, multi-photo search |
| `test_suggestions.py` | 3 | Community craving posts and upvote counters |
| `test_ai.py` | 2 | AI-assisted menu descriptions and suggestions |

---

## 5. Docker Container Hardening

The backend `Dockerfile` enforces security best practices:

- **Unprivileged Runtime**: Runs under dedicated non-root `appuser` (UID 1001).
- **Multi-Phase Entrypoint (`entrypoint.sh`)**: Automatically verifies PostgreSQL connectivity with `pg_isready`, runs Alembic database migrations (`alembic upgrade head`), and starts Uvicorn.
- **Docker Healthcheck**: Configured to poll `/health` every 30s.
