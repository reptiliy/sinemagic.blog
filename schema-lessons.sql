begin;
alter table public.journal_media drop constraint journal_media_bucket_check;
alter table public.journal_media add constraint journal_media_bucket_check check(bucket in ('journal-covers','journal-media','journal-lessons'));
create table public.journal_lessons (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 1 and 200),
 description text not null default '' check(length(description)<=10000),
 video_id uuid not null references public.journal_media(id),
 cover_id uuid references public.journal_media(id),
 paid boolean not null default true,
 published boolean not null default false,
 author_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.journal_lessons enable row level security;
revoke all on public.journal_lessons from public,anon,authenticated;
grant all on public.journal_lessons to service_role;
create index journal_lessons_video_idx on public.journal_lessons(video_id);
create index journal_lessons_cover_idx on public.journal_lessons(cover_id);
create index journal_lessons_author_idx on public.journal_lessons(author_id);
commit;
