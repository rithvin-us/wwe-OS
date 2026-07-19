# Platform · Permissions

The authorization model: permission registry, policy evaluation,
resource-level access checks. Single source of truth for "can user X do Y on Z".

- Owns: permission schema, policy engine, enforcement helpers.
- Modules declare their permissions here; they never implement their own checks.
