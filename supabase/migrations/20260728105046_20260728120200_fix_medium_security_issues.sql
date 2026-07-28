/*
# Fix Medium Security Issues — Phase 3

## Summary
Resolves Medium-severity issues from the security audit:

1. **FOR ALL RLS policies (56 issues)**: 56 RLS policies used `FOR ALL` instead
   of separate per-verb policies. Each is split into 4 SELECT/INSERT/UPDATE/DELETE
   policies with the same condition.

2. **Unsafe table privileges (1 issue)**: The authenticated role had
   TRUNCATE, REFERENCES, and TRIGGER privileges on all 73 tables. Revoked;
   kept only SELECT, INSERT, UPDATE, DELETE which RLS policies govern.

## Security Changes
- Drop 56 FOR ALL policies
- Create individual SELECT/INSERT/UPDATE/DELETE policies
- REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated

## Important Notes
1. Conditions on new per-verb policies are identical to original FOR ALL policies.
2. TRUNCATE bypasses RLS entirely, so the privilege was a data-loss risk.
3. cart_items uses cart_id FK (not user_id) — ownership checked via carts table.
4. inventory uses product_id FK — ownership checked via products → vendors chain.
*/

-- ============================================================
-- 1. SPLIT FOR ALL POLICIES INTO PER-VERB POLICIES
-- ============================================================

-- ---- activity_logs ----
DROP POLICY IF EXISTS "admin_manage_activity_logs" ON public.activity_logs;
CREATE POLICY "admin_select_activity_logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_activity_logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_activity_logs" ON public.activity_logs FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_activity_logs" ON public.activity_logs FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- addresses ----
DROP POLICY IF EXISTS "admin_manage_addresses" ON public.addresses;
CREATE POLICY "admin_select_addresses" ON public.addresses FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_addresses" ON public.addresses FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_addresses" ON public.addresses FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_addresses" ON public.addresses FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "customer_manage_own_addresses" ON public.addresses;
CREATE POLICY "customer_select_own_addresses" ON public.addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "customer_insert_own_addresses" ON public.addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customer_update_own_addresses" ON public.addresses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customer_delete_own_addresses" ON public.addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- admin_logs ----
DROP POLICY IF EXISTS "admin_manage_admin_logs" ON public.admin_logs;
CREATE POLICY "admin_select_admin_logs" ON public.admin_logs FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_admin_logs" ON public.admin_logs FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_admin_logs" ON public.admin_logs FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_admin_logs" ON public.admin_logs FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- admin_permissions ----
DROP POLICY IF EXISTS "admin_manage_admin_permissions" ON public.admin_permissions;
CREATE POLICY "admin_select_admin_permissions" ON public.admin_permissions FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_admin_permissions" ON public.admin_permissions FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_admin_permissions" ON public.admin_permissions FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_admin_permissions" ON public.admin_permissions FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- admin_roles ----
DROP POLICY IF EXISTS "admin_manage_admin_roles" ON public.admin_roles;
CREATE POLICY "admin_select_admin_roles" ON public.admin_roles FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_admin_roles" ON public.admin_roles FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_admin_roles" ON public.admin_roles FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_admin_roles" ON public.admin_roles FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- ambassador_applications ----
DROP POLICY IF EXISTS "admin_manage_ambassador_applications" ON public.ambassador_applications;
CREATE POLICY "admin_select_ambassador_applications" ON public.ambassador_applications FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_ambassador_applications" ON public.ambassador_applications FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_ambassador_applications" ON public.ambassador_applications FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_ambassador_applications" ON public.ambassador_applications FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- analytics_events ----
DROP POLICY IF EXISTS "admin_manage_analytics_events" ON public.analytics_events;
CREATE POLICY "admin_select_analytics_events_all" ON public.analytics_events FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_analytics_events" ON public.analytics_events FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_analytics_events" ON public.analytics_events FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_analytics_events" ON public.analytics_events FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- audit_logs ----
DROP POLICY IF EXISTS "admin_manage_audit_logs" ON public.audit_logs;
CREATE POLICY "admin_select_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_audit_logs" ON public.audit_logs FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_audit_logs" ON public.audit_logs FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- automation_error_log ----
DROP POLICY IF EXISTS "admin_manage_error_log" ON public.automation_error_log;
CREATE POLICY "admin_select_error_log" ON public.automation_error_log FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_error_log" ON public.automation_error_log FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_error_log" ON public.automation_error_log FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_error_log" ON public.automation_error_log FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- brands ----
DROP POLICY IF EXISTS "admin_manage_brands" ON public.brands;
CREATE POLICY "admin_select_brands" ON public.brands FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_brands" ON public.brands FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_brands" ON public.brands FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_brands" ON public.brands FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- broadcast_messages ----
DROP POLICY IF EXISTS "admin_manage_broadcast_messages" ON public.broadcast_messages;
CREATE POLICY "admin_select_broadcast_messages" ON public.broadcast_messages FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_broadcast_messages" ON public.broadcast_messages FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_broadcast_messages" ON public.broadcast_messages FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_broadcast_messages" ON public.broadcast_messages FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- cart_items ----
DROP POLICY IF EXISTS "admin_manage_cart_items" ON public.cart_items;
CREATE POLICY "admin_select_cart_items" ON public.cart_items FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_cart_items" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_cart_items" ON public.cart_items FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_cart_items" ON public.cart_items FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "customer_manage_own_cart_items" ON public.cart_items;
CREATE POLICY "customer_select_own_cart_items" ON public.cart_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));
CREATE POLICY "customer_insert_own_cart_items" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));
CREATE POLICY "customer_update_own_cart_items" ON public.cart_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));
CREATE POLICY "customer_delete_own_cart_items" ON public.cart_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));

