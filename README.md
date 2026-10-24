# Shop Billing & Customer Ledger System

> A comprehensive, full-stack web application designed for retail shops and small businesses to manage products, execute Point-of-Sale (POS) billing, record partial/full customer payments, maintain dynamic customer ledgers, generate tax invoices & PDF statements, and visualize real-time business performance.

---

## 🌟 Key Features

1. **Point of Sale (POS) Billing**
   - Live product search with automatic stock validation.
   - Real-time line item calculation (`line_amount = qty * rate`).
   - Dynamic item-wise proportional GST tax calculation.
   - Flat discount support with live recalculated taxable amounts.
   - Multiple payment methods: `CASH`, `UPI`, `CARD`, and `CREDIT`.
   - Automatic bill numbering (`INV-0001`, `INV-0002`, ...).
   - Instant professional Tax Invoice PDF download & print.

2. **Customer Ledger & Credit Management**
   - Comprehensive customer directories with contact details and addresses.
   - Reserved Walk-in customer (`id: 1`) for counter cash sales.
   - Dynamic ledger views: **Daily View** and **Monthly Grouped View** (`GROUP BY DATE_FORMAT(bill_date, '%Y-%m')`).
   - Period selector presets: Today, This Month, Last Month, and Custom Date Range.
   - Dynamic balance tracking: Customer pending balance is **never stored as an editable number**; always computed from `SUM(bills.total_amount) - SUM(payments.amount)`.
   - Inline quick edit of amount paid on bills with total amount cap validation.
   - Downloadable official **Customer Account Statement PDF** with complete running balance.

3. **Payment Collection & FIFO Dues Clearance**
   - Record payments against specific invoices or automatically distribute across oldest unpaid bills first (FIFO).
   - Validates that payments cannot exceed outstanding dues; rejects negative or zero amounts.
   - Dynamic bill status recalculation: `PAID`, `PARTIAL`, `UNPAID`.
   - Soft deletion (`is_deleted` flag) for audit compliance and ledger integrity.

4. **Inventory & Stock Tracking**
   - Add, edit, soft-delete, and search product catalog.
   - Real-time stock deduction upon bill creation; stock restoration upon bill editing or deletion in ACID transactions.
   - Stock level indicators: **In Stock**, **Low Stock Alert** (`stock_qty <= low_stock_limit`), and **Out of Stock**.

5. **Executive Dashboard & Analytical Reports**
   - Summary metric cards: Today's Sales, Current Month's Turnover, Total Outstanding Customer Credit.
   - Interactive sales trends using Chart.js (`react-chartjs-2`).
   - Top 5 customers by spending and top 5 products by revenue.
   - Date-range sales reporting with daily/monthly toggles and one-click **CSV export**.

6. **Security & Data Integrity**
   - JWT authentication with bcrypt password hashing.
   - Parameterized queries to eliminate SQL injection vulnerabilities.
   - Centralized validation via `express-validator`.
   - Dual-mode database connection: Connects to MySQL 8 natively; includes an embedded in-memory fallback for instant college viva demonstrations without local server setup.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite | High-performance Single Page Application (SPA) |
| **Routing** | React Router DOM v7 | Protected client-side routing & navigation |
| **Styling** | Tailwind CSS v3 | Responsive modern UI (works on mobile, tablet, and desktop) |
| **Icons** | Lucide React | Clean, intuitive dashboard icons |
| **Charts** | Chart.js & react-chartjs-2 | Visual sales trends and revenue comparisons |
| **PDF Generation**| jsPDF & jspdf-autotable | Client-side Tax Invoices and Customer Statements |
| **Backend** | Node.js, Express.js | Robust RESTful API architecture |
| **Database** | MySQL 8.0+ / mysql2 | Relational schema with ACID transactions |
| **Auth** | JWT, bcryptjs | Stateless token authentication & password hashing |
| **Security** | Helmet, CORS, Morgan | HTTP security headers, CORS origin protection, logging |

---

## 📁 Project Structure

