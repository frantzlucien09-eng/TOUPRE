/*
# Restore Missing trg_update_vendor_stats Trigger

## Context
The trg_update_vendor_stats trigger was inadvertently dropped during the
cleanup migration. This trigger is the single source of truth for vendor_stats
synchronization — without it, vendor statistics never update when orders change.

## What This Migration Does:
1. Drops the trigger if it exists in a broken state (idempotent)
2. Recreates the trigger to fire AFTER INSERT OR DELETE OR UPDATE on orders
3. The trigger calls update_vendor_stats_on_order() which:
   - Calls recalculate_vendor_stats(vendor_id) to recompute all metrics
   - Calls assign_seller_badges(vendor_id) to re-evaluate the seller badge

## Important Notes:
- This trigger coexists with trg_recalc_on_order (which only handles rankings)
- Together they ensure: stats update on every order change, rankings update on
  status transitions to delivered
- The trigger function update_vendor_stats_on_order() already exists and is intact
*/

DROP TRIGGER IF EXISTS trg_update_vendor_stats ON public.orders;

CREATE TRIGGER trg_update_vendor_stats
  AFTER INSERT OR DELETE OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vendor_stats_on_order();