-- ---- carts ----
DROP POLICY IF EXISTS "admin_manage_carts" ON public.carts;
CREATE POLICY "admin_select_carts" ON public.carts FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_carts" ON public.carts FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_carts" ON public.carts FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_carts" ON public.carts FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "customer_manage_own_carts" ON public.carts;
CREATE POLICY "customer_select_own_carts" ON public.carts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "customer_insert_own_carts" ON public.carts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customer_update_own_carts" ON public.carts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customer_delete_own_carts" ON public.carts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- categories ----
DROP POLICY IF EXISTS "admin_manage_categories" ON public.categories;
CREATE POLICY "admin_select_categories" ON public.categories FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_categories" ON public.categories FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_categories" ON public.categories FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- conversations ----
DROP POLICY IF EXISTS "conv_admin_manage" ON public.conversations;
CREATE POLICY "conv_admin_select" ON public.conversations FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "conv_admin_insert" ON public.conversations FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "conv_admin_update" ON public.conversations FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "conv_admin_delete" ON public.conversations FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- coupons ----
DROP POLICY IF EXISTS "admin_manage_coupons" ON public.coupons;
CREATE POLICY "admin_select_coupons" ON public.coupons FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_coupons" ON public.coupons FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_coupons" ON public.coupons FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_coupons" ON public.coupons FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- customers ----
DROP POLICY IF EXISTS "admin_manage_customers" ON public.customers;
CREATE POLICY "admin_select_customers" ON public.customers FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- deliveries ----
DROP POLICY IF EXISTS "admin_manage_deliveries" ON public.deliveries;
CREATE POLICY "admin_select_deliveries" ON public.deliveries FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_deliveries" ON public.deliveries FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_deliveries" ON public.deliveries FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_deliveries" ON public.deliveries FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- delivery_drivers ----
DROP POLICY IF EXISTS "admin_manage_delivery_drivers" ON public.delivery_drivers;
CREATE POLICY "admin_select_delivery_drivers" ON public.delivery_drivers FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_delivery_drivers" ON public.delivery_drivers FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_delivery_drivers" ON public.delivery_drivers FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_delivery_drivers" ON public.delivery_drivers FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- device_sessions ----
DROP POLICY IF EXISTS "user_manage_own_device_sessions" ON public.device_sessions;
CREATE POLICY "user_select_own_device_sessions" ON public.device_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_device_sessions" ON public.device_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_device_sessions" ON public.device_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_delete_own_device_sessions" ON public.device_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_manage_device_sessions" ON public.device_sessions;
CREATE POLICY "admin_select_device_sessions" ON public.device_sessions FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_device_sessions" ON public.device_sessions FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_device_sessions" ON public.device_sessions FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_device_sessions" ON public.device_sessions FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- favorites ----
DROP POLICY IF EXISTS "customer_manage_own_favorites" ON public.favorites;
CREATE POLICY "customer_select_own_favorites" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "customer_insert_own_favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customer_update_own_favorites" ON public.favorites FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customer_delete_own_favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- inventory ----
DROP POLICY IF EXISTS "admin_manage_inventory" ON public.inventory;
CREATE POLICY "admin_select_inventory" ON public.inventory FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_inventory" ON public.inventory FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_inventory" ON public.inventory FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_inventory" ON public.inventory FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "vendor_manage_own_inventory" ON public.inventory;
CREATE POLICY "vendor_select_own_inventory" ON public.inventory FOR SELECT TO authenticated USING (product_id IN (SELECT p.id FROM public.products p WHERE p.vendor_id IN (SELECT v.id FROM public.vendors v WHERE v.user_id = auth.uid() AND v.deleted_at IS NULL)));
CREATE POLICY "vendor_insert_own_inventory" ON public.inventory FOR INSERT TO authenticated WITH CHECK (product_id IN (SELECT p.id FROM public.products p WHERE p.vendor_id IN (SELECT v.id FROM public.vendors v WHERE v.user_id = auth.uid() AND v.deleted_at IS NULL)));
CREATE POLICY "vendor_update_own_inventory" ON public.inventory FOR UPDATE TO authenticated USING (product_id IN (SELECT p.id FROM public.products p WHERE p.vendor_id IN (SELECT v.id FROM public.vendors v WHERE v.user_id = auth.uid() AND v.deleted_at IS NULL))) WITH CHECK (product_id IN (SELECT p.id FROM public.products p WHERE p.vendor_id IN (SELECT v.id FROM public.vendors v WHERE v.user_id = auth.uid() AND v.deleted_at IS NULL)));
CREATE POLICY "vendor_delete_own_inventory" ON public.inventory FOR DELETE TO authenticated USING (product_id IN (SELECT p.id FROM public.products p WHERE p.vendor_id IN (SELECT v.id FROM public.vendors v WHERE v.user_id = auth.uid() AND v.deleted_at IS NULL)));

