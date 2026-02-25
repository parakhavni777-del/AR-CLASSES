const SUPABASE_URL = "https://kgijlxshajimjbqcrygg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG";
window.__facultyDbClient = window.__facultyDbClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getDbClient() {
    if (window.__facultyDbClient && typeof window.__facultyDbClient.from === 'function') {
        return window.__facultyDbClient;
    }
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        window.__facultyDbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.__facultyDbClient;
    }
    throw new Error('Supabase client not initialized');
}

// Backward-compatible alias used in existing functions.
var supabase = getDbClient();
const NOTE_BUCKET = 'notes-files';
const MAX_NOTE_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_NOTE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp'
];

// Authentication Check - Show/Hide sections based on login status
window.addEventListener('load', function() {
    if('serviceWorker' in navigator){
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    if(localStorage.getItem('facultyAuth') && localStorage.getItem('currentFaculty')) {
        // User is logged in - show dashboard
        document.getElementById("authSection").style.display="none";
        document.getElementById("dashboardSection").style.display="block";
        let user = JSON.parse(localStorage.getItem('currentFaculty'));
        document.getElementById("welcomeMsg").innerText = "Hey!! "+user.name+" Welcome for today's session 🎯";
        
        // Display current credentials
        document.getElementById("displayFacId").textContent = user.id || 'Not Assigned';
        document.getElementById("displayFacPass").textContent = user.password || 'Not Assigned';
        
        loadFacultyClasses();
        loadStudentsForMarks();
        displayNotes();
    } else {
        // User not logged in - show registration/login
        document.getElementById("authSection").style.display="block";
        document.getElementById("dashboardSection").style.display="none";
        document.getElementById("registerSection").style.display="block";
        document.getElementById("loginSection").style.display="none";
        document.getElementById("registerBtn").classList.add("active");
        document.getElementById("loginBtn").classList.remove("active");
    }
});

function logoutFaculty() {
    if(confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('facultyAuth');
        localStorage.removeItem('currentFaculty');
        window.location.href = 'index.html';
    }
}

// CHANGE CREDENTIALS FUNCTION
async function changeCredentials(){
    const saveBtn = document.getElementById('changeCredBtn');
    await withButtonLoading(saveBtn, 'Saving...', async () => {
    let newId = document.getElementById('newFacId').value.trim();
    let newPass = document.getElementById('newFacPass').value.trim();

    if(!newId || !newPass){
        alert('Please fill in both Faculty ID and Password fields');
        return;
    }

    if(newId.length < 3){
        alert('Faculty ID must be at least 3 characters');
        return;
    }

    if(newPass.length < 4){
        alert('Password must be at least 4 characters');
        return;
    }

    let currentFac = JSON.parse(localStorage.getItem('currentFaculty'));
    if(!currentFac || !currentFac.row_id){
        alert('Faculty session not found. Please login again.');
        return;
    }

    const { error } = await supabase
        .from('faculty')
        .update({ faculty_code: newId, password_legacy: newPass })
        .eq('id', currentFac.row_id);

    if(error){
        alert('Failed to update credentials: ' + error.message);
        return;
    }

    currentFac.id = newId;
    currentFac.password = newPass;
    localStorage.setItem('currentFaculty', JSON.stringify(currentFac));

    document.getElementById("displayFacId").textContent = newId;
    document.getElementById("displayFacPass").textContent = newPass;
    document.getElementById('newFacId').value = '';
    document.getElementById('newFacPass').value = '';

    alert('Credentials updated successfully!');
    });
}
function showRegister() {
    document.getElementById("registerSection").style.display="block";
    document.getElementById("loginSection").style.display="none";
    document.getElementById("registerBtn").classList.add("active");
    document.getElementById("loginBtn").classList.remove("active");
}

function showLogin(){
    document.getElementById("registerSection").style.display="none";
    document.getElementById("loginSection").style.display="block";
    document.getElementById("loginBtn").classList.add("active");
    document.getElementById("registerBtn").classList.remove("active");
}

/* ARRAYS TO TRACK SELECTED SUBJECTS AND CLASSES */
let selectedSubjectsList = [];
let selectedClassesList = [];

/* ADD SUBJECT TO SELECTION */
function addSubject(){
    let subjectsDropdown = document.getElementById("subjects");
    let selected = subjectsDropdown.value;
    
    if(!selected){
        alert("❌ Please select a subject");
        return;
    }
    
    if(selectedSubjectsList.includes(selected)){
        alert("⚠️ This subject is already added");
        return;
    }
    
    selectedSubjectsList.push(selected);
    updateTables();
    subjectsDropdown.value = "";
}

/* ADD CLASS TO SELECTION */
function addClass(){
    let classesDropdown = document.getElementById("classes");
    let selected = classesDropdown.value;
    
    if(!selected){
        alert("❌ Please select a class");
        return;
    }
    
    if(selectedClassesList.includes(selected)){
        alert("⚠️ This class is already added");
        return;
    }
    
    selectedClassesList.push(selected);
    updateTables();
    classesDropdown.value = "";
}

/* REMOVE SUBJECT FROM SELECTION */
function removeSubject(index){
    selectedSubjectsList.splice(index, 1);
    updateTables();
}

/* REMOVE CLASS FROM SELECTION */
function removeClass(index){
    selectedClassesList.splice(index, 1);
    updateTables();
}

/* UPDATE REVIEW TABLES */
function updateTables(){
    // Update subjects table
    let subjectsTable = document.getElementById("selectedSubjectsTable");
    if(selectedSubjectsList.length === 0){
        subjectsTable.innerHTML = '<tr><td colspan="2" style="padding: 10px; text-align: center; color: #999;">No subjects added yet</td></tr>';
    } else {
        subjectsTable.innerHTML = selectedSubjectsList.map((sub, index) => `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px;"><i class="fas fa-book" style="color: #2a5298; margin-right: 8px;"></i>${sub}</td>
                <td style="padding: 10px; text-align: center;">
                    <button type="button" onclick="removeSubject(${index})" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    // Update classes table
    let classesTable = document.getElementById("selectedClassesTable");
    if(selectedClassesList.length === 0){
        classesTable.innerHTML = '<tr><td colspan="2" style="padding: 10px; text-align: center; color: #999;">No classes added yet</td></tr>';
    } else {
        classesTable.innerHTML = selectedClassesList.map((cls, index) => `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 10px;"><i class="fas fa-graduation-cap" style="color: #2a5298; margin-right: 8px;"></i>${cls}</td>
                <td style="padding: 10px; text-align: center;">
                    <button type="button" onclick="removeClass(${index})" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

/* REGISTER */
async function registerFaculty(){
try {
let registerBtn = document.getElementById("registerFacultyBtn");
if(registerBtn) setButtonLoading(registerBtn, true, 'Registering...');

let name=document.getElementById("name").value.trim();
let qualification=document.getElementById("qualification").value.trim();
let contact=document.getElementById("contact").value.trim();

if(!name||!qualification||!contact||selectedSubjectsList.length==0||selectedClassesList.length==0){
    alert("Please fill all details and select at least one subject and one class");
    return;
}

if(contact.length!=10){
    alert("Contact must be 10 digits");
    return;
}

const db = getDbClient();

const { data: existing, error: findError } = await db
    .from('faculty')
    .select('id,name,contact')
    .eq('contact', contact);

if(findError){
    alert('Registration failed: ' + findError.message);
    return;
}

let exists=(existing||[]).find(f=>(f.name||'').toLowerCase()==name.toLowerCase());
if(exists){
    alert("Faculty already registered with this name and contact");
    return;
}

const { error: insertError } = await db.from('faculty').insert({
    name:name,
    qualification:qualification,
    contact:contact,
    subjects:selectedSubjectsList,
    classes:selectedClassesList,
    status:'pending'
});

let finalInsertError = insertError || null;
if(finalInsertError && /column|schema cache|subjects|classes/i.test(finalInsertError.message || '')){
    const { error: fallbackInsertError } = await db.from('faculty').insert({
        name:name,
        qualification:qualification,
        contact:contact,
        status:'pending'
    });
    finalInsertError = fallbackInsertError || null;
}

if(finalInsertError){
    alert('Registration failed: ' + finalInsertError.message);
    return;
}

alert("Registration Successful!\n\nWait for Admin Approval. Redirecting to login...");
setTimeout(()=>{location.href="index.html";}, 1000);
} catch (err) {
    alert('Registration failed: ' + (err && err.message ? err.message : err));
} finally {
    let registerBtn = document.getElementById("registerFacultyBtn");
    if(registerBtn) setButtonLoading(registerBtn, false);
}
}

/* LOGIN */
async function facultyLogin(){
    const loginBtn = document.getElementById('facultyLoginBtn');
    await withButtonLoading(loginBtn, 'Logging in...', async () => {
    let facId = document.getElementById("loginFacId").value.trim();
    let facPass = document.getElementById("loginFacPass").value.trim();
    let errorDiv = document.getElementById("facultyLoginError");
    errorDiv.textContent = "";

    const { data, error } = await supabase
        .from('faculty')
        .select('*')
        .eq('faculty_code', facId)
        .eq('password_legacy', facPass)
        .limit(1);

    if(error){
        errorDiv.textContent = error.message || 'Login failed';
        return;
    }

    let row = (data||[])[0];

    if(!row){
        errorDiv.textContent = "Invalid Faculty ID or Password";
        return;
    }
    if(row.status !== "approved"){
        errorDiv.textContent = "Waiting for Admin Approval";
        return;
    }

    const user = {
        ...row,
        row_id: row.id,
        id: row.faculty_code || '',
        password: row.password_legacy || ''
    };

    localStorage.setItem("currentFaculty", JSON.stringify(user));
    localStorage.setItem("facultyAuth", JSON.stringify({authenticated: true}));
    document.getElementById("authSection").style.display="none";
    document.getElementById("dashboardSection").style.display="block";
    document.getElementById("welcomeMsg").innerText =
        "Hey!! " + user.name + " Welcome for today's session";
    document.getElementById("displayFacId").textContent = user.id || "Not Assigned";
    document.getElementById("displayFacPass").textContent = user.password || "Not Assigned";
    loadFacultyClasses();
    loadStudentsForMarks();
    await displayNotes();
    });
}

/* LOAD CLASSES */
function parseFacultyClasses(rawClasses){
    if(Array.isArray(rawClasses)) return rawClasses.map(c => (c || '').toString().trim()).filter(Boolean);
    if(!rawClasses) return [];
    const raw = rawClasses.toString().trim();
    if(!raw) return [];
    // Handles Postgres array string like: {9th,10th}
    if(raw.startsWith('{') && raw.endsWith('}')){
        return raw
            .slice(1, -1)
            .split(',')
            .map(c => c.replace(/^\"|\"$/g, '').trim())
            .filter(Boolean);
    }
    // Handles comma-separated text like: 9th,10th
    if(raw.includes(',')){
        return raw.split(',').map(c => c.trim()).filter(Boolean);
    }
    return [raw];
}

function loadFacultyClasses(){

let currentFaculty = JSON.parse(localStorage.getItem("currentFaculty"));
if(!currentFaculty) return;

let dropdown=document.getElementById("attClass");
let noteDropdown=document.getElementById("noteClass");
let ttDropdown=document.getElementById("ttClass");
let marksClassDropdown=document.getElementById("marksClass");

dropdown.innerHTML='<option value="">Select Class</option>';
noteDropdown.innerHTML='';
if(ttDropdown) ttDropdown.innerHTML='';
if(marksClassDropdown) marksClassDropdown.innerHTML='<option value="">Select Class</option>';

const parsedClasses = parseFacultyClasses(currentFaculty.classes);
const classesToUse = parsedClasses.length > 0
    ? parsedClasses
    : ['4th','5th','6th','7th','8th','9th','10th','11th','12th'];

classesToUse.forEach(cls=>{
let option=document.createElement("option");
option.value=cls;
option.textContent=cls;
dropdown.appendChild(option);

let option2=document.createElement("option");
option2.value=cls;
option2.textContent=cls;
noteDropdown.appendChild(option2);

if(ttDropdown){
    let option3=document.createElement("option");
    option3.value=cls;
    option3.textContent=cls;
    ttDropdown.appendChild(option3);
}

if(marksClassDropdown){
    let option4=document.createElement("option");
    option4.value=cls;
    option4.textContent=cls;
    marksClassDropdown.appendChild(option4);
}
});
}

let currentAttendanceStudents = [];

function normalizeClassToken(value){
    const raw = (value || '').toString().trim().toLowerCase();
    if(!raw) return '';
    const m = raw.match(/\d{1,2}/);
    return m ? m[0] : raw.replace(/[^a-z0-9]/g, '');
}

function isUuid(value){
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test((value || '').toString());
}

async function resolveFacultySessionRow(currentFaculty){
    if(!currentFaculty) return null;

    const directId = currentFaculty.row_id || null;
    if(directId && isUuid(directId)){
        const { data: byId } = await supabase
            .from('faculty')
            .select('id,name,faculty_code,contact')
            .eq('id', directId)
            .limit(1);
        if((byId || [])[0]){
            const row = byId[0];
            const merged = { ...currentFaculty, ...row, row_id: row.id };
            localStorage.setItem('currentFaculty', JSON.stringify(merged));
            return merged;
        }
    }

    const code = (currentFaculty.id || currentFaculty.faculty_code || '').toString().trim();
    if(code){
        const { data: byCode } = await supabase
            .from('faculty')
            .select('id,name,faculty_code,contact')
            .eq('faculty_code', code)
            .limit(1);
        if((byCode || [])[0]){
            const row = byCode[0];
            const merged = { ...currentFaculty, ...row, row_id: row.id, id: row.faculty_code || code };
            localStorage.setItem('currentFaculty', JSON.stringify(merged));
            return merged;
        }
    }

    return null;
}

/* ATTENDANCE */
async function loadStudentsForAttendance(){

let selectedClass=document.getElementById("attClass").value;
let studentDiv=document.getElementById("studentList");
studentDiv.innerHTML="";

if(!selectedClass) return;
studentDiv.innerHTML = '<p><span class="inline-spinner" aria-hidden="true"></span> Loading students...</p>';

let approvedStudents = [];
let data = null, error = null;
try {
    ({ data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false }));
} catch (err) {
    error = err;
}

if(!error){
    approvedStudents = (data||[])
    .filter(s => {
        const statusToken = ((s.status || '') + '').trim().toLowerCase();
        return normalizeClassToken(s.class) === normalizeClassToken(selectedClass)
            && statusToken.startsWith('approved');
    })
    .map(s => ({
        ...s,
        row_id: s.id,
        name: ((s.first_name||'') + ' ' + (s.last_name||'')).trim(),
        id: s.student_code || ''
    }));
}

if(error){
    studentDiv.innerHTML = "<p>Failed to load students: " + (error.message || "Unknown error") + "</p>";
    return;
}

approvedStudents = approvedStudents.map(s => ({
    ...s,
    name: s.name || ((s.first_name||s.firstName||'') + ' ' + (s.last_name||s.lastName||'')).trim()
}));

currentAttendanceStudents = approvedStudents;

if(approvedStudents.length===0){
studentDiv.innerHTML="<p>No approved students found.</p>";
return;
}

approvedStudents.forEach((student, idx)=>{
let row=document.createElement("div");
row.innerHTML=`
<label>
${student.name}
<select data-index="${idx}" data-name="${student.name}">
<option value="Present">Present</option>
<option value="Absent">Absent</option>
</select>
</label>
`;
studentDiv.appendChild(row);
});
}

async function saveAttendance(){
const saveBtn = document.getElementById('saveAttendanceBtn');
await withButtonLoading(saveBtn, 'Saving attendance...', async () => {

let date=document.getElementById("attDate").value;
let selectedClass=document.getElementById("attClass").value;
let subject = document.getElementById("noteSubject").value || 'General';

if(!date||!selectedClass){
alert("Select date and class");
return;
}

let currentFaculty = JSON.parse(localStorage.getItem("currentFaculty"));
if(!currentFaculty){
    alert('Please login again');
    return;
}

let inserts=[];
document.querySelectorAll("#studentList select").forEach(select=>{
  let idx = parseInt(select.getAttribute("data-index"),10);
  let stu = currentAttendanceStudents[idx];
  if(!stu) return;
  inserts.push({
    student_id: stu.row_id,
    faculty_id: currentFaculty.row_id,
    date: date,
    class: selectedClass,
    subject: subject,
    status: select.value
  });
});

if(inserts.length===0){
    alert('No students to save');
    return;
}

const { error } = await supabase.from('attendance').insert(inserts);
if(error){
    alert('Failed to save attendance: ' + error.message);
    return;
}

alert("Attendance Saved Successfully");
});
}

/* UPLOAD NOTES */
async function uploadNote(){
const uploadBtn = document.getElementById('uploadNoteBtn');
await withButtonLoading(uploadBtn, 'Uploading...', async () => {

let title=document.getElementById("noteTitle").value.trim();
let selectedClass=document.getElementById("noteClass").value;
let subject=document.getElementById("noteSubject").value;
let fileInput=document.getElementById("noteFile");

if(!title||!selectedClass||!subject||fileInput.files.length===0){
alert("Fill all details");
return;
}

let currentFaculty=JSON.parse(localStorage.getItem("currentFaculty"));
if(!currentFaculty){
    alert('Please login again');
    return;
}

const resolvedFaculty = await resolveFacultySessionRow(currentFaculty);
if(!resolvedFaculty || !resolvedFaculty.row_id){
    alert('Faculty session is outdated. Please logout and login again.');
    return;
}

let file=fileInput.files[0];
if(file.size > MAX_NOTE_FILE_BYTES){
    alert('File size should be 15 MB or less.');
    return;
}
if(file.type && !ALLOWED_NOTE_TYPES.includes(file.type)){
    alert('File type not supported. Upload PDF, Word, PPT, Excel, text, or image files.');
    return;
}

const sanitizedFileName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
const path = `faculty-${resolvedFaculty.row_id}/${Date.now()}-${sanitizedFileName}`;

const { error: uploadError } = await supabase.storage
    .from(NOTE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });

if(uploadError){
    alert('File upload failed: ' + uploadError.message);
    return;
}

const payload = {
    faculty_id: resolvedFaculty.row_id,
    faculty_name: resolvedFaculty.name || currentFaculty.name,
    title: title,
    subject: subject,
    class: selectedClass,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    file_ext: (file.name.split('.').pop() || '').toLowerCase(),
    storage_path: path,
    file_url: ''
};

const { error } = await supabase.from('notes').insert(payload);
if(error){
    const fallbackPayload = {
        faculty_id: resolvedFaculty.row_id,
        faculty_name: resolvedFaculty.name || currentFaculty.name,
        title: title,
        subject: subject,
        class: selectedClass,
        file_name: file.name,
        file_type: file.type,
        storage_path: path,
        file_url: ''
    };
    const { error: fallbackError } = await supabase.from('notes').insert(fallbackPayload);
    if(fallbackError){
        await supabase.storage.from(NOTE_BUCKET).remove([path]);
        alert('Upload metadata failed: ' + fallbackError.message);
        return;
    }
}

alert("Uploaded Successfully");
fileInput.value = '';
document.getElementById('noteTitle').value = '';
await displayNotes();
});
}

async function getNoteDownloadUrl(note){
    if(note.file_url && /^https?:/i.test(note.file_url)) return note.file_url;
    if(!note.storage_path) return note.file_url || '#';
    const { data, error } = await supabase.storage.from(NOTE_BUCKET).createSignedUrl(note.storage_path, 3600);
    if(error || !data || !data.signedUrl) return '#';
    return data.signedUrl;
}

let myNotesCache = [];

/* DISPLAY NOTES */
async function displayNotes(){

let currentFaculty=JSON.parse(localStorage.getItem("currentFaculty"));
if(!currentFaculty) return;

const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('faculty_name', currentFaculty.name)
    .order('created_at', { ascending: false });

if(error){
    console.error(error);
    return;
}

let myNotes=(data||[]);
myNotesCache = myNotes;

let tableBody=document.getElementById("notesList");
setTableLoading(tableBody, 'Loading uploaded files...', 6);

if(myNotes.length===0){
tableBody.innerHTML=`
<tr>
<td colspan="6" style="text-align:center;">No uploads yet</td>
</tr>`;
return;
}

for(let index = 0; index < myNotes.length; index++){
let note = myNotes[index];
let formattedDate= note.created_at ? new Date(note.created_at).toLocaleDateString() : '-';
let downloadUrl = await getNoteDownloadUrl(note);

 tableBody.innerHTML+=`
<tr>
<td>${note.title}</td>
<td>${note.subject}</td>
<td>${note.class}</td>
<td>${formattedDate}</td>
<td>${note.file_name || '-'}</td>
<td>
<button onclick="window.open('${downloadUrl}','_blank')">Preview</button>
<a href="${downloadUrl}" download="${note.file_name || 'note'}"><button>Download</button></a>
<button onclick="editNote(${index})">Edit</button>
<button onclick="deleteNote(${index})">Delete</button>
</td>
</tr>
`;
}
}

/* preview file  */
function previewFile(fileData,fileType){
if((fileType||'').includes("image")){
let win=window.open("");
win.document.write("<img src='"+fileData+"' width='100%'>");
}
else if((fileType||'').includes("pdf")){
window.open(fileData);
}
else{
window.open(fileData);
}
}

/* EDIT NOTE */
async function editNote(index){
let noteToEdit=myNotesCache[index];
if(!noteToEdit) return;

let newTitle=prompt("Enter New Title",noteToEdit.title);
if(!newTitle) return;

let updates = { title: newTitle };

let replace=confirm("Do you want to replace the file?");
if(replace){
let fileInput=document.createElement("input");
fileInput.type="file";
fileInput.accept=".pdf,.doc,.docx,image/*";

fileInput.onchange=async function(){
let file=fileInput.files[0];
if(!file) return;
if(file.size > MAX_NOTE_FILE_BYTES){
    alert('File size should be 15 MB or less.');
    return;
}
const currentFaculty=JSON.parse(localStorage.getItem("currentFaculty"));
const sanitizedFileName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
const path = `faculty-${currentFaculty.row_id}/${Date.now()}-${sanitizedFileName}`;
const { error: uploadError } = await supabase.storage
    .from(NOTE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
if(uploadError){ alert('File upload failed: ' + uploadError.message); return; }
updates.file_name = file.name;
updates.file_type = file.type;
updates.file_size = file.size;
updates.file_ext = (file.name.split('.').pop() || '').toLowerCase();
updates.storage_path = path;
updates.file_url = '';
const { error } = await supabase.from('notes').update(updates).eq('id', noteToEdit.id);
if(error){ alert('Update failed: ' + error.message); return; }
await displayNotes();
};

fileInput.click();

}else{
const { error } = await supabase.from('notes').update(updates).eq('id', noteToEdit.id);
if(error){ alert('Update failed: ' + error.message); return; }
await displayNotes();
}

}

/* DELETE NOTE */
async function deleteNote(index){
let noteToDelete=myNotesCache[index];
if(!noteToDelete) return;

if(noteToDelete.storage_path){
    await supabase.storage.from(NOTE_BUCKET).remove([noteToDelete.storage_path]);
}
const { error } = await supabase.from('notes').delete().eq('id', noteToDelete.id);
if(error){
    alert('Delete failed: ' + error.message);
    return;
}

await displayNotes();
}

async function saveTimetableEntry(){
const saveBtn = document.getElementById('saveTimetableBtn');
await withButtonLoading(saveBtn, 'Saving...', async () => {
let cls = document.getElementById('ttClass').value;
let day = document.getElementById('ttDay').value;
let start = document.getElementById('ttStart').value;
let end = document.getElementById('ttEnd').value;
let subject = document.getElementById('ttSubject').value.trim();
let room = document.getElementById('ttRoom').value.trim();
if(!cls || !day || !start || !end || !subject){
    alert('Please fill class, day, timings, and subject');
    return;
}
let currentFaculty = JSON.parse(localStorage.getItem("currentFaculty"));
if(!currentFaculty){ alert('Please login again'); return; }

const { error } = await supabase.from('timetables').insert({
    class: cls,
    day_of_week: day,
    start_time: start,
    end_time: end,
    subject: subject,
    room: room,
    faculty_id: currentFaculty.row_id,
    faculty_name: currentFaculty.name
});
if(error){ alert('Failed to save timetable: ' + error.message); return; }
alert('Timetable entry saved');
document.getElementById('ttStart').value = '';
document.getElementById('ttEnd').value = '';
document.getElementById('ttSubject').value = '';
document.getElementById('ttRoom').value = '';
});
}

let marksStudentsCache = [];
async function loadStudentsForMarks(){
let cls = document.getElementById('marksClass') ? document.getElementById('marksClass').value : '';
let studentSelect = document.getElementById('marksStudent');
if(!studentSelect) return;
studentSelect.innerHTML = '<option value=\"\">Loading students...</option>';
if(!cls) return;

const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
if(error){ return; }
marksStudentsCache = (data || []).filter(s =>
    normalizeClassToken(s.class) === normalizeClassToken(cls) &&
    ((s.status || '').toString().toLowerCase() === 'approved')
);
marksStudentsCache.forEach((s, idx) => {
    const name = ((s.first_name || '') + ' ' + (s.last_name || '')).trim();
    studentSelect.innerHTML += '<option value=\"' + idx + '\">' + name + '</option>';
});
if(marksStudentsCache.length === 0){
    studentSelect.innerHTML = '<option value=\"\">No students found</option>';
}
}

async function saveExamMarks(){
const saveBtn = document.getElementById('saveMarksBtn');
await withButtonLoading(saveBtn, 'Saving marks...', async () => {
let cls = document.getElementById('marksClass').value;
let studentIndex = document.getElementById('marksStudent').value;
let subject = document.getElementById('marksSubject').value.trim();
let examName = document.getElementById('marksExamName').value.trim();
let examDate = document.getElementById('marksDate').value;
let maxMarks = Number(document.getElementById('marksMax').value || 0);
let obtained = Number(document.getElementById('marksObtained').value || 0);
let remarks = document.getElementById('marksRemarks').value.trim();
if(!cls || studentIndex === '' || !subject || !examName || !maxMarks){
    alert('Please fill all required marks details');
    return;
}
if(obtained < 0 || obtained > maxMarks){
    alert('Marks obtained should be between 0 and max marks');
    return;
}
const s = marksStudentsCache[Number(studentIndex)];
if(!s){ alert('Select a valid student'); return; }
let currentFaculty = JSON.parse(localStorage.getItem('currentFaculty') || 'null');
if(!currentFaculty){ alert('Please login again'); return; }
const studentName = ((s.first_name || '') + ' ' + (s.last_name || '')).trim();
const { error } = await supabase.from('exam_marks').insert({
    student_id: s.id,
    student_name: studentName,
    class: cls,
    subject: subject,
    exam_name: examName,
    exam_date: examDate || null,
    max_marks: maxMarks,
    marks_obtained: obtained,
    remarks: remarks,
    faculty_id: currentFaculty.row_id,
    faculty_name: currentFaculty.name
});
if(error){ alert('Failed to save marks: ' + error.message); return; }
alert('Marks saved successfully');
document.getElementById('marksSubject').value = '';
document.getElementById('marksExamName').value = '';
document.getElementById('marksDate').value = '';
document.getElementById('marksMax').value = '';
document.getElementById('marksObtained').value = '';
document.getElementById('marksRemarks').value = '';
});
}

/* LOGOUT */
function logout(){
localStorage.removeItem("currentFaculty");
localStorage.removeItem("facultyAuth");
location.href = "index.html";
}
