# Module Intelligence · HR Automation

Route `/hr` · Domain: Operations · Status: In development (migration target for the existing HR Automation repository)

## 1. Business purpose

Run the full employee lifecycle — records, leave, attendance, onboarding, and HR approvals — in one governed system instead of spreadsheets and mail threads.

## 2. Problems it solves

- Employee data scattered across files, mail, and memory
- Leave balances and attendance tracked manually and disputed often
- Onboarding steps forgotten; no accountable checklist
- HR approvals invisible: no status, no history, no SLA

## 3. Primary users

HR officers (daily), department managers (approvals), employees (self-service), executives (headcount and absence overview).

## 4. Future integrations

Workflow engine (approvals), Notifications (leave decisions), DMS (employee documents), Telegram (quick approvals), Email (letters), Finance (payroll inputs), Assets (issued equipment).

## 5. Database entities

`employee`, `department`, `position`, `employment_contract`, `leave_type`, `leave_request`, `leave_balance`, `attendance_record`, `holiday_calendar`, `onboarding_template`, `onboarding_task`, `hr_document_link`.

## 6. APIs

- `GET/POST /api/hr/employees` · `GET/PATCH /api/hr/employees/{id}`
- `GET/POST /api/hr/leave-requests` · `POST /api/hr/leave-requests/{id}/decide`
- `GET /api/hr/leave-balances/{employee_id}`
- `GET/POST /api/hr/attendance` · `GET /api/hr/departments`
- `GET/POST /api/hr/onboarding` · `PATCH /api/hr/onboarding/tasks/{id}`

## 7. Dashboard widgets

Headcount by department · Who is out today/this week · Pending leave approvals · Onboarding in progress · Contract expiries in 90 days.

## 8. KPIs

Time-to-approve leave · Absence rate · Onboarding completion time · Attrition rate · Attendance exceptions per month.

## 9. Permissions

`hr.employee.read/write`, `hr.leave.request`, `hr.leave.approve`, `hr.attendance.read/write`, `hr.onboarding.manage`, `hr.admin` — declared in the platform permission registry; approval routing via roles (HR Manager, Department Manager).

## 10. Navigation structure

Overview · Employees · Leave · Attendance · Onboarding · Settings (module-scoped, rendered inside the one platform shell).

## 11. Relationships with other modules

Feeds Finance (payroll), Assets (assignments), Visitors (host lookup); consumes Workflow, Notifications, DMS, Audit from the platform. Never links to other modules' tables directly — events and platform contracts only.

## 12. AI opportunities

Leave-policy Q&A over company rules · Anomaly detection in attendance · Drafting HR letters from templates · Onboarding assistant that answers new-hire questions.
