-- User-uploaded can photos.
--
-- This is what brings real photography back. The Open Food Facts images were
-- contributor snapshots of wildly varying quality and were pulled from the UI;
-- a photo someone took of the can they are holding is both better and cleanly
-- licensed through the submission terms.
--
-- Public read, because the photos are the point. Writes are narrow: only a
-- signed-in user, only into a folder named after their own user id, so nobody
-- can overwrite anyone else's upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'can-photos',
  'can-photos',
  true,
  3145728,                                   -- 3 MB; a phone photo resized client-side
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 3145728,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Anyone may look at can photos.
drop policy if exists "can photos are publicly readable" on storage.objects;
create policy "can photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'can-photos');

-- A signed-in user may only write inside their own uid-named folder. The path
-- is <uid>/<something>, and storage.foldername() gives us that first segment.
drop policy if exists "users upload their own can photos" on storage.objects;
create policy "users upload their own can photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'can-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users replace their own can photos" on storage.objects;
create policy "users replace their own can photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'can-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own can photos" on storage.objects;
create policy "users delete their own can photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'can-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Where a submitted photo lives, kept separate from image_url so an Open Food
-- Facts image and a user photo can coexist and be told apart. The UI prefers
-- this one: it was taken deliberately, for this purpose.
alter table public.drinks
  add column if not exists photo_url text,
  add column if not exists photo_by uuid references public.profiles (id) on delete set null;

comment on column public.drinks.photo_url is
  'User-uploaded photo in the can-photos bucket. Preferred over image_url, '
  'which comes from Open Food Facts and is often a poor contributor snapshot.';