-- ---- messages ----
DROP POLICY IF EXISTS "msg_admin_manage" ON public.messages;
CREATE POLICY "msg_admin_select" ON public.messages FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "msg_admin_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "msg_admin_update" ON public.messages FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "msg_admin_delete" ON public.messages FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- notifications ----
DROP POLICY IF EXISTS "notif_admin_manage" ON public.notifications;
CREATE POLICY "notif_admin_select" ON public.notifications FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "notif_admin_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "notif_admin_update" ON public.notifications FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "notif_admin_delete" ON public.notifications FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "user_manage_own_notifications" ON public.notifications;
CREATE POLICY "user_select_own_notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_delete_own_notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- order_items ----
DROP POLICY IF EXISTS "admin_manage_order_items" ON public.order_items;
CREATE POLICY "admin_select_order_items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_order_items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_order_items" ON public.order_items FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_order_items" ON public.order_items FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- orders ----
DROP POLICY IF EXISTS "admin_manage_orders" ON public.orders;
CREATE POLICY "admin_select_orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- payment_methods ----
DROP POLICY IF EXISTS "admin_manage_payment_methods" ON public.payment_methods;
CREATE POLICY "admin_select_payment_methods" ON public.payment_methods FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_payment_methods" ON public.payment_methods FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_payment_methods" ON public.payment_methods FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_payment_methods" ON public.payment_methods FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "customer_manage_own_payment_methods" ON public.payment_methods;
CREATE POLICY "customer_select_own_payment_methods" ON public.payment_methods FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "customer_insert_own_payment_methods" ON public.payment_methods FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customer_update_own_payment_methods" ON public.payment_methods FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customer_delete_own_payment_methods" ON public.payment_methods FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- payments ----
DROP POLICY IF EXISTS "admin_manage_payments" ON public.payments;
CREATE POLICY "admin_select_payments" ON public.payments FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_payments" ON public.payments FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_payments" ON public.payments FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- product_images ----
DROP POLICY IF EXISTS "vendor_manage_own_product_images" ON public.product_images;
CREATE POLICY "vendor_select_own_product_images" ON public.product_images FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.products p JOIN public.vendors v ON v.id = p.vendor_id WHERE p.id = product_images.product_id AND v.user_id = auth.uid() AND v.deleted_at IS NULL));
CREATE POLICY "vendor_insert_own_product_images" ON public.product_images FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.vendors v ON v.id = p.vendor_id WHERE p.id = product_images.product_id AND v.user_id = auth.uid() AND v.deleted_at IS NULL));
CREATE POLICY "vendor_update_own_product_images" ON public.product_images FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.products p JOIN public.vendors v ON v.id = p.vendor_id WHERE p.id = product_images.product_id AND v.user_id = auth.uid() AND v.deleted_at IS NULL)) WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.vendors v ON v.id = p.vendor_id WHERE p.id = product_images.product_id AND v.user_id = auth.uid() AND v.deleted_at IS NULL));
CREATE POLICY "vendor_delete_own_product_images" ON public.product_images FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.products p JOIN public.vendors v ON v.id = p.vendor_id WHERE p.id = product_images.product_id AND v.user_id = auth.uid() AND v.deleted_at IS NULL));

