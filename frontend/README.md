# Society Food Platform — Frontend Application (`v1.2.1`)

> Modern, responsive Progressive Web App (PWA) built with **React 18**, **Material UI (MUI v5)**, and **React Router v6**, designed for hyper-local residential apartment food sharing.

---

## 1. Overview & Architecture

The frontend application provides a seamless, warm culinary interface for apartment communities. It employs a **multi-workspace modular design** with nested layouts and subpages:

- **Resident Space**: Hyper-local marketplace for discovering neighbor home chefs, filtering dietary options, posting community cravings, and tracking doorstep deliveries.
- **Partner Workspace (Kitchen Hub)**: Dedicated multi-tab subpage console for home chefs to manage batch portions, accept pre-orders, customize storefront branding, and track direct UPI revenues.
- **Society Admin Console**: Multi-tab management portal for society supervisors to verify home chefs, inspect the resident directory, and audit order refunds.
- **Account Services & Action Menu**: Profile-based launcher empowering residents to seamlessly apply as home chefs and switch workspaces without database role mutations.

---

## 2. Route Directory & Modular Sub-Pages

### 🏡 Resident Space

| Route | Component | Purpose |
| :--- | :--- | :--- |
| `/` | `BuyerDashboard.jsx` | Main home marketplace, time-of-day greeting, search, category pills, verified neighbor chef cards. |
| `/suggestions` | `SuggestionsBoard.jsx` | Community cravings radar, upvoting, dual acceptance modal. |
| `/menu/:sellerId` | `Menu.jsx` | Kitchen catalog, real-time portion steppers, dish lightbox modal. |
| `/orders` | `Orders.jsx` | Real-time order progress timeline, doorstep ETA, receipt details. |
| `/profile` | `Profile.jsx` | Resident profile, flat address details, and **Account Services & Action Menu**. |
| `/login` | `LoginPage` (`App.jsx`) | Universal OTP & password authentication, smart workspace router. |

### 🍳 Partner Workspace (Home Chef Subpages)

| Route | Subpage Component | Purpose |
| :--- | :--- | :--- |
| `/partner` | `PartnerOverview.jsx` | Kitchen health score, punctuality metrics, batch prep sheet, and live order alerts. |
| `/partner/orders` | `PartnerOrders.jsx` | Fulfillment pipeline (`Pending` → `Accepted` → `Preparing` → `Ready` → `Dispatched`). |
| `/partner/menu` | `PartnerMenu.jsx` | Portion inventory steppers, stock toggle switch, dish cloning, spice badges, and uploads. |
| `/partner/gallery` | `PartnerGallery.jsx` | Kitchen photo branding showcase with one-click curated culinary background presets. |
| `/partner/finances` | `PartnerFinances.jsx` | SaaS Pass quota meter (50 free orders), Direct P2PM UPI settlement configuration, and ₹5 fee ledger. |

> *Note: Legacy route `/seller/dashboard` automatically redirects to `/partner` for complete backward compatibility.*

### 🛡️ Society Admin Console Subpages

| Route | Subpage Component | Purpose |
| :--- | :--- | :--- |
| `/admin` | `AdminOverview.jsx` | Society GMV KPIs, net gross volume, and daily fulfillment analytics. |
| `/admin/approvals` | `AdminApprovals.jsx` | Chef partner onboarding review queue with instant one-click approval or rejection. |
| `/admin/residents` | `AdminResidents.jsx` | Society resident & chef directory with apartment flat mapping and active account toggles. |
| `/admin/refunds` | `AdminRefunds.jsx` | Order dispute audit log, issue resolutions, and automated payment refund actions. |

---

## 3. Key Design Patterns & UX Components

1. **Nested Outlet Shells**:
   - `PartnerLayout.jsx` and `AdminLayout.jsx` serve as persistent workspace shells with header telemetry, badge counters, and tabbed sub-navigation rendering active subpages via React Router `<Outlet />`.
