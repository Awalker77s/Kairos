insert into storage.buckets (id, name, public)
values ('room-renders', 'room-renders', true)
on conflict do nothing;

create policy "Users can upload their own renders"
on storage.objects for insert
with check (bucket_id = 'room-renders' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Renders are publicly readable"
on storage.objects for select
using (bucket_id = 'room-renders');
