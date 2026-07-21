# WWE OS - System Status & Recent Changes

This document serves as a knowledge base update detailing what features are currently functional and what modifications have been applied recently to customize the platform for a service-provider workflow.

## 1. What is Currently Working

- **Authentication & Security**: Local JWT-based authentication is fully active. Unauthorized users are correctly redirected to the `/login` screen.
- **DMS (Document Management System)**:
  - File storage, categorization, and AI summarization are fully functional.
  - _Note: Approval workflows have been completely stripped out per the new scope._
- **Purchases & Telegram Bot Integration**:
  - The Telegram Bot (`bop-telegram-bot`) is active and can receive purchase bills.
  - The platform can review, confirm, or reject these incoming bills.
- **Inventory Management**:
  - Items can be tracked, received, and issued.
  - _Note: Low-stock tracking has been removed._
- **Assets Module**:
  - Basic asset tracking (IT equipment, vehicles, etc.) is working.
  - _Note: The Delivery Challan (DC) generation system is currently being integrated here._
- **UI/UX Customization**:
  - A custom Light Theme featuring subtle green/water-blue palettes is active.
  - A shortcut (`t`) is available to quickly toggle between dark and light themes.

---

## 2. Detailed Recent Changes

### A. Removal of Approval Workflows

- **DMS Backend**: Removed `submit_for_approval`, `mark_approved`, and `mark_rejected` services. Simplified `DocumentStatus` to just `ACTIVE` and `ARCHIVED`. Removed database fields `approval` and `reviewed_at`.
- **DMS Frontend**: Removed "Draft", "In Review", and "Approved" tabs, filters, badges, and "Submit for approval" buttons.
- **Dashboard & Global UI**: Removed the "Pending approvals" list, the "Approvals" KPI tile, and the background "Workflow (Approvals)" service from the platform's service registry.

### B. Hiding the Contracts Module

- Since contracts and their approval flows are out of scope, the Contracts app has been disabled from the platform launcher and the "New Contract" quick action has been removed from the dashboard.

### C. Simplification of Inventory

- **Low Stock Removal**: Removed the `reorder_level` field and the `is_low_stock` tracking logic from the Inventory module.
- **Database**: Generated and applied a database migration to drop the `reorder_level` column.
- **UI**: Removed the "Low stock" dashboard tile and alerts.

### D. Upcoming/In-Progress: Delivery Challan (DC) Generator

- A new feature is being integrated into the **Assets** tab to handle Returnable and Non-Returnable Delivery Challans.
- It utilizes an uploaded Word template (`DC 26.docx`) to generate downloadable PDFs dynamically.
- A persistent, un-erased history of all generated DCs (tracking site, generator, and items) is being implemented.
