# MicroBiz POS – Advanced UI Redesign Specification
## DualEntry-Inspired Modern SaaS Dashboard

---

# 🎯 OBJECTIVE

Redesign the entire frontend UI of the MicroBiz POS system to follow a modern SaaS ERP design language similar to DualEntry.

This is a UI/UX refactor only.

---

# ❗ STRICT RULES

- DO NOT modify backend logic
- DO NOT change API endpoints
- DO NOT alter database structure
- DO NOT modify business logic
- DO NOT rename backend variables unless strictly needed for UI
- ONLY refactor layout, styling, and frontend structure

---

# 🧱 DESIGN SYSTEM SPECIFICATION

## 1️⃣ Layout System

### Structure

- Fixed left sidebar (width: 240px)
- Top header bar (height: 64px)
- Main content area with responsive padding
- Use 12-column grid system
- Dashboard cards arranged in responsive grid:
  - Desktop: 3–4 cards per row
  - Tablet: 2 per row
  - Mobile: 1 per row

---

## 2️⃣ Spacing System

Use consistent spacing scale:

- 4px (xs)
- 8px (sm)
- 12px (md)
- 16px (lg)
- 24px (xl)
- 32px (2xl)
- 48px (3xl)

All components must follow this spacing system.

---

## 3️⃣ Typography System

Font: Inter or Poppins (fallback: sans-serif)

### Headings
- Page Title: 24px, 600 weight
- Section Title: 18px, 600 weight

### Card Metrics
- Main Metric: 28px–32px, bold
- Label Text: 13px–14px, medium
- Trend %: 12px–13px

### Table Text
- 14px body text
- 12px secondary info

---

## 4️⃣ Color System

### Background
- Main background: #f8fafc
- Card background: #ffffff
- Sidebar background: #ffffff

### Primary
- Deep teal or dark blue (e.g. #0f172a or #0e7490)

### Success
- #16a34a (soft green)

### Danger
- #dc2626 (soft red)

### Neutral Grays
- #f1f5f9
- #e2e8f0
- #94a3b8
- #475569

Avoid bright saturated colors.

---

## 5️⃣ Card Component Specification

Each dashboard metric card must:

- Background: white
- Border radius: 12px
- Box shadow: soft subtle shadow (e.g. 0 2px 8px rgba(0,0,0,0.05))
- Padding: 20–24px
- Vertical spacing between elements: 8–12px

Card content structure:

1. Small label text (muted gray)
2. Large metric number
3. Trend indicator aligned right (green/red)
4. Small sparkline chart below metric

---

## 6️⃣ Buttons

### Primary Button
- Background: Primary color
- Text: White
- Border radius: 10px
- Padding: 10px 16px
- Subtle hover darken effect
- Smooth 150ms transition

### Secondary Button
- Light gray background
- Dark text
- Subtle hover background change

No gradients.
No heavy shadows.

---

## 7️⃣ Sidebar Navigation

- Minimal icons (outline style preferred)
- Active item highlighted with subtle background
- Hover effect: light gray background
- Clean vertical spacing between items
- Logo at top
- Collapsible optional (if easy to implement)

---

## 8️⃣ Tables

- White background
- Light row dividers (#e2e8f0)
- Row hover effect (very light gray)
- Rounded table container
- Sticky table header (if possible)
- Proper padding (12px–16px per cell)

---

## 9️⃣ Charts

- Use simple line or area charts
- No heavy grid lines
- Smooth curves
- Soft color fills
- Keep minimal

Charts must feel lightweight and modern.

---

# 🧠 UI BEHAVIOR

- Smooth hover transitions (150ms–200ms ease)
- Subtle elevation on hover for cards
- Responsive layout
- No visual clutter
- No overcrowded data

---

# 🏗 COMPONENT REFACTOR (If Using React)

Refactor into reusable components:

- <Sidebar />
- <Header />
- <DashboardLayout />
- <Card />
- <MetricWidget />
- <DataTable />
- <PrimaryButton />
- <SecondaryButton />

Use TailwindCSS for styling if available.
Keep components clean and modular.

---

# 🏗 If Using Plain HTML/CSS

- Use CSS Grid for dashboard layout
- Use Flexbox for alignment
- Create reusable classes:
  - .card
  - .metric-card
  - .sidebar
  - .header
  - .btn-primary
  - .btn-secondary

Organize CSS cleanly.

---

# 🎯 DASHBOARD CONTENT STRUCTURE (MicroBiz Version)

Replace ERP-heavy financial metrics with retail-focused ones:

Top Row Cards:
- Today’s Sales
- Today’s Profit
- Transactions Today
- Cash on Hand

Second Row:
- Top Selling Products (table)
- Low Stock Alerts (table)

Optional:
- Weekly Sales Trend chart

---

# 🚀 FINAL INSTRUCTION

Redesign the entire frontend to follow this design system.

Preserve:
- All data bindings
- All business logic
- All existing functionality

Only modernize layout, styling, and component structure.

The final UI must feel:
- Premium
- Clean
- Professional
- ERP-grade
- Yet simple enough for micro retail users