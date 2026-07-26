"""Finance module event names.

Event *names* belong to the module that raises them — `shared.events` is only
the transport. Anything wanting to react to an invoice being raised imports
these constants and `shared.events.subscribe`, never this module's internals.
"""

INVOICE_GENERATED = "finance.invoice.generated"
INVOICE_UPDATED = "finance.invoice.updated"
INVOICE_CANCELLED = "finance.invoice.cancelled"
