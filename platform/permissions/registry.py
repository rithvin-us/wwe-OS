"""Canonical platform permission registry.

Granular, module-agnostic permissions. Business modules (Stage 2+) will
register their own permissions the same way; nothing here references HR or any
business domain.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionDef:
    code: str
    name: str
    category: str


PLATFORM_PERMISSIONS: list[PermissionDef] = [
    # Users
    PermissionDef("users.read", "View users", "Users"),
    PermissionDef("users.write", "Manage users", "Users"),
    PermissionDef("users.invite", "Invite users", "Users"),
    # Roles & permissions
    PermissionDef("roles.read", "View roles", "Roles & permissions"),
    PermissionDef("roles.manage", "Manage roles", "Roles & permissions"),
    PermissionDef("permissions.read", "View permissions", "Roles & permissions"),
    # Audit
    PermissionDef("audit.view", "View audit log", "Audit"),
    PermissionDef("audit.archive", "Archive audit records", "Audit"),
    PermissionDef("audit.write", "Log a manual note to the timeline", "Audit"),
    # Notifications
    PermissionDef("notifications.read", "View notifications", "Notifications"),
    PermissionDef("notifications.send", "Send notifications", "Notifications"),
    # Settings & tenancy
    PermissionDef("settings.view", "View settings", "Settings"),
    PermissionDef("settings.manage", "Manage settings", "Settings"),
    # Storage
    PermissionDef("storage.read", "View and download files", "Storage"),
    PermissionDef("storage.write", "Upload files", "Storage"),
    PermissionDef("storage.manage", "Delete files", "Storage"),
    # AI
    PermissionDef("ai.use", "Use AI features", "AI"),
    PermissionDef("ai.manage", "View AI usage and manage AI settings", "AI"),
    # Search
    PermissionDef("search.use", "Search across the platform", "Search"),
    # Reporting
    PermissionDef("reporting.export", "Export reports", "Reporting"),
    PermissionDef("reporting.view", "View export history", "Reporting"),
    # Tags
    PermissionDef("tags.read", "View tags", "Tags"),
    PermissionDef("tags.manage", "Create, edit, and delete tags", "Tags"),
    # Dashboard
    PermissionDef("dashboard.view", "View dashboard", "Dashboard"),
    # Automation
    PermissionDef("automation.view", "View automation rules and history", "Automation"),
    PermissionDef("automation.manage", "Create and edit automation rules", "Automation"),
    PermissionDef("automation.run", "Manually run an automation rule", "Automation"),
    # Alerts (operator threshold/schedule notifications)
    PermissionDef("alerts.view", "View alert rules", "Alerts"),
    PermissionDef("alerts.manage", "Create, edit, and delete alert rules", "Alerts"),
    # Workflow (pipeline execution engine)
    PermissionDef("workflow.view", "View pipeline runs", "Workflow"),
    PermissionDef("workflow.control", "Pause, resume, cancel, or retry a pipeline run", "Workflow"),
    # Periods (business period manager & document library)
    PermissionDef("periods.view", "View business periods and the document library", "Periods"),
    PermissionDef("periods.lock", "Lock and unlock a business period", "Periods"),
    # Identity (source identity resolution)
    PermissionDef("identity.view", "View source identities", "Identity"),
    # Metadata (unified document metadata)
    PermissionDef("metadata.view", "View unified document metadata", "Metadata"),
    # Auditor (auditor package generator)
    PermissionDef(
        "auditor.generate", "Generate an auditor package for a business period", "Auditor"
    ),
]

ALL_CODES = frozenset(p.code for p in PLATFORM_PERMISSIONS)
