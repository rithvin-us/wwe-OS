# Platform · Shared

Foundation code used by all platform components and modules:
base entity/repository classes, domain event bus contracts, error types,
pagination, validation helpers, datetime/money utilities.

- Strictly generic. If it knows about a business domain, it does not belong here.