```text
shop-billing/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js               # mysql2 connection pool & demo store
│   │   ├── controllers/
│   │   │   ├── authController.js     # User login & token generation
│   │   │   ├── billController.js     # Billing POS & inline edit endpoints
│   │   │   ├── customerController.js # Customer CRUD, ledger & statement
│   │   │   ├── paymentController.js  # Payment recording & FIFO logic
│   │   │   ├── productController.js  # Inventory & catalog CRUD
│   │   │   ├── reportController.js   # Dashboard metrics & sales trends
│   │   │   └── settingController.js  # Shop profile & invoice headers
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT verification & role authorization
│   │   │   ├── errorHandler.js       # Centralized JSON error handler
│   │   │   └── validate.js           # express-validator request parser
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── billRoutes.js
│   │   │   ├── customerRoutes.js
│   │   │   ├── paymentRoutes.js
│   │   │   ├── productRoutes.js
│   │   │   ├── reportRoutes.js
│   │   │   └── settingRoutes.js
│   │   ├── services/
│   │   │   ├── billService.js        # Bill calculation & stock transaction
│   │   │   └── paymentService.js     # FIFO payment allocation & transactions
│   │   ├── utils/
│   │   │   ├── billNumber.js         # Sequential invoice ID generator (INV-0001)
│   │   │   └── calc.js               # Exact business calculation formulas
│   │   ├── app.js                    # Express app configuration
│   │   └── server.js                 # HTTP listener
│   ├── test/
│   │   ├── acceptance.test.js        # End-to-end acceptance test suite
│   │   └── calc.test.js              # Unit tests for calculation rules
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js             # Central Axios instance with JWT interceptor
│   │   ├── components/
│   │   │   ├── AddPaymentModal.jsx   # Modal for recording customer payments
│   │   │   ├── Layout.jsx            # Main app shell with sidebar & navbar
│   │   │   ├── Navbar.jsx            # Top navbar with user profile & logout
│   │   │   ├── ProtectedRoute.jsx    # Auth route guard
│   │   │   └── Sidebar.jsx           # Responsive navigation drawer
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Global authentication state
│   │   ├── pages/
│   │   │   ├── Billing.jsx           # POS billing terminal with live calculator
│   │   │   ├── Bills.jsx             # Invoices list with filters & view modal
│   │   │   ├── CustomerLedger.jsx    # Customer ledger, statement & inline edit
│   │   │   ├── Customers.jsx         # Customer directory & balances
│   │   │   ├── Dashboard.jsx         # Executive dashboard & sales chart
│   │   │   ├── Login.jsx             # Sign-in page with 1-click demo fill
│   │   │   ├── Products.jsx          # Inventory manager with stock alerts
│   │   │   ├── Reports.jsx           # Sales trends & CSV export
│   │   │   └── Settings.jsx          # Business details & invoice footer
│   │   ├── utils/
│   │   │   ├── calc.js               # Frontend mirrored calculation formulas
│   │   │   ├── date.js               # Date formatting utilities
│   │   │   ├── money.js              # Currency formatter (e.g. Rs. 1,234.50)
│   │   │   └── pdfGenerator.js       # jsPDF invoice & statement builder
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── database/
│   ├── schema.sql                    # MySQL 8 database schema DDL
│   └── seed.sql                      # Initial seed dataset
└── README.md
```

---

## 📐 Core Business Formulas

These formulas are strictly mirrored between backend and frontend:

```text
1. Line Amount:
   line_amount = qty * rate

2. Subtotal:
   subtotal = SUM(line_amount)

3. Discount:
   discount_amount = flat value OR (subtotal * discount_percent / 100)

4. Taxable Amount:
   taxable = subtotal - discount_amount

5. Proportional Tax (GST):
   tax = SUM(line_amount_after_discount * gst_percent / 100)

6. Grand Total:
   total_amount = taxable + tax

7. Pending Balance:
   amount_pending = MAX(0, total_amount - amount_paid)

8. Invoice Status:
   status = PAID    if amount_pending == 0
            PARTIAL if amount_paid > 0 and amount_pending > 0
            UNPAID  if amount_paid == 0

9. Customer Ledger Balance:
   customer_balance = SUM(bills.total_amount) - SUM(payments.amount)
   (Computed dynamically across non-deleted rows)
```

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)
- **MySQL Server 8.0+** (optional: app runs in demo mode out of the box if MySQL is offline)

