-- Cibo Napoli: online orders and table bookings.
-- APPLIED on 2026-11-03 to the Supabase project « cibo napoli » (ref tucvrdecsmdfeacvdkdt, eu-west-1), as the
-- migrations "cibo_napoli_orders_bookings_push" and "advisor_fixes_pg_net_schema_fk_indexes" (end of this file).
-- To set up a new project: create it in an EU region (free plan), run this file in the SQL editor (or as a
-- migration), turn OFF "Allow new users to sign up" (Authentication → Sign In / Providers), create the accounts by
-- hand, deploy supabase/functions/push, then fill CONFIG.orders in js/config.js. Run the security advisors after.
--
-- Who can do what:
--   * customers (anon, not signed in) may only ADD an order (with a secret token their phone keeps), READ the
--     status of their own order and CANCEL it while it waits, by sending that token in the "x-order-token" header;
--   * staff (signed-in accounts listed in public.staff) see and update only their own restaurant's orders;
--   * the owner (role 'owner') sees and updates every restaurant.
-- Privacy: the customer's name, phone, address, map point and note are erased 24 hours after the order; the
-- rest (dishes, amounts, status), anonymous, is kept 2 years for the statistics, then deleted.

create extension if not exists pg_cron;
create extension if not exists pg_net schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- Restaurants (one for now; add rows to open another) ----------
-- zone: the delivery area drawn by the owner, [[lat, lng], …] (the same list as CONFIG.delivery.zone in js/config.js)
create table public.locations (
  id      text primary key,
  name    text not null,
  lat     double precision not null,
  lng     double precision not null,
  max_km  numeric(4, 1) not null default 8,
  fee     int not null default 10,
  zone    jsonb not null default '[]'
);
insert into public.locations (id, name, lat, lng, max_km, fee, zone)
values ('el-mansouria', 'Cibo Napoli', 33.7372332, -7.3142341, 8, 10,
        '[[33.71425,-7.35303],[33.71882,-7.35166],[33.72024,-7.34651],[33.72096,-7.34307],[33.72453,-7.34479],[33.7281,-7.34685],[33.73095,-7.34565],[33.73238,-7.34136],[33.73381,-7.33707],[33.73666,-7.33449],[33.73809,-7.3302],[33.74023,-7.32591],[33.74166,-7.32162],[33.74451,-7.31732],[33.74665,-7.31303],[33.74951,-7.3096],[33.75236,-7.30702],[33.75379,-7.30273],[33.75736,-7.30102],[33.75879,-7.29844],[33.76021,-7.29501],[33.76235,-7.29157],[33.76521,-7.28814],[33.76521,-7.28471],[33.76164,-7.27956],[33.75879,-7.27613],[33.7545,-7.27355],[33.75022,-7.27183],[33.74523,-7.27012],[33.74309,-7.27441],[33.74023,-7.27956],[33.73666,-7.28471],[33.73309,-7.28986],[33.73024,-7.29501],[33.72596,-7.30187],[33.72167,-7.30874],[33.71739,-7.31561],[33.7131,-7.32076],[33.705,-7.33485],[33.69786,-7.34858],[33.69286,-7.36232],[33.69358,-7.37433],[33.69786,-7.38292],[33.70358,-7.38549],[33.709,-7.38377],[33.70957,-7.37691],[33.71015,-7.36918],[33.71157,-7.3606]]');

-- Is the point inside the zone? (ray casting; an empty zone means "no limit but max_km")
create or replace function private.in_zone(zone jsonb, plat double precision, plng double precision)
  returns boolean language plpgsql immutable set search_path = '' as $$
declare
  n int := jsonb_array_length(zone);
  inside boolean := false;
  i int; j int;
  yi double precision; xi double precision; yj double precision; xj double precision;
begin
  if n < 3 then return true; end if;
  j := n - 1;
  for i in 0 .. n - 1 loop
    yi := (zone -> i ->> 0)::double precision; xi := (zone -> i ->> 1)::double precision;
    yj := (zone -> j ->> 0)::double precision; xj := (zone -> j ->> 1)::double precision;
    if ((yi > plat) <> (yj > plat)) and (plng < (xj - xi) * (plat - yi) / (yj - yi) + xi) then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end;
$$;
revoke all on function private.in_zone(jsonb, double precision, double precision) from public;

-- ---------- Staff accounts ----------
create table public.staff (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  role     text not null default 'staff' check (role in ('staff', 'owner')),
  location text references public.locations (id),
  check (role = 'owner' or location is not null)
);