DROP POLICY IF EXISTS "admin_manage_product_images" ON public.product_images;
CREATE POLICY "admin_select_product_images" ON public.product_images FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_product_images" ON public.product_images FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_product_images" ON public.product_images FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_product_images" ON public.product_images FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- promotions ----
DROP POLICY IF EXISTS "admin_manage_promotions" ON public.promotions;
CREATE POLICY "admin_select_promotions" ON public.promotions FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_promotions" ON public.promotions FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_promotions" ON public.promotions FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_promotions" ON public.promotions FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- recent_views ----
DROP POLICY IF EXISTS "admin_manage_recent_views" ON public.recent_views;
CREATE POLICY "admin_select_recent_views" ON public.recent_views FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_recent_views" ON public.recent_views FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_recent_views" ON public.recent_views FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_recent_views" ON public.recent_views FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "user_manage_own_recent_views" ON public.recent_views;
CREATE POLICY "user_select_own_recent_views" ON public.recent_views FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_recent_views" ON public.recent_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_recent_views" ON public.recent_views FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_delete_own_recent_views" ON public.recent_views FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- reviews ----
DROP POLICY IF EXISTS "admin_manage_reviews" ON public.reviews;
CREATE POLICY "admin_select_reviews" ON public.reviews FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_reviews" ON public.reviews FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_reviews" ON public.reviews FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- search_history ----
DROP POLICY IF EXISTS "admin_manage_search_history" ON public.search_history;
CREATE POLICY "admin_select_search_history" ON public.search_history FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_search_history" ON public.search_history FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_search_history" ON public.search_history FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_search_history" ON public.search_history FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "user_manage_own_search_history" ON public.search_history;
CREATE POLICY "user_select_own_search_history" ON public.search_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_insert_own_search_history" ON public.search_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_update_own_search_history" ON public.search_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_delete_own_search_history" ON public.search_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---- settings ----
DROP POLICY IF EXISTS "admin_manage_settings" ON public.settings;
CREATE POLICY "admin_select_settings" ON public.settings FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_settings" ON public.settings FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_settings" ON public.settings FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_settings" ON public.settings FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "settings_write_admin" ON public.settings;
CREATE POLICY "settings_write_admin_select" ON public.settings FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "settings_write_admin_insert" ON public.settings FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "settings_write_admin_update" ON public.settings FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "settings_write_admin_delete" ON public.settings FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- social_media_links ----
DROP POLICY IF EXISTS "admin_manage_social_media_links" ON public.social_media_links;
CREATE POLICY "admin_select_social_media_links" ON public.social_media_links FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_social_media_links" ON public.social_media_links FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_social_media_links" ON public.social_media_links FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_social_media_links" ON public.social_media_links FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- stores ----
DROP POLICY IF EXISTS "admin_manage_stores" ON public.stores;
CREATE POLICY "admin_select_stores" ON public.stores FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_stores" ON public.stores FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_stores" ON public.stores FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_stores" ON public.stores FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- subcategories ----
DROP POLICY IF EXISTS "admin_manage_subcategories" ON public.subcategories;
CREATE POLICY "admin_select_subcategories" ON public.subcategories FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_subcategories" ON public.subcategories FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_subcategories" ON public.subcategories FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_subcategories" ON public.subcategories FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- support_tickets ----
DROP POLICY IF EXISTS "admin_manage_tickets" ON public.support_tickets;
CREATE POLICY "admin_select_tickets" ON public.support_tickets FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_tickets" ON public.support_tickets FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- transactions ----
DROP POLICY IF EXISTS "admin_manage_transactions" ON public.transactions;
CREATE POLICY "admin_select_transactions" ON public.transactions FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_transactions" ON public.transactions FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_transactions" ON public.transactions FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- trust_events ----
DROP POLICY IF EXISTS "admin_manage_trust_events" ON public.trust_events;
CREATE POLICY "admin_select_trust_events" ON public.trust_events FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_trust_events" ON public.trust_events FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_trust_events" ON public.trust_events FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_trust_events" ON public.trust_events FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- trust_scores ----
DROP POLICY IF EXISTS "admin_manage_trust_scores" ON public.trust_scores;
CREATE POLICY "admin_select_trust_scores" ON public.trust_scores FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_trust_scores" ON public.trust_scores FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_trust_scores" ON public.trust_scores FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_trust_scores" ON public.trust_scores FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- vendor_applications ----
DROP POLICY IF EXISTS "admin_manage_vendor_applications" ON public.vendor_applications;
CREATE POLICY "admin_select_vendor_applications" ON public.vendor_applications FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_vendor_applications" ON public.vendor_applications FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_vendor_applications" ON public.vendor_applications FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_vendor_applications" ON public.vendor_applications FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- vendor_rankings ----
DROP POLICY IF EXISTS "admin_manage_rankings" ON public.vendor_rankings;
CREATE POLICY "admin_select_rankings" ON public.vendor_rankings FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_rankings" ON public.vendor_rankings FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_rankings" ON public.vendor_rankings FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_rankings" ON public.vendor_rankings FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- wallets ----
DROP POLICY IF EXISTS "admin_manage_wallets" ON public.wallets;
CREATE POLICY "admin_select_wallets" ON public.wallets FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_wallets" ON public.wallets FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_wallets" ON public.wallets FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_wallets" ON public.wallets FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ---- withdrawals ----
DROP POLICY IF EXISTS "admin_manage_withdrawals" ON public.withdrawals;
CREATE POLICY "admin_select_withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "admin_insert_withdrawals" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_update_withdrawals" ON public.withdrawals FOR UPDATE TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
CREATE POLICY "admin_delete_withdrawals" ON public.withdrawals FOR DELETE TO authenticated USING (public.has_role('admin'));

-- ============================================================
-- 2. REVOKE UNSAFE TABLE PRIVILEGES FROM authenticated
-- ============================================================

REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
