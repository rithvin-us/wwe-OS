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
    # Notifications
    PermissionDef("notifications.read", "View notifications", "Notifications"),
    PermissionDef("notifications.send", "Send notifications", "Notifications"),
    # Settings & tenancy
    PermissionDef("settings.view", "View settings", "Settings"),
    PermissionDef("settings.manage", "Manage settings", "Settings"),
    # Workflow
    PermissionDef("workflow.view", "View workflows", "Workflow"),
    PermissionDef("workflow.act", "Act on workflow approvals", "Workflow"),
    PermissionDef("workflow.manage", "Manage workflows", "Workflow"),
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
    # Dashboard
    PermissionDef("dashboard.view", "View dashboard", "Dashboard"),
]

ALL_CODES = frozenset(p.code for p in PLATFORM_PERMISSIONS)
