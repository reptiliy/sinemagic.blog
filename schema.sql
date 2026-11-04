begin;
create table public.journal_articles (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 1 and 200),
 summary text not null default '',
 body text not null,
 category text not null check(category in ('analysis','practice')),
 paid boolean not null default false,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.journal_articles enable row level security;
revoke all on public.journal_articles from public,anon,authenticated;
grant select,insert,update on public.journal_articles to service_role;
commit;
