-- Khatape — seed one test shop + promote your super-admin logins.
-- Run this in SQL Editor AFTER you have (a) run schema.sql and
-- (b) created your login(s) under Authentication → Users.

do $$
declare
  -- All of these become EQUAL super-admins (each sees/manages every tenant the same way).
  -- Create each one under Authentication → Users first.
  super_admin_emails text[] := array[
    'primedigitals.business@gmail.com',
    'krishna200428@gmail.com'
  ];
  promoted int;
  t_id uuid;
begin
  -- Promote every listed email that has an auth user (tenant_id null = spans all tenants)
  update app_users u
     set role = 'super_admin', tenant_id = null
    from auth.users a
   where a.id = u.id
     and a.email = any(super_admin_emails);
  get diagnostics promoted = row_count;
  if promoted = 0 then
    raise exception 'No auth users matched %. Create them under Authentication → Users first.', super_admin_emails;
  end if;
  raise notice 'Promoted % account(s) to super_admin', promoted;

  -- One test shop
  insert into tenants (name, gst_number, upi_id, phone, branding)
  values ('Chamunda Dairy (Test)', '24ABCDE1234F1Z5', 'chamunda@okaxis', '9016116357',
          '{"primary":"#16a34a"}'::jsonb)
  returning id into t_id;

  -- Grant a couple of optional modules so you can see gating work
  insert into tenant_modules (tenant_id, module_key) values
    (t_id, 'loose_items'),
    (t_id, 'bulk_import'),
    (t_id, 'thermal_print')
  on conflict do nothing;

  -- Sample items. Packaged = sold per piece. Loose = sold by weight/volume
  -- (price is per rate_unit, e.g. Cow Milk ₹54 per litre).
  insert into items (tenant_id, name, capacity, price, pricing_mode, rate_unit) values
    (t_id, 'Amul Gold Milk', '500 ml', 33, 'packaged', 'piece'),
    (t_id, 'Bread',          '400 g',  40, 'packaged', 'piece'),
    (t_id, 'Cow Milk',       null,     54, 'loose',    'l'),
    (t_id, 'Sugar',          null,     45, 'loose',    'kg');

  -- Sample customers (RFID is what the POS scans; customer_code is the display id)
  insert into customers (tenant_id, name, phone, email, rfid, customer_code, sequence_number) values
    (t_id, 'Ramesh Patel', '9812345678', '9812345678@sms.local', '1234567890', 'CD1', 1),
    (t_id, 'Sita Sharma',  '9898989898', '9898989898@sms.local', '1002003004', 'CD2', 2);

  raise notice 'Seeded tenant %', t_id;
end $$;
