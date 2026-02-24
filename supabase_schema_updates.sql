-- Run this in Supabase SQL editor.
-- Core tables already used by app: students, faculty, attendance, notes, fee_structure, profiles.

-- 1) Notes metadata upgrades (for Supabase Storage-backed files)
alter table public.notes
    add column if not exists storage_path text,
    add column if not exists file_size bigint,
    add column if not exists file_ext text,
    add column if not exists is_active boolean default true;

-- 2) Student fee tracking columns
alter table public.students
    add column if not exists total_fee numeric default 0,
    add column if not exists paid_fee numeric default 0,
    add column if not exists discount numeric default 0,
    add column if not exists fine numeric default 0,
    add column if not exists parent_code text,
    add column if not exists parent_password_legacy text;

-- 3) Timetable table
create table if not exists public.timetables (
    id uuid primary key default gen_random_uuid(),
    class text not null,
    day_of_week text not null,
    start_time text not null,
    end_time text not null,
    subject text not null,
    faculty_id uuid,
    faculty_name text,
    room text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 4) Exam/Test marks table
create table if not exists public.exam_marks (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null,
    student_name text,
    class text not null,
    subject text not null,
    exam_name text not null,
    max_marks numeric not null,
    marks_obtained numeric not null,
    exam_date date,
    faculty_id uuid,
    faculty_name text,
    remarks text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 5) Fee payment ledger table (manual cash entry)
create table if not exists public.fee_payments (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null,
    class text,
    amount_paid numeric not null,
    payment_date date not null,
    receipt_no text,
    mode text default 'cash',
    note text,
    entered_by text,
    created_at timestamptz not null default now()
);

-- 6) Suggested indexes
create index if not exists idx_timetables_class_day on public.timetables(class, day_of_week);
create index if not exists idx_exam_marks_student on public.exam_marks(student_id, exam_date);
create index if not exists idx_fee_payments_student on public.fee_payments(student_id, payment_date);
create index if not exists idx_notes_class_subject on public.notes(class, subject);

-- 7) Enable RLS + permissive policies for existing anon-key pattern in this project
alter table public.timetables enable row level security;
alter table public.exam_marks enable row level security;
alter table public.fee_payments enable row level security;

drop policy if exists timetables_all_public on public.timetables;
create policy timetables_all_public on public.timetables for all to public using (true) with check (true);

drop policy if exists exam_marks_all_public on public.exam_marks;
create policy exam_marks_all_public on public.exam_marks for all to public using (true) with check (true);

drop policy if exists fee_payments_all_public on public.fee_payments;
create policy fee_payments_all_public on public.fee_payments for all to public using (true) with check (true);

-- Notes table policies might already exist. Ensure all operations are allowed by anon/authenticated roles.
alter table public.notes enable row level security;
drop policy if exists notes_all_public on public.notes;
create policy notes_all_public on public.notes for all to public using (true) with check (true);

-- 7b) Ensure legacy/core tables also allow public app access (required by Admin/Faculty/Student screens)
alter table public.students enable row level security;
alter table public.faculty enable row level security;
alter table public.attendance enable row level security;
alter table public.fee_structure enable row level security;

drop policy if exists students_all_public on public.students;
create policy students_all_public on public.students for all to public using (true) with check (true);

drop policy if exists faculty_all_public on public.faculty;
create policy faculty_all_public on public.faculty for all to public using (true) with check (true);

drop policy if exists attendance_all_public on public.attendance;
create policy attendance_all_public on public.attendance for all to public using (true) with check (true);

drop policy if exists fee_structure_all_public on public.fee_structure;
create policy fee_structure_all_public on public.fee_structure for all to public using (true) with check (true);

-- 8) Grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.timetables to anon, authenticated;
grant select, insert, update, delete on public.exam_marks to anon, authenticated;
grant select, insert, update, delete on public.fee_payments to anon, authenticated;
grant select, insert, update, delete on public.notes to anon, authenticated;
grant select, insert, update, delete on public.students to anon, authenticated;
grant select, insert, update, delete on public.faculty to anon, authenticated;
grant select, insert, update, delete on public.attendance to anon, authenticated;
grant select, insert, update, delete on public.fee_structure to anon, authenticated;
grant update(parent_code, parent_password_legacy, total_fee, paid_fee, discount, fine) on public.students to anon, authenticated;

-- 9) Create the storage bucket once from Supabase Dashboard: Storage > New bucket
-- Bucket name: notes-files
-- Set public bucket ON for easy downloads, OR keep private and use signed URLs.
