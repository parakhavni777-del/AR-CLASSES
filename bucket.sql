-- Storage RLS policies for notes-files bucket
create policy "notes_files_select_public"
on storage.objects for select
to public
using (bucket_id = 'notes-files');

create policy "notes_files_insert_public"
on storage.objects for insert
to public
with check (bucket_id = 'notes-files');

create policy "notes_files_update_public"
on storage.objects for update
to public
using (bucket_id = 'notes-files')
with check (bucket_id = 'notes-files');

create policy "notes_files_delete_public"
on storage.objects for delete
to public
using (bucket_id = 'notes-files');
