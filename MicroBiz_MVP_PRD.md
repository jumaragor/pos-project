# MicroBiz – Product Requirements Document (PRD)
## MVP Version

**Product Name:** MicroBiz  
**Version:** MVP  
**Target Market:** Micro and small retail businesses in the Philippines (sari-sari stores, mini groceries, small retailers)  
**Document Owner:** Product Team  
**Status:** Ready for Development  

---

# 1. Purpose

MicroBiz is a web-based Point of Sale (POS) system designed specifically for Filipino micro retailers.  
The MVP focuses on essential daily operations: sales, inventory tracking, reporting, and basic user management.

The goal is to deliver a simple, fast, and reliable POS system that works even in low-internet environments.

---

# 2. Product Vision

To become the most practical and localized POS solution for Filipino micro retail businesses by simplifying store operations and improving financial visibility.

---

# 3. MVP Scope

The MVP includes:

- Sales & Billing
- Inventory Management
- Basic Customer Management
- Reports & Analytics
- Role-Based User Access
- Offline Mode with Sync

The MVP excludes advanced accounting, BIR compliance integration, and payment gateway integrations.

---

# 4. Core Features

---

## 4.1 Sales & Billing Module

### Functional Requirements

- Fast billing interface
- Item search (name or SKU)
- Barcode scanning support
- Add/remove items from cart
- Apply item-level and order-level discounts
- Accept payment methods:
  - Cash
  - QR (manual entry placeholder for future integration)
- Split payment support (cash + QR)
- Generate receipt
- Print receipt (thermal printer support via browser)
- Void transaction (admin permission required)
- Refund basic workflow
- Offline transaction support (queued sync)

### User Stories

- As a cashier, I can scan or search items to process sales quickly.
- As a store owner, I can view all completed transactions.
- As a cashier, I can process sales even when internet is unavailable.

---

## 4.2 Inventory Management

### Functional Requirements

- Add / edit / delete product
- Product fields:
  - Name
  - SKU
  - Category
  - Unit (pcs, pack, box, kilo)
  - Cost price
  - Selling price
  - Stock quantity
  - Low stock threshold
- Stock in (purchase entry)
- Stock out (adjustment)
- Repacking logic:
  - Example: 1 box = 12 pieces
  - Automatic stock deduction on conversion
- Low stock alerts
- Import products via CSV

### User Stories

- As an owner, I can see real-time stock levels.
- As a staff member, I can adjust inventory when receiving new stock.
- As a retailer, I can convert bulk inventory into tingi units.

---

## 4.3 Customer Management

### Functional Requirements

- Create customer profile:
  - Name
  - Mobile number
- View sales history per customer
- Basic tagging (optional)

### User Stories

- As a store owner, I can track repeat customers.
- As a cashier, I can associate a sale with a customer.

---

## 4.4 Reports & Analytics

### Required Reports

- Daily Sales Summary
- Weekly Sales Summary
- Monthly Sales Summary
- Top Selling Items
- Inventory Stock Report
- Basic Profit Estimate (Sales - Cost)
- Payment Method Breakdown

### Dashboard Summary

- Today’s Sales
- Number of Transactions
- Low Stock Alerts
- Total Revenue (Today)

### User Stories

- As an owner, I can quickly see daily performance.
- As a retailer, I can identify my top-selling items.

---

## 4.5 User & Role Management

### Roles

- Owner (Full access)
- Manager (Limited administrative access)
- Cashier (Sales-only access)

### Permissions

- Void transaction (Owner/Manager)
- Edit product price (Owner)
- Adjust inventory (Owner/Manager)
- View profit reports (Owner only)

---

## 4.6 Offline Mode

### Requirements

- POS must function offline.
- Transactions stored locally (IndexedDB or local storage).
- Sync to server once internet reconnects.
- Conflict resolution logic required.

---

# 5. Non-Functional Requirements

- Web-based application (desktop & tablet friendly)
- Progressive Web App (PWA) recommended
- REST API backend
- Secure authentication (JWT or session-based)
- HTTPS required
- Data encryption in transit
- Role-based authorization
- Fast load time (<2 seconds for main dashboard)

---

# 6. Technical Architecture (Suggested)

### Frontend
- React / Next.js
- PWA enabled

### Backend
- Node.js (Express) or Laravel or Django
- RESTful API structure

### Database
- PostgreSQL or MySQL

### Offline Storage
- IndexedDB

### Hosting
- AWS / DigitalOcean / Vercel / Render

---

# 7. Data Models (High-Level)

### User
- id
- name
- email
- password_hash
- role
- created_at

### Product
- id
- name
- sku
- category
- unit
- cost_price
- selling_price
- stock_quantity
- low_stock_threshold
- created_at

### Transaction
- id
- total_amount
- payment_method
- user_id
- created_at

### TransactionItem
- id
- transaction_id
- product_id
- quantity
- price
- subtotal

### Customer
- id
- name
- mobile
- created_at

---

# 8. Constraints

- No direct GCash/Maya API integration in MVP
- No BIR compliance automation in MVP
- Single-branch only
- Cloud sync required for backup

---

# 9. Success Metrics

- User can complete a sale in under 30 seconds
- Inventory reflects real-time deduction
- Offline transactions sync successfully
- Zero critical data loss incidents
- >70% early user satisfaction

---

# 10. Future Roadmap (Post-MVP)

- Utang / Credit Ledger
- Supplier Management
- Expense Tracking
- GCash / Maya Integration
- Loyalty Points
- Multi-branch support
- BIR-ready OR printing
- SMS notifications

---

# 11. Navigation Structure

- Dashboard
- POS
- Inventory
- Customers
- Reports
- Users
- Settings

---

# 12. MVP Completion Definition

The MVP is considered complete when:

- All core modules are functional
- Sales and inventory are fully operational
- Offline mode is tested and stable
- Reports generate accurate data
- Role-based permissions work correctly
- System deployed in production environment

---

End of Document