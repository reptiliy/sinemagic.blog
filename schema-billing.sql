begin;
create table public.journal_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 updated_at timestamptz not null default now()
);
create table public.journal_subscriptions (
 mode text not null default 'live' check(mode in ('live','test')),
 provider text not null check(provider in ('stripe','paypal')),
 provider_id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 article_id uuid references public.journal_articles(id) on delete set null,
 status text not null,
 active boolean not null default false,
 expires_at timestamptz,
 renews boolean not null default false,
 event_at timestamptz not null,
 primary key(provider,provider_id)
);
create table public.journal_payments (
 mode text not null default 'live' check(mode in ('live','test')),
 provider text not null check(provider in ('stripe','paypal')),
 provider_id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 article_id uuid references public.journal_articles(id) on delete set null,
 subscription_id text,
 amount_cents bigint not null check(amount_cents>=0),
 currency text not null check(currency in ('USD','EUR')),
 method text not null,
 paid_at timestamptz not null,
 primary key(provider,provider_id)
);
create table public.journal_billing_events (
 provider text not null,
 event_id text not null,
 created_at timestamptz not null default now(),
 primary key(provider,event_id)
);
alter table public.journal_profiles enable row level security;
alter table public.journal_subscriptions enable row level security;
alter table public.journal_payments enable row level security;
alter table public.journal_billing_events enable row level security;
revoke all on public.journal_profiles,public.journal_subscriptions,public.journal_payments,public.journal_billing_events from public,anon,authenticated;
grant all on public.journal_profiles,public.journal_subscriptions,public.journal_payments,public.journal_billing_events to service_role;
create index journal_subscriptions_user_idx on public.journal_subscriptions(user_id);
create index journal_subscriptions_article_idx on public.journal_subscriptions(article_id);
create index journal_payments_user_idx on public.journal_payments(user_id);
create index journal_payments_article_idx on public.journal_payments(article_id);
create index journal_payments_paid_at_idx on public.journal_payments(paid_at);
create or replace function public.journal_billing_event(provider_name text,event_key text,subscription_data jsonb,payment_data jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 insert into public.journal_billing_events(provider,event_id) values(provider_name,event_key) on conflict do nothing;
 if not found then return false; end if;
 if subscription_data is not null then
  insert into public.journal_subscriptions(provider,provider_id,user_id,article_id,status,active,expires_at,renews,event_at,mode)
  values(provider_name,subscription_data->>'id',(subscription_data->>'user_id')::uuid,(subscription_data->>'article_id')::uuid,
   subscription_data->>'status',(subscription_data->>'active')::boolean,(subscription_data->>'expires_at')::timestamptz,
   (subscription_data->>'renews')::boolean,(subscription_data->>'event_at')::timestamptz,coalesce(subscription_data->>'mode','live'))
  on conflict(provider,provider_id) do update set status=excluded.status,active=excluded.active,expires_at=excluded.expires_at,
   renews=excluded.renews,event_at=excluded.event_at,mode=excluded.mode
  where public.journal_subscriptions.event_at<=excluded.event_at;
 end if;
 if payment_data is not null then
  insert into public.journal_payments(provider,provider_id,user_id,article_id,subscription_id,amount_cents,currency,method,paid_at,mode)
  values(provider_name,payment_data->>'id',(payment_data->>'user_id')::uuid,(payment_data->>'article_id')::uuid,
   payment_data->>'subscription_id',(payment_data->>'amount_cents')::bigint,payment_data->>'currency',payment_data->>'method',
   (payment_data->>'paid_at')::timestamptz,coalesce(payment_data->>'mode','live')) on conflict do nothing;
 end if;
 return true;
end; $$;
revoke all on function public.journal_billing_event(text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.journal_billing_event(text,text,jsonb,jsonb) to service_role;
commit;