2. **Account Services & Action Menu**:
   - Embedded in `Profile.jsx` as an intuitive action card grid providing instant launchers for Resident Space, Kitchen Hub, Admin Console, and a dedicated **Apply as Home Chef** application modal.
3. **Multi-Chef Slide-Out Basket (`CartDrawer.jsx`)**:
   - Drawer grouping items by chef kitchen, enforcing portion constraints, delivery slot selectors, and real-time price change detection.
4. **Direct P2PM UPI Modal (`DirectUPIPaymentModal.jsx`)**:
   - Generates interactive UPI intent QR codes for scan-and-pay directly to chef bank accounts with zero gateway commissions, prompting 12-digit bank UTR entry.
5. **Interactive Dish Lightbox (`DishImageModal.jsx`)**:
   - High-resolution top-down culinary imagery viewer with spice badges, portion controls, and dietary attributes.

---

## 4. Local Development

### Prerequisites

- Node.js `20.x` or `24.x`
- npm `10.x+`

### Installation & Execution

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start local development server
npm start
```

The application will be accessible at `http://localhost:3000`.

### Environment Configuration

Create a `.env` file in the `frontend/` directory (or use default container environment variables):

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_LOG_LEVEL=debug
```

---

## 5. Automated Testing Suite

The frontend includes **14 test suites** with **40 unit and integration tests** achieving a **100% pass rate**:

```bash
# Run all tests once
npm test -- --watchAll=false

# Run a specific subpage suite
npm test -- --watchAll=false src/__tests__/partner-subpages.test.jsx
npm test -- --watchAll=false src/__tests__/admin-subpages.test.jsx
```

### Test Coverage Highlights

| Test File | Tests | Focus Area |
| :--- | :---: | :--- |
| `partner-subpages.test.jsx` | 5 | PartnerLayout shell, Live orders pipeline, Menu catalog steppers, Gallery presets, SaaS pass finances |
| `admin-subpages.test.jsx` | 5 | AdminLayout shell, Overview KPIs, Approvals queue, Residents directory, Refunds ledger |
| `direct-upi-and-saas-pass.test.jsx` | 2 | ProfilePage UPI configuration, 50 free orders quota meter, UTR payment modal |
| `role-switching.test.jsx` | 2 | Password tab persona selection, Navbar persona switcher |
| `role-navigation-and-self-order.test.jsx` | 5 | Persona role navigation, User Chip popover, and self-order prevention |
| `seller-menu-edit.test.jsx` | 5 | Dish edit dialog pre-population, 1-click duplicate cloning, spice chips, low stock badges |
| `multi-photo-chef-and-carousel.test.jsx` | 4 | Multi-photo chef cards, touch navigation, photo galleries |
| `cravings-marketplace.test.jsx` | 3 | Community cravings board, upvotes, dish matching |
| `cravings-matching-and-seller-view.test.jsx` | 3 | Chef Demand Radar, Dual Acceptance modal |
| `menu-search-and-lightbox.test.jsx` | 2 | Search filtering, dietary tags, image modal |
| `seller-command-center.test.jsx` | 1 | Punctuality health metrics, batch prep sheet |
| `cart-checkout-journey.test.jsx` | 1 | Drawer cart, portion calculation, UPI QR intent |
| `rating-form.test.jsx` | 1 | Punctuality rating, food quality review |
| `auth-routing.test.jsx` | 1 | Brand display, landing page links, tabs |

---

## 6. Docker & Nginx Production Setup

The frontend is packaged using a multi-stage `Dockerfile`:

1. **Stage 1 (Builder)**: `node:24-alpine` builds the static production bundle via `npm run build`.
2. **Stage 2 (Server)**: `nginx:1.25-alpine` serves static assets with Brotli/Gzip compression, immutable asset caching, and fallback SPA routing (`try_files $uri $uri/ /index.html;`) so nested routes like `/partner/menu` and `/admin/approvals` resolve correctly on browser reload.

```bash
# Build frontend container standalone
docker build -t society-food-frontend .

# Run standalone
docker run -p 3000:80 society-food-frontend
```
