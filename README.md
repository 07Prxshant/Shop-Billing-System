# Shop Billing System

A modern, web-based billing and customer ledger system designed for small shops and retail businesses. Built with **React**, **Node.js**, **Express.js**, and **MySQL**.

## Overview
Shop Billing System enables shopkeepers to:
- Manage product inventory with real-time stock tracking and low-stock alerts.
- Generate bills (POS) with instant line item calculation, discounts, and GST handling.
- Maintain comprehensive customer ledgers with daily, monthly, and custom date-range views.
- Record full and partial payments, automatically recalculating pending balances and bill statuses (`PAID`, `PARTIAL`, `UNPAID`).
- Download and print professional invoices and customer statements (PDF).
- Visualize sales performance, top products, top customers, and key shop metrics on an interactive dashboard.

## Tech Stack
- **Frontend**: React (Vite), React Router, Axios, Tailwind CSS / Bootstrap 5, Chart.js (`react-chartjs-2`), jsPDF / autotable, Lucide Icons
- **Backend**: Node.js, Express.js, MySQL 8 (`mysql2` promise API), JWT, bcrypt, Express Validator, Helmet, Morgan, Cors
- **Database**: MySQL 8 relational schema with ACID transaction support for all financial operations

## Project Structure
```text
shop-billing/
├── backend/
│   ├── src/
│   │   ├── config/          # Database configuration (mysql2 pool)
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, error handling, validation
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic & DB transactions
│   │   ├── utils/           # Invoice number generator, calculations
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client & API endpoints
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # AuthContext & global state
│   │   ├── pages/           # Application views
│   │   ├── utils/           # Helpers (currency, date, math)
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── database/
    ├── schema.sql           # Database DDL
    └── seed.sql             # Demo data
```

## Getting Started
Detailed setup instructions, environment variables, database schema, and demo flow are documented in each phase.