-- ---------- Orders ----------
create table public.orders (
  id             uuid primary key,
  token          uuid not null,
  location       text not null references public.locations (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  status         text not null default 'new'
                 check (status in ('new', 'accepted', 'refused', 'ready', 'on_the_way', 'done', 'cancelled')),
  eta_minutes    int check (eta_minutes between 5 and 180),
  accepted_at    timestamptz,
  refuse_reason  text check (char_length(refuse_reason) <= 120),
  cancelled_by   text check (cancelled_by in ('customer', 'staff')),
  cancel_reason  text check (char_length(cancel_reason) <= 120),
  mode           text not null check (mode in ('pickup', 'delivery')),
  customer_name  text check (char_length(customer_name) between 1 and 60),
  customer_phone text check (customer_phone ~ '^0[5-7][0-9]{8}$'),
  address        text check (char_length(address) <= 200),
  lat            double precision check (lat between 33.5 and 34),
  lng            double precision check (lng between -7.6 and -7.0),
  distance_km    numeric(5, 2) check (distance_km between 0 and 50),
  notes          text check (char_length(notes) <= 300),
  -- the lines as the customer saw them: [{ id, name, qty, details: [..], unit, total }]
  items          jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 60),
  subtotal       int not null check (subtotal between 1 and 20000),
  delivery_fee   int not null default 0 check (delivery_fee between 0 and 100),
  total          int not null check (total between 1 and 20000),
  lang           text not null default 'fr' check (lang in ('fr', 'en')),
  anonymized_at  timestamptz,
  demo           boolean not null default false,
  check (total = subtotal + delivery_fee),
  check (mode = 'delivery' or delivery_fee = 0),
  check ((customer_name is not null and customer_phone is not null) or anonymized_at is not null),
  check (mode = 'pickup' or (lat is not null and lng is not null and address is not null) or anonymized_at is not null)
);
create index orders_location_created_idx on public.orders (location, created_at desc);
create index orders_location_status_created_idx on public.orders (location, status, created_at desc);
create index orders_phone_created_idx on public.orders (customer_phone, created_at desc) where customer_phone is not null;
create index orders_to_forget_idx on public.orders (created_at) where anonymized_at is null;
create index orders_new_idx on public.orders (created_at) where status = 'new';

-- ---------- Row level security and column grants ----------
alter table public.locations enable row level security;
alter table public.staff enable row level security;
alter table public.orders enable row level security;
revoke all on table public.locations, public.staff, public.orders from anon, authenticated;

-- Is the signed-in account allowed to see this restaurant? (owner: every restaurant)
create or replace function private.staff_can(loc text)
  returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s
                 where s.user_id = (select auth.uid()) and (s.role = 'owner' or s.location = loc));
