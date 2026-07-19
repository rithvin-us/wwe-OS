# Platform · Users

Canonical user identity: accounts, profiles, contact details, status,
tenant membership. One user record shared across all modules — modules
reference users, they never define their own.

- Owns: the user aggregate and its lifecycle.
- Does not own: authentication (`auth/`), authorization (`permissions/`).
