const SUPABASE_URL = "https://kgijlxshajimjbqcrygg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG";
const NOTE_BUCKET = 'notes-files';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeClassToken(v){
  const raw = (v || '').toString().trim().toLowerCase();
  const m = raw.match(/\d{1,2}/);
  return m ? m[0] : raw;
}

async function getNoteUrl(note){
  if (note.file_url && /^https?:/i.test(note.file_url)) return note.file_url;
  if (!note.storage_path) return note.file_url || '#';
  try {
    const { data, error } = await sb.storage.from(NOTE_BUCKET).createSignedUrl(note.storage_path, 3600);
    if (error) return '#';
    return data.signedUrl;
  } catch {
    return '#';
  }
}

async function parentLogin(){
  const id = document.getElementById('parentId').value.trim();
  const pass = document.getElementById('parentPass').value.trim();
  const err = document.getElementById('loginErr');
  err.textContent = '';
  if(!id || !pass){ err.textContent = 'Enter Parent ID and password'; return; }

  const { data, error } = await sb
    .from('students')
    .select('*')
    .eq('parent_code', id)
    .eq('parent_password_legacy', pass)
    .limit(1);

  if(error){ err.textContent = error.message; return; }
  const row = (data || [])[0];
  if(!row){ err.textContent = 'Invalid Parent ID or password'; return; }
  if((row.status || '').toLowerCase() !== 'approved'){ err.textContent = 'Student not approved yet'; return; }

  localStorage.setItem('parentAuth', JSON.stringify({ authenticated: true }));
  localStorage.setItem('currentParentStudent', JSON.stringify({ ...row, row_id: row.id }));
  await loadDashboard();
}

function logoutParent(){
  localStorage.removeItem('parentAuth');
  localStorage.removeItem('currentParentStudent');
  location.reload();
}

async function loadDashboard(){
  const student = JSON.parse(localStorage.getItem('currentParentStudent') || 'null');
  if(!student){ return; }
  document.getElementById('authCard').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');

  const name = ((student.first_name || '') + ' ' + (student.last_name || '')).trim();
  document.getElementById('studentInfo').innerHTML = '<p><strong>Name:</strong> ' + (name || '-') + '</p>' +
    '<p><strong>Class:</strong> ' + (student.class || '-') + '</p>' +
    '<p><strong>Student ID:</strong> ' + (student.student_code || '-') + '</p>';

  const total = Number(student.total_fee || student.course_fee || student.monthly_fee || 0);
  const paid = Number(student.paid_fee || 0);
  const discount = Number(student.discount || 0);
  const fine = Number(student.fine || 0);
  const due = Math.max(0, total + fine - discount - paid);
  document.getElementById('feeSummary').innerHTML = '<p><strong>Total Fee:</strong> Rs. ' + total + '</p>' +
    '<p><strong>Paid:</strong> Rs. ' + paid + ' | <strong>Discount:</strong> Rs. ' + discount + ' | <strong>Fine:</strong> Rs. ' + fine + '</p>' +
    '<p><strong>Due:</strong> Rs. ' + due + '</p>';

  await Promise.all([
    loadParentPayments(student.id),
    loadParentNotes(student.class),
    loadParentAttendance(student.id),
    loadParentTimetable(student.class),
    loadParentMarks(student.id)
  ]);
}

async function loadParentPayments(studentId){
  const { data } = await sb.from('fee_payments').select('*').eq('student_id', studentId).order('payment_date', { ascending: false });
  const tbody = document.getElementById('paymentList');
  tbody.innerHTML = '';
  (data || []).forEach(p => {
    tbody.innerHTML += '<tr><td>' + (p.payment_date || '-') + '</td><td>Rs. ' + (p.amount_paid || 0) + '</td><td>' + (p.receipt_no || '-') + '</td><td>' + (p.mode || 'cash') + '</td><td>' + (p.note || '-') + '</td></tr>';
  });
  if(!tbody.innerHTML) tbody.innerHTML = '<tr><td colspan="5">No payment records</td></tr>';
}

async function loadParentNotes(cls){
  const { data } = await sb.from('notes').select('*').eq('class', cls).order('created_at', { ascending: false });
  const tbody = document.getElementById('noteList');
  tbody.innerHTML = '';
  for (const note of (data || [])) {
    const d = note.created_at ? new Date(note.created_at).toLocaleDateString() : '-';
    const url = await getNoteUrl(note);
    const fileName = note.file_name || 'note';
    tbody.innerHTML += '<tr><td>' + (note.title || '-') + '</td><td>' + (note.subject || '-') + '</td><td>' + d + '</td><td><a href="' + url + '" download="' + fileName + '">Download</a></td></tr>';
  }
  if(!tbody.innerHTML) tbody.innerHTML = '<tr><td colspan="4">No notes</td></tr>';
}

async function loadParentAttendance(studentId){
  const { data } = await sb.from('attendance').select('*').eq('student_id', studentId).order('date', { ascending: false });
  const tbody = document.getElementById('attendanceList');
  tbody.innerHTML = '';
  (data || []).forEach(a => {
    tbody.innerHTML += '<tr><td>' + (a.date || '-') + '</td><td>' + (a.subject || '-') + '</td><td>' + (a.status || '-') + '</td></tr>';
  });
  if(!tbody.innerHTML) tbody.innerHTML = '<tr><td colspan="3">No attendance records</td></tr>';
}

async function loadParentTimetable(cls){
  const { data } = await sb.from('timetables').select('*').order('day_of_week').order('start_time');
  const tbody = document.getElementById('timetableList');
  tbody.innerHTML = '';
  (data || []).filter(t => normalizeClassToken(t.class) === normalizeClassToken(cls)).forEach(t => {
    tbody.innerHTML += '<tr><td>' + (t.day_of_week || '-') + '</td><td>' + (t.start_time || '-') + ' - ' + (t.end_time || '-') + '</td><td>' + (t.subject || '-') + '</td><td>' + (t.faculty_name || '-') + '</td><td>' + (t.room || '-') + '</td></tr>';
  });
  if(!tbody.innerHTML) tbody.innerHTML = '<tr><td colspan="5">No timetable entries</td></tr>';
}

async function loadParentMarks(studentId){
  const { data } = await sb.from('exam_marks').select('*').eq('student_id', studentId).order('exam_date', { ascending: false });
  const tbody = document.getElementById('marksList');
  tbody.innerHTML = '';
  (data || []).forEach(m => {
    tbody.innerHTML += '<tr><td>' + (m.exam_name || '-') + '</td><td>' + (m.subject || '-') + '</td><td>' + (m.exam_date || '-') + '</td><td>' + (m.marks_obtained || 0) + '/' + (m.max_marks || 0) + '</td><td>' + (m.remarks || '-') + '</td></tr>';
  });
  if(!tbody.innerHTML) tbody.innerHTML = '<tr><td colspan="5">No marks records</td></tr>';
}

window.addEventListener('load', () => {
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(() => {}); }
  const authed = JSON.parse(localStorage.getItem('parentAuth') || 'null');
  if(authed && authed.authenticated){ loadDashboard(); }
});
