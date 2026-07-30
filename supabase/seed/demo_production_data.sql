/*
  TOUPRE Private Beta — demo vendors, customers, products

  SAFE TO RUN on staging / private-beta projects only.
  Does NOT create auth.users — create Auth users first, then bind UUIDs:

    SELECT set_config('app.demo_vendor_user_id',   '<auth-uuid-vendor-1>', true);
    SELECT set_config('app.demo_vendor_user_id_2', '<auth-uuid-vendor-2>', true);
    SELECT set_config('app.demo_customer_user_id',   '<auth-uuid-customer-1>', true);
    SELECT set_config('app.demo_customer_user_id_2', '<auth-uuid-customer-2>', true);
    -- then: \i supabase/seed/demo_production_data.sql

  Suggested Auth emails (create in Supabase Auth dashboard):
    demo.vendor1@toupre.local  /  demo.vendor2@toupre.local
    demo.customer1@toupre.local / demo.customer2@toupre.local
*/

DO $$
DECLARE
  v_vendor_user uuid := NULLIF(current_setting('app.demo_vendor_user_id', true), '')::uuid;
  v_vendor_user_2 uuid := NULLIF(current_setting('app.demo_vendor_user_id_2', true), '')::uuid;
  v_customer_user uuid := NULLIF(current_setting('app.demo_customer_user_id', true), '')::uuid;
  v_customer_user_2 uuid := NULLIF(current_setting('app.demo_customer_user_id_2', true), '')::uuid;
  v_vendor_id uuid;
  v_vendor_id_2 uuid;
  v_product_food uuid;
  v_product_rad uuid;
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
    ('listing_duration_days', '30', 'Listing Duration (days)', 'Dire anons Kay/Machin', now()),
    ('beta_mode', 'true', 'Private Beta', 'Private beta flag for ops', now())
  ON CONFLICT (key) DO NOTHING;

  -- ── Demo Vendor 1: Marketplace (Pétion-Ville) ──────────────────────────
  SELECT id INTO v_vendor_id FROM public.vendors WHERE user_id = v_vendor_user AND deleted_at IS NULL LIMIT 1;

  IF v_vendor_id IS NULL THEN
    INSERT INTO public.vendors (
      user_id, business_name, owner_name, email, phone, status, is_verified,
      department, city, moncash_phone, moncash_name, balance,
      terms_accepted_at, privacy_accepted_at, vendor_terms_accepted_at,
      terms_version, privacy_version, vendor_terms_version
    ) VALUES (
      v_vendor_user,
      'Maché Demo Petyonvil',
      'Demo Vandè 1',
      'demo.vendor1@toupre.local',
      '+50937000001',
      'active',
      true,
      'Ouest',
      'Pétion-Ville',
      '+50937000001',
      'Demo Vandè 1',
      15000,
      now(), now(), now(),
      '2026-07-30', '2026-07-30', '2026-07-30'
    )
    RETURNING id INTO v_vendor_id;
  ELSE
    UPDATE public.vendors
    SET business_name = 'Maché Demo Petyonvil',
        status = 'active',
        is_verified = true,
        balance = GREATEST(COALESCE(balance, 0), 15000),
        updated_at = now()
    WHERE id = v_vendor_id;
  END IF;

  -- ── Demo Vendor 2: Classified focus (Delmas) — optional ────────────────
  IF v_vendor_user_2 IS NOT NULL THEN
    SELECT id INTO v_vendor_id_2 FROM public.vendors WHERE user_id = v_vendor_user_2 AND deleted_at IS NULL LIMIT 1;
    IF v_vendor_id_2 IS NULL THEN
      INSERT INTO public.vendors (
        user_id, business_name, owner_name, email, phone, status, is_verified,
        department, city, moncash_phone, moncash_name, balance,
        terms_accepted_at, privacy_accepted_at, vendor_terms_accepted_at,
        terms_version, privacy_version, vendor_terms_version
      ) VALUES (
        v_vendor_user_2,
        'Anons Demo Delmas',
        'Demo Vandè 2',
        'demo.vendor2@toupre.local',
        '+50937000003',
        'active',
        true,
        'Ouest',
        'Delmas',
        '+50937000003',
        'Demo Vandè 2',
        5000,
        now(), now(), now(),
        '2026-07-30', '2026-07-30', '2026-07-30'
      )
      RETURNING id INTO v_vendor_id_2;
    END IF;
  END IF;

  -- ── Demo Customer 1 ────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = v_customer_user OR id = v_customer_user) THEN
    BEGIN
      INSERT INTO public.customers (
        user_id, full_name, phone, email, address, department, city,
        terms_accepted_at, privacy_accepted_at, terms_version, privacy_version
      ) VALUES (
        v_customer_user, 'Demo Kliyan 1', '+50937000002', 'demo.customer1@toupre.local',
        'Rue Demo 12', 'Ouest', 'Port-au-Prince',
        now(), now(), '2026-07-30', '2026-07-30'
      );
    EXCEPTION WHEN others THEN
      INSERT INTO public.customers (
        id, full_name, phone, email, address, department, city,
        terms_accepted_at, privacy_accepted_at, terms_version, privacy_version
      ) VALUES (
        v_customer_user, 'Demo Kliyan 1', '+50937000002', 'demo.customer1@toupre.local',
        'Rue Demo 12', 'Ouest', 'Port-au-Prince',
        now(), now(), '2026-07-30', '2026-07-30'
      )
      ON CONFLICT (id) DO NOTHING;
    END;
  END IF;

  -- ── Demo Customer 2 — optional ─────────────────────────────────────────
  IF v_customer_user_2 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = v_customer_user_2 OR id = v_customer_user_2) THEN
    BEGIN
      INSERT INTO public.customers (
        user_id, full_name, phone, email, address, department, city,
        terms_accepted_at, privacy_accepted_at, terms_version, privacy_version
      ) VALUES (
        v_customer_user_2, 'Demo Kliyan 2', '+50937000004', 'demo.customer2@toupre.local',
        'Ave Beta 7', 'Ouest', 'Carrefour',
        now(), now(), '2026-07-30', '2026-07-30'
      );
    EXCEPTION WHEN others THEN
      INSERT INTO public.customers (id, full_name, phone, email, address, department, city)
      VALUES (v_customer_user_2, 'Demo Kliyan 2', '+50937000004', 'demo.customer2@toupre.local',
              'Ave Beta 7', 'Ouest', 'Carrefour')
      ON CONFLICT (id) DO NOTHING;
    END;
  END IF;

  -- ── Demo Products (Vendor 1) ───────────────────────────────────────────
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
    vendor_id, name, description, price, category, active, status, stock
  ) VALUES (
    v_vendor_id,
    'Chemiz Koton Demo',
    'Rad demo pou beta — stock limite.',
    1200, 'rad', true, 'active', 10
  )
  RETURNING id INTO v_product_rad;

  INSERT INTO public.products (
    vendor_id, name, description, price, category, active, status, stock
  ) VALUES (
    v_vendor_id,
    'Sèvis Livrezon Demo',
    'Pwodwi sèvis demontre checkout multi-atik.',
    300, 'lòt', true, 'active', 99
  );

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

  -- Vendor 2 classified samples
  IF v_vendor_id_2 IS NOT NULL THEN
    INSERT INTO public.products (
      vendor_id, name, description, price, category, active, status, stock,
      ad_status, ad_expires_at
    ) VALUES (
      v_vendor_id_2,
      'Machin Honda Civic — Demo Delmas',
      'Anons machin aktif pou Contact Seller.',
      780000, 'machin', true, 'active', 0,
      'active', now() + interval '30 days'
    );
    INSERT INTO public.products (
      vendor_id, name, description, price, category, active, status, stock
    ) VALUES (
      v_vendor_id_2,
      'Jis Zaboka 1L',
      'Pwodwi marketplace nan vandè 2.',
      250, 'manje', true, 'active', 40
    );
  END IF;

  -- ── Demo unpaid order (Customer 1 → Vendor 1) ──────────────────────────
  INSERT INTO public.orders (
    customer_id, vendor_id, status, subtotal, shipping_cost, total,
    commission, payment_status, delivery_type, notes, items
  ) VALUES (
    v_customer_user, v_vendor_id, 'pending', 450, 100, 550, 27.5, 'unpaid', 'delivery',
    'Demo kòmand — beta / smoke test',
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

  RAISE NOTICE 'Private beta seed complete. vendor1=% vendor2=% food=% rad=% kay=% expired=% order=%',
    v_vendor_id, v_vendor_id_2, v_product_food, v_product_rad, v_product_kay, v_product_machin, v_order_id;
END $$;
