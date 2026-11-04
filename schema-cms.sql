begin;
create table public.journal_media (
 id uuid primary key default gen_random_uuid(),
 bucket text not null check (bucket in ('journal-covers','journal-media')),
 path text not null,
 original_name text not null,
 mime_type text not null,
 size_bytes bigint not null check(size_bytes > 0),
 state text not null default 'pending' check(state in ('pending','ready')),
 uploaded_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(bucket,path)
);
create table public.journal_article_media (
 article_id uuid not null references public.journal_articles(id) on delete cascade,
 media_id uuid not null references public.journal_media(id),
 placement text not null check(placement in ('cover','inline')),
 primary key(article_id,media_id,placement)
);
alter table public.journal_articles add column author_id uuid references auth.users(id) on delete set null;
alter table public.journal_articles add column updated_at timestamptz not null default now();
create table public.journal_settings (
 id boolean primary key default true check(id),
 value jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.journal_media enable row level security;
alter table public.journal_article_media enable row level security;
alter table public.journal_settings enable row level security;
revoke all on public.journal_media,public.journal_article_media,public.journal_settings from public,anon,authenticated;
grant all on public.journal_media,public.journal_article_media,public.journal_settings to service_role;
create index journal_article_media_media_id_idx on public.journal_article_media(media_id);
create index journal_media_uploaded_by_idx on public.journal_media(uploaded_by);
create index journal_articles_author_id_idx on public.journal_articles(author_id);
insert into public.journal_media(bucket,path,original_name,mime_type,size_bytes,state)
select bucket_id,name,name,coalesce(metadata->>'mimetype','application/octet-stream'),
 greatest(coalesce((metadata->>'size')::bigint,1),1),'ready'
from storage.objects where bucket_id in ('journal-covers','journal-media')
on conflict(bucket,path) do nothing;

create function public.journal_save_article(article jsonb, media_refs jsonb, editor_id uuid)
returns setof public.journal_articles
language plpgsql security invoker set search_path = ''
as $$
declare
 saved_id uuid;
 ref jsonb;
begin
 saved_id := (article->>'id')::uuid;
 if saved_id is null then
  insert into public.journal_articles(title,summary,body,category,paid,published,author_id)
  values(article->>'title',article->>'summary',article->>'body',article->>'category',(article->>'paid')::boolean,(article->>'published')::boolean,editor_id)
  returning id into saved_id;
 else
  perform 1 from public.journal_articles where id=saved_id for update;
  if not found then raise exception 'Article not found'; end if;
  update public.journal_articles set title=article->>'title',summary=article->>'summary',body=article->>'body',
   category=article->>'category',paid=(article->>'paid')::boolean,published=(article->>'published')::boolean,updated_at=now()
  where id=saved_id;
 end if;
 delete from public.journal_article_media where article_id=saved_id;
 for ref in select * from jsonb_array_elements(media_refs) loop
  if not exists(select 1 from public.journal_media where id=(ref->>'id')::uuid and state='ready') then
   raise exception 'Media not ready';
  end if;
  insert into public.journal_article_media(article_id,media_id,placement)
  values(saved_id,(ref->>'id')::uuid,ref->>'placement') on conflict do nothing;
 end loop;
 return query select * from public.journal_articles where id=saved_id;
end;
$$;
revoke all on function public.journal_save_article(jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.journal_save_article(jsonb,jsonb,uuid) to service_role;
commit;
