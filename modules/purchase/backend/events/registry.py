"""Purchase module event names.

Event *names* belong to the module that raises them — `shared.events` is only
the transport (publish/subscribe), never a place to accumulate business-specific
strings. Other modules or services that want to react to purchase activity
import these constants and `shared.events.subscribe`, never this module's
internals directly.
"""

PURCHASE_BILL_INGESTED = "purchase.bill.ingested"
PURCHASE_BILL_PROCESSED = "purchase.bill.processed"
PURCHASE_BILL_NEEDS_ATTENTION = "purchase.bill.needs_attention"
PURCHASE_BILL_PAID = "purchase.bill.paid"
PURCHASE_BILL_UNPAID = "purchase.bill.unpaid"
PURCHASE_BILL_DELETED = "purchase.bill.deleted"
