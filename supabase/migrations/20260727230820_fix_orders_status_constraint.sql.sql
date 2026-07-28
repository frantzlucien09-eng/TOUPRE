/*
# Fix: Add 'new' to orders status check constraint

## Problem
The orders table has a CHECK constraint on `status` that allows: pending, confirmed, preparing, ready, shipping, delivered, cancelled, refunded, an_preparasyon, ap_livre, pare_retire, livre, anile.

But the vendor app filters for `status = 'new'` (the initial status when a customer places an order). Since 'new' is not in the constraint, any INSERT with status='new' fails silently, and orders never reach the vendor.

## Fix
Drop the old constraint and add a new one that includes 'new' as a valid initial status.
*/

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'new'::text,
    'pending'::text,
    'confirmed'::text,
    'preparing'::text,
    'ready'::text,
    'shipping'::text,
    'delivering'::text,
    'delivered'::text,
    'cancelled'::text,
    'refunded'::text,
    'an_preparasyon'::text,
    'ap_livre'::text,
    'pare_retire'::text,
    'livre'::text,
    'anile'::text
  ]));