$$;
revoke all on function private.staff_can(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.staff_can(text) to authenticated;

grant select on table public.locations to authenticated;
create policy "staff read the restaurants" on public.locations for select to authenticated using (true);

grant select on table public.staff to authenticated;
create policy "staff read their own row" on public.staff for select to authenticated
  using ((select auth.uid()) = user_id);

-- Customers add an order: only these columns (status, timestamps, anonymized_at and demo keep their defaults).
grant insert (id, token, location, mode, customer_name, customer_phone, address, lat, lng, distance_km,
              notes, items, subtotal, delivery_fee, total, lang)
  on table public.orders to anon;
create policy "customers add an order" on public.orders for insert to anon
  with check (status = 'new');

-- Customers read their own order, with its token in the "x-order-token" header.
grant select (id, location, status, eta_minutes, accepted_at, refuse_reason, cancel_reason, cancelled_by,
              created_at, updated_at, mode, total)
  on table public.orders to anon;
create policy "customers read their own order" on public.orders for select to anon
  using (token::text = (select current_setting('request.headers', true)::json ->> 'x-order-token'));

-- Customers cancel their own order while it waits.
grant update (status, cancelled_by) on table public.orders to anon;
create policy "customers cancel their own waiting order" on public.orders for update to anon
  using (status = 'new' and token::text = (select current_setting('request.headers', true)::json ->> 'x-order-token'))
  with check (status = 'cancelled' and cancelled_by = 'customer');

-- Staff see and update their restaurant's orders; the owner sees every restaurant.
grant select on table public.orders to authenticated;
grant update (status, eta_minutes, refuse_reason, cancelled_by, cancel_reason) on table public.orders to authenticated;
grant delete on table public.orders to authenticated;
create policy "staff see their restaurant's orders" on public.orders for select to authenticated
  using ((select private.staff_can(location)));
create policy "staff update their restaurant's orders" on public.orders for update to authenticated
  using ((select private.staff_can(location))) with check ((select private.staff_can(location)));
create policy "staff clear test orders" on public.orders for delete to authenticated
  using (demo and (select private.staff_can(location)));

-- ---------- Triggers ----------
-- Before a new order: at most 5 orders per phone in 10 minutes, and a delivery must be inside the zone (the
-- distance is measured again here, from the restaurant's pin; the fee must match).
create or replace function private.orders_check_new()
  returns trigger language plpgsql security definer set search_path = '' as $$
declare
  loc public.locations;
  km  numeric;
begin
  if (select count(*) from public.orders o
      where o.customer_phone = new.customer_phone and o.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Trop de commandes depuis ce numéro, réessayez dans quelques minutes.' using errcode = 'P0001';
  end if;
  select * into loc from public.locations where id = new.location;
  if new.mode = 'delivery' then
    km := 2 * 6371 * asin(sqrt(power(sin(radians(new.lat - loc.lat) / 2), 2)
          + cos(radians(loc.lat)) * cos(radians(new.lat)) * power(sin(radians(new.lng - loc.lng) / 2), 2)));
    if km > loc.max_km + 0.05 or not private.in_zone(loc.zone, new.lat, new.lng) then
      raise exception 'Adresse hors zone de livraison.' using errcode = 'P0002';
    end if;
    if new.delivery_fee <> loc.fee then
      raise exception 'Frais de livraison incorrects.' using errcode = 'P0003';
    end if;
    new.distance_km := round(km, 2);
  end if;
  return new;
end;
$$;
revoke all on function private.orders_check_new() from public;
create trigger orders_check_new before insert on public.orders
  for each row execute function private.orders_check_new();

-- On update: a finished order (done, refused, cancelled) cannot change; customers can only cancel; updated_at,
-- and when the order is accepted (the customer's countdown starts there). The 24 h clean-up passes through.
create or replace function private.orders_touch()
  returns trigger language plpgsql set search_path = '' as $$
begin
  if new.anonymized_at is not null and old.anonymized_at is null and current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if old.status in ('done', 'refused', 'cancelled') and current_user in ('anon', 'authenticated') then
    raise exception 'Commande terminée.' using errcode = 'P0004';
  end if;
  if current_user = 'anon' and (new.status <> 'cancelled' or old.status <> 'new') then
    raise exception 'Trop tard pour annuler.' using errcode = 'P0005';
  end if;
  new.updated_at := now();
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.orders_touch() from public;
create trigger orders_touch before update on public.orders
  for each row execute function private.orders_touch();

-- ---------- Realtime: new and changed orders reach the staff screen live (RLS applies) ----------
alter publication supabase_realtime add table public.orders;

-- ---------- Privacy clean-ups (pg_cron) ----------
-- Every 15 minutes: orders older than 24 hours lose the customer's personal details.
create or replace function private.orders_forget()
  returns void language sql set search_path = '' as $$
  update public.orders
     set customer_name = null, customer_phone = null, address = null, lat = null, lng = null,
         distance_km = null, notes = null, anonymized_at = now()
   where anonymized_at is null and created_at < now() - interval '24 hours';
$$;
revoke all on function private.orders_forget() from public, anon, authenticated;
select cron.schedule('orders-forget-24h', '*/15 * * * *', 'select private.orders_forget()');
-- Every night: orders older than 2 years are deleted.
select cron.schedule('orders-keep-two-years', '17 3 * * *', $$ delete from public.orders where created_at < now() - interval '2 years' $$);

-- ---------- Table bookings (/reserver/) ----------
-- Customers (anon) may only ADD a booking; the staff confirm it by phone or WhatsApp from /commandes/.
-- The customer's name, phone and note are erased 24 hours after the booked time.
create table public.reservations (
  id             uuid primary key,
  location       text not null references public.locations (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  date           date not null,
  time           text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  people         int not null check (people between 1 and 20),
  kids           int not null default 0 check (kids >= 0),
  status         text not null default 'new' check (status in ('new', 'confirmed', 'refused', 'cancelled')),
  refuse_reason  text check (char_length(refuse_reason) <= 120),
  customer_name  text check (char_length(customer_name) between 1 and 60),
  customer_phone text check (customer_phone ~ '^0[5-7][0-9]{8}$'),
  notes          text check (char_length(notes) <= 300),
  lang           text not null default 'fr' check (lang in ('fr', 'en')),
  anonymized_at  timestamptz,
  check (kids < people),
  check ((customer_name is not null and customer_phone is not null) or anonymized_at is not null)
);
create index reservations_location_date_idx on public.reservations (location, date, time);
create index reservations_phone_created_idx on public.reservations (customer_phone, created_at desc) where customer_phone is not null;
alter table public.reservations enable row level security;
revoke all on table public.reservations from anon, authenticated;

grant insert (id, location, date, time, people, kids, customer_name, customer_phone, notes, lang)
  on table public.reservations to anon;
create policy "customers ask for a table" on public.reservations for insert to anon
  with check (status = 'new' and date >= (now() at time zone 'Africa/Casablanca')::date
              and date <= (now() at time zone 'Africa/Casablanca')::date + 60);

grant select on table public.reservations to authenticated;
grant update (status, refuse_reason) on table public.reservations to authenticated;
create policy "staff see their restaurant's bookings" on public.reservations for select to authenticated
  using ((select private.staff_can(location)));
create policy "staff answer their restaurant's bookings" on public.reservations for update to authenticated
  using ((select private.staff_can(location))) with check ((select private.staff_can(location)));

-- At most 5 requests per phone in 10 minutes; updated_at on every change.
create or replace function private.reservations_check_new()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reservations r
      where r.customer_phone = new.customer_phone and r.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Trop de demandes depuis ce numéro, réessayez dans quelques minutes.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.reservations_check_new() from public;
create trigger reservations_check_new before insert on public.reservations
  for each row execute function private.reservations_check_new();
create or replace function private.reservations_touch()
  returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.reservations_touch() from public;
create trigger reservations_touch before update on public.reservations
  for each row execute function private.reservations_touch();

alter publication supabase_realtime add table public.reservations;

-- Every 15 minutes: bookings whose time is more than 24 hours ago lose the customer's details.
create or replace function private.reservations_forget()
  returns void language sql set search_path = '' as $$
  update public.reservations
     set customer_name = null, customer_phone = null, notes = null, anonymized_at = now()
   where anonymized_at is null
     and ((date + time::time) at time zone 'Africa/Casablanca') < now() - interval '24 hours';
$$;
revoke all on function private.reservations_forget() from public, anon, authenticated;
select cron.schedule('reservations-forget-24h', '7,22,37,52 * * * *', 'select private.reservations_forget()');
select cron.schedule('reservations-keep-two-years', '27 3 * * *', $$ delete from public.reservations where date < current_date - interval '2 years' $$);

-- ---------- Push notifications to the staff phones ----------
-- The phones that turned notifications on (each account manages its own).
create table public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  p256dh     text not null,
  auth       text not null,
  device     text check (char_length(device) <= 300),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, delete on table public.push_subscriptions to authenticated;
grant update (endpoint, p256dh, auth, device) on table public.push_subscriptions to authenticated;
create policy "own phones" on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The sender's keys (inserted BY HAND in the SQL editor, never committed):
--   insert into public.push_config (id, vapid_public, vapid_private, vapid_subject, call_secret, function_url)
--   values (1, '<public>', '<private>', 'mailto:<email>', '<long random secret>', 'https://<project>.supabase.co/functions/v1/push');
create table public.push_config (
  id            int primary key default 1 check (id = 1),
  vapid_public  text not null,
  vapid_private text not null,
  vapid_subject text not null,
  call_secret   text not null,
  function_url  text not null
);
create table public.push_sent (order_id uuid primary key references public.orders (id) on delete cascade, count int not null default 1, last_at timestamptz not null default now());
create table public.push_log (
  id bigint generated always as identity primary key, at timestamptz not null default now(), user_id uuid,
  device text, endpoint text, status int, detail text, kind text not null default 'order'
);
alter table public.push_config enable row level security;
alter table public.push_sent enable row level security;
alter table public.push_log enable row level security;
revoke all on table public.push_config, public.push_sent, public.push_log from anon, authenticated;

-- Calls the edge function (at once for a new order, then every 30 s while orders wait).
create or replace function private.call_push()
  returns void language plpgsql security definer set search_path = '' as $$
declare cfg public.push_config;
begin
  select * into cfg from public.push_config where id = 1;
  if cfg is null then return; end if;
  if not exists (select 1 from public.orders where status = 'new' and created_at > now() - interval '10 minutes') then return; end if;
  perform net.http_post(url := cfg.function_url, body := '{}'::jsonb,
                        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.call_secret));
end;
$$;
revoke all on function private.call_push() from public, anon, authenticated;

create or replace function private.orders_push_new()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.call_push();
  return null;
end;
$$;
revoke all on function private.orders_push_new() from public;
create trigger orders_push_new after insert on public.orders
  for each statement execute function private.orders_push_new();

select cron.schedule('push-reminders', '30 seconds', 'select private.call_push()');
select cron.schedule('push-log-week', '23 3 * * *', $$ delete from public.push_log where at < now() - interval '7 days' $$);

-- ---------- Accounts (after creating them in Authentication → Users → Add user) ----------
--   insert into public.staff (user_id, role, location) values ('<staff user id>', 'staff', 'el-mansouria');
--   insert into public.staff (user_id, role) values ('<owner user id>', 'owner');

-- ---------- 2026-11-03: security and performance advisors ----------
-- (applied as the migration "advisor_fixes_pg_net_schema_fk_indexes")
-- pg_net out of the public schema, and indexes for two foreign keys. The remaining advisor notice (« RLS enabled,
-- no policy » on push_config, push_sent, push_log) is on purpose: nobody reaches those tables from the site.
drop extension if exists pg_net;
create extension pg_net schema extensions;
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists staff_location_idx on public.staff (location);
