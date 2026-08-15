from django.urls import path
from rest_framework.routers import DefaultRouter

from hr.backend.api.checkin_views import CheckInView
from hr.backend.api.leave_views import (
    LeaveBalanceView,
    LeaveRequestViewSet,
    LeaveTypeViewSet,
)
from hr.backend.api.people_ops_views import (
    AnomaliesView,
    AttendanceTrendsView,
    EmployeeTaskViewSet,
    ExpenseClaimViewSet,
    PolicyChatView,
    TaskTemplateViewSet,
    WorkforceAnalyticsView,
)
from hr.backend.api.views import (
    AttendanceGridView,
    DeductionViewSet,
    EmployeeViewSet,
    FaceDiagnosticsView,
    HolidayViewSet,
    PayrollRunView,
    PayrollView,
    PayRulesConfigViewSet,
    RegisterViewSet,
    SalaryRuleViewSet,
)

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="hr-employee")
router.register("salary-rules", SalaryRuleViewSet, basename="hr-salary-rule")
router.register("pay-rules", PayRulesConfigViewSet, basename="hr-pay-rules")
router.register("holidays", HolidayViewSet, basename="hr-holiday")
router.register("deductions", DeductionViewSet, basename="hr-deduction")
router.register("registers", RegisterViewSet, basename="hr-register")
router.register("leave/types", LeaveTypeViewSet, basename="hr-leave-type")
router.register("leave/requests", LeaveRequestViewSet, basename="hr-leave-request")
router.register("checklists/templates", TaskTemplateViewSet, basename="hr-task-template")
router.register("checklists/tasks", EmployeeTaskViewSet, basename="hr-employee-task")
router.register("expenses", ExpenseClaimViewSet, basename="hr-expense-claim")

urlpatterns = [
    path("attendance/", AttendanceGridView.as_view(), name="hr-attendance-grid"),
    # Public — no authentication. See checkin_views.CheckInView.
    path("attendance/checkin/", CheckInView.as_view(), name="hr-attendance-checkin"),
    path("payroll/", PayrollView.as_view(), name="hr-payroll"),
    path("payroll/run/", PayrollRunView.as_view(), name="hr-payroll-run"),
    path("leave/balances/", LeaveBalanceView.as_view(), name="hr-leave-balances"),
    path("analytics/summary/", WorkforceAnalyticsView.as_view(), name="hr-analytics-summary"),
    path("analytics/trends/", AttendanceTrendsView.as_view(), name="hr-analytics-trends"),
    path("analytics/anomalies/", AnomaliesView.as_view(), name="hr-analytics-anomalies"),
    path("policy-chat/", PolicyChatView.as_view(), name="hr-policy-chat"),
    path("face/diagnostics/", FaceDiagnosticsView.as_view(), name="hr-face-diagnostics"),
    *router.urls,
]
