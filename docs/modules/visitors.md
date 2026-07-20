# Module Intelligence · Visitors

Route `/visitors` · Domain: People & facilities · Status: Planned

## 1. Business purpose

Register expected visitors, check them in and out at reception, and notify hosts the moment guests arrive — a professional, auditable front door.

## 2. Problems it solves

- Paper visitor books: unreadable, unsearchable, non-compliant
- Hosts unaware their guest is waiting
- No record of who was on site during an incident
- Repeat visitors re-entered manually every time

## 3. Primary users

Reception/security (check-in desk), hosts (any staff), facility managers, compliance.

## 4. Future integrations

Notifications and Telegram (host alerts), HR (host directory), Audit (site presence log), future badge printing and access-control hardware.

## 5. Database entities

`visitor`, `visit`, `visit_purpose`, `host_link` (→ employee), `check_event`, `watchlist_entry`, `site`.

## 6. APIs

- `GET/POST /api/visitors/visits` · `POST /api/visitors/visits/{id}/check-in`
- `POST /api/visitors/visits/{id}/check-out` · `GET /api/visitors/on-site`
- `GET/POST /api/visitors/pre-registrations`

## 7. Dashboard widgets

On site now · Expected today · Average visit duration · Check-ins this week by site.

## 8. KPIs

Host notification time · Pre-registration rate · Overstay incidents · Check-out compliance.

## 9. Permissions

`visitors.desk` (check-in/out), `visitors.preregister`, `visitors.reports`, `visitors.admin`.

## 10. Navigation structure

Overview · Front desk · Expected · History · Sites.

## 11. Relationships with other modules

Hosts resolve to HR employees; alerts go through platform Notifications (Telegram/email channels); every check event lands in the platform Audit trail.

## 12. AI opportunities

ID document capture via OCR at check-in · Visit-pattern anomaly alerts · Reception assistant answering "is my guest here yet?".
