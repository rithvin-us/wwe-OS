# Module Intelligence · Maintenance

Route `/maintenance` · Domain: People & facilities · Status: Planned

## 1. Business purpose

Capture maintenance requests, dispatch work orders, and keep preventive schedules on time for facilities and equipment.

## 2. Problems it solves

- Breakdowns reported by hallway conversation and lost
- No priority or SLA on repairs
- Preventive maintenance skipped until failure
- Cost of upkeep per asset unknown

## 3. Primary users

All staff (report issues), maintenance technicians, facility managers, finance (costs).

## 4. Future integrations

Assets (service history), Inventory (spare parts), Vendors (external contractors), Workflow (approval of major works), Notifications (status updates), Telegram (technician dispatch).

## 5. Database entities

`maintenance_request`, `work_order`, `work_order_task`, `preventive_schedule`, `technician_assignment`, `parts_usage`, `downtime_record`.

## 6. APIs

- `GET/POST /api/maintenance/requests` · `POST /api/maintenance/requests/{id}/triage`
- `GET/POST /api/maintenance/work-orders` · `POST /api/maintenance/work-orders/{id}/complete`
- `GET/POST /api/maintenance/schedules` · `GET /api/maintenance/backlog`

## 7. Dashboard widgets

Open requests by priority · Overdue work orders · Preventive tasks due this week · Mean time to repair trend.

## 8. KPIs

Mean time to repair · Preventive compliance (%) · Repeat-failure rate · Maintenance cost per asset.

## 9. Permissions

`maintenance.request.create`, `maintenance.triage`, `maintenance.workorder.execute`, `maintenance.schedule.manage`, `maintenance.admin`.

## 10. Navigation structure

Overview · Requests · Work orders · Preventive schedules · Backlog.

## 11. Relationships with other modules

Work history writes to Assets; parts draw from Inventory; contractor jobs reference Vendors; large works approved via Workflow; requesters notified via platform Notifications.

## 12. AI opportunities

Auto-triage and priority from request text/photos · Predictive maintenance from failure history · Suggested parts list per fault type.
