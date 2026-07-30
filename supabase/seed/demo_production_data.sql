/*
  TOUPRE production demo / staging seed data

  SAFE TO RUN on staging only.
  Does NOT create auth.users — set config UUIDs to real auth.users.id values first.

  Example:
    SELECT set_config('app.demo_vendor_user_id', '<auth-uuid>', false);
    SELECT set_config('app.demo_customer_user_id', '<auth-uuid>', false);
    -- then run this file
*/

DO $$
DECLARE
  v_vendor_user uuid := NULLIF(current_setting('app.demo_vendor_user_id', true), '')::uuid;
  v_customer_user uuid := NULLIF(current_setting('app.demo_customer_user_id', true), '')::uuid;
  v_vendor_id uuid;
  v_product_food uuid;
  v_product_kay uuid;
  v_product_machin uuid;
  v_order_id uuid;
BEGIN
  IF v_vendor_user IS NULL OR v_customer_user IS NULL THEN
    RAISE NOTICE 'Skip seed: set app.demo_vendor_user_id and app.demo_customer_user_id first';
    RETURN;
  END IF;

  INSERT INTO public.settings (key, value, label, description, updated_at)
  VALUES
    ('house_listing_fee', '2500', 'House Listing Fee (HTG)', 'Frè anons Kay', now()),
    ('vehicle_listing_fee', '2500', 'Vehicle Listing Fee (HTG)', 'Frè anons Machin', now()),
    ('listing_duration_days', '30', 'Listing Duration (days)', 'Dire anons Kay/Machin', now())
  ON CONFLICT (key) DO NOTHING;

  SELECT id INTO v_vendor_id FROM public.vendors WHERE user_id = v_vendor_user AND deleted_at IS NULL LIMIT 1;

  IF v_vendor_id IS NULL THEN
    INSERT INTO public.vendors (
      user_id, business_name, owner_name, email, phone, status, is_verified,
      department, city, moncash_phone, moncash_name, balance
    ) VALUES (
      v_vendor_user,
      'Maché Demo Petyonvil',
      'Demo Vandè',
      'demo.vendor@toupre.local',
      '+50937000001',
      'active',
      true,
      'Ouest',
      'Pétion-Ville',
      '+50937000001',
      'Demo Vandè',
      15000
    )
    RETURNING id INTO v_vendor_id;
  ELSE
    UPDATE public.vendors
    SET business_name = 'Maché Demo Petyonvil',
        status = 'active',
        balance = GREATEST(balance, 15000),
        updated_at = now()
    WHERE id = v_vendor_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = v_customer_user OR id = v_customer_user) THEN
    BEGIN
      INSERT INTO public.customers (user_id, full_name, phone, address, department, city)
      VALUES (v_customer_user, 'Demo Kliyan', '+50937000002', 'Rue Demo 12', 'Ouest', 'Port-au-Prince');
    EXCEPTION WHEN others THEN
      -- Fallback if customers.id is the auth uid
      INSERT INTO public.customers (id, full_name, phone, address, department, city)
      VALUES (v_customer_user, 'Demo Kliyan', '+50937000002', 'Rue Demo 12', 'Ouest', 'Port-au-Prince')
      ON CONFLICT (id) DO NOTHING;
    END;
  END IF;

  INSERT INTO public.products (
    vendor_id, name, description, price, category, active, status, stock
  ) VALUES (
    v_vendor_id,
    'Diri Djon Djon 1kg',
    'Diri lokal fre — demo pwodwi marketplace.',
    450, 'manje', true, 'active', 25
  )
  RETURNING id INTO v_product_food;

  INSERT INTO public.products (
    vendor_id, name, description, price, category, active, status, stock,
    ad_status, ad_expires_at, price_on_request
  ) VALUES (
    v_vendor_id,
    'Kay 3 Chanm — Demo',
    'Anons Kay demo — Contact Seller sèlman.',
    85000, 'kay', true, 'active', 0,
    'active', now() + interval '30 days', false
  )
  RETURNING id INTO v_product_kay;

  INSERT INTO public.products (
    vendor_id, name, description, price, category, active, status, stock,
    ad_status, ad_expires_at
  ) VALUES (
    v_vendor_id,
    'Toyota Corolla 2015 — Demo Ekspire',
    'Anons ekspire pou teste Renew. Pa dwe parèt nan rechèch piblik.',
    950000, 'machin', false, 'active', 0,
    'expired', now() - interval '2 days'
  )
  RETURNING id INTO v_product_machin;

  INSERT INTO public.products (
    vendor_id, name, description, price, category, active, status, stock, ad_status
  ) VALUES (
    v_vendor_id,
    'Apatman Delmas — Demo Pending',
    'Anons an atant peman / revizyon.',
    45000, 'kay', false, 'draft', 0, 'draft'
  );

  INSERT INTO public.orders (
    customer_id, vendor_id, status, subtotal, shipping_cost, total,
    commission, payment_status, delivery_type, notes, items
  ) VALUES (
    v_customer_user, v_vendor_id, 'pending', 450, 100, 550, 27.5, 'unpaid', 'delivery',
    'Demo kòmand — smoke test',
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product_food,
      'product_name', 'Diri Djon Djon 1kg',
      'quantity', 1, 'unit_price', 450, 'subtotal', 450
    ))
  )
  RETURNING id INTO v_order_id;

  IF v_order_id IS NOT NULL AND v_product_food IS NOT NULL THEN
    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES (v_order_id, v_product_food, 'Diri Djon Djon 1kg', 1, 450, 450);
  END IF;

  RAISE NOTICE 'Demo seed complete. vendor=% food=% kay=% expired=% order=%',
    v_vendor_id, v_product_food, v_product_kay, v_product_machin, v_order_id;
END $$;
