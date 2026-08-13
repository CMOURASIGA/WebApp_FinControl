-- White label global do produto, com leitura pública para personalizar inclusive o login.
begin;

create table if not exists public.white_label_settings (
  id boolean primary key default true check (id),
  company_name text not null,
  product_name text not null,
  product_subtitle text not null,
  logo_url text not null,
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  highlight_color text not null check (highlight_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now()
);

insert into public.white_label_settings(id,company_name,product_name,product_subtitle,logo_url,primary_color,highlight_color)
values(true,'Consult Services Tecnologia','7Finance','Gestão financeira e societária','https://i.imgur.com/gxXnYsA.png','#003B73','#00AEEF')
on conflict (id) do nothing;

alter table public.white_label_settings enable row level security;
drop policy if exists white_label_public_select on public.white_label_settings;
drop policy if exists white_label_admin_update on public.white_label_settings;
create policy white_label_public_select on public.white_label_settings for select to anon, authenticated using (true);
create policy white_label_admin_update on public.white_label_settings for update to authenticated
  using ((select private.eh_admin())) with check ((select private.eh_admin()));

grant select on public.white_label_settings to anon, authenticated;
grant update on public.white_label_settings to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('brand-assets','brand-assets',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists brand_assets_public_read on storage.objects;
drop policy if exists brand_assets_admin_insert on storage.objects;
drop policy if exists brand_assets_admin_update on storage.objects;
drop policy if exists brand_assets_admin_delete on storage.objects;
create policy brand_assets_public_read on storage.objects for select to anon, authenticated using (bucket_id='brand-assets');
create policy brand_assets_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id='brand-assets' and (select private.eh_admin()));
create policy brand_assets_admin_update on storage.objects for update to authenticated
  using (bucket_id='brand-assets' and (select private.eh_admin()))
  with check (bucket_id='brand-assets' and (select private.eh_admin()));
create policy brand_assets_admin_delete on storage.objects for delete to authenticated
  using (bucket_id='brand-assets' and (select private.eh_admin()));

comment on table public.white_label_settings is 'Identidade visual global aplicada ao login e ao workspace.';
commit;