### 2. Database Setup (MySQL)
Open MySQL Workbench, phpMyAdmin, or your terminal:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### 3. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
3. Inspect and edit `.env`:
   ```ini
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=shop_billing
   JWT_SECRET=super_secret_jwt_key_shop_billing_2026
   JWT_EXPIRES_IN=7d
   CLIENT_URL=http://localhost:5173
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run unit and acceptance tests:
   ```bash
   npm test
   ```
6. Start the backend API server:
   ```bash
   npm run dev
   # Server runs at http://localhost:5000
   ```

### 4. Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   # Frontend runs at http://localhost:5173
   ```

---

## 🔑 Default Credentials

- **Email**: `admin@shop.com`
- **Password**: `admin123`
- *(The login screen includes a 1-click "Demo Auto-fill" button for quick access during demonstrations and viva evaluation)*

---

## 🧪 Automated Testing

To run the complete test suite:
```bash
cd backend
npm test
```
The test suite validates:
- `round2`: Precision arithmetic to eliminate floating-point rounding errors.
- `calculateLineAmount`: Unit quantity multiplication.
- `calculateBillTotals`: Subtotal, proportional GST, discount, and status determination.
- `determineBillStatus`: Proper flag allocation (`PAID`, `PARTIAL`, `UNPAID`).
- `calculateCustomerBalance`: Non-deleted ledger calculations.
- `Acceptance Checklist`: End-to-end simulation of product creation, customer registration, POS billing, partial payment, stock deduction, ledger verification, remaining payment clearance, and bill editing in transactions.

---

## 📸 Screenshots & UI Walkthrough

| Screen | Description |
| :--- | :--- |
| **Login Screen** | Secure sign-in with JWT authentication, validation, and demo autofill. |
| **Dashboard** | Metric cards (Today's Sales, Month Sales, Pending Dues), Sales trend chart, top customers, and low stock alerts. |
| **Billing (POS)** | Live product search, dynamic cart with quantity toggles, discount, proportional GST, live status badge, and instant invoice PDF generation. |
| **Bills History** | Filterable invoices table (date range, customer, payment status) with edit and view modals. |
| **Customers Directory** | Searchable customer list showing live computed balances and filter for customers with pending dues. |
| **Customer Ledger** | Period filter (Today, This Month, Last Month, Custom), daily transactions list, monthly grouping view, inline edit of amount paid, and customer statement PDF download. |
| **Products & Inventory** | Stock catalog with low stock badges, MRP pricing, GST percentages, and add/edit modals. |
| **Reports & Analytics** | Sales vs collection comparison bar charts, date range selector, and CSV data export. |
| **Shop Settings** | Shop name, GSTIN, contact numbers, address, and customizable invoice footer policy. |

---

## 🎓 Viva & Presentation Talking Points

1. **Why is the customer pending balance not stored in the customers table?**
   - *Answer*: To prevent data anomalies and race conditions. Storing an editable balance creates the risk of desynchronization when bills or payments are edited or deleted. Computing balance dynamically (`SUM(bills) - SUM(payments)`) guarantees **Single Source of Truth** integrity.
2. **How does the system ensure stock consistency when editing a bill?**
   - *Answer*: When a bill is updated, the operation executes inside an **ACID transaction**. The previous item quantities are restored back into inventory, old bill items are cleared, new item quantities are validated and deducted, and totals are recomputed. If any step fails, the entire transaction rolls back.
3. **How does the FIFO payment logic work?**
   - *Answer*: When a customer makes a lump-sum payment without picking a specific bill, the system queries unpaid and partial bills ordered by `bill_date ASC, id ASC`. It applies the payment sequentially to clear the oldest bills first until the payment amount is fully allocated.
4. **How are tax amounts calculated when a bill has a discount?**
   - *Answer*: The discount is applied across bill items proportionally (`discountRatio = (subtotal - discount) / subtotal`). The GST rate for each product is then multiplied against its discounted line amount to compute exact, compliant taxes.
