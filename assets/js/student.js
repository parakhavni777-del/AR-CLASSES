const SUPABASE_URL = "https://kgijlxshajimjbqcrygg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG";
window.__studentDbClient = window.__studentDbClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getDbClient() {
    if (window.__studentDbClient && typeof window.__studentDbClient.from === 'function') {
        return window.__studentDbClient;
    }
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        window.__studentDbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.__studentDbClient;
    }
    throw new Error('Supabase client not initialized');
}

// Backward-compatible alias for existing code paths.
var supabase = window.__studentDbClient || null;
const NOTE_BUCKET = 'notes-files';

// Authentication Check - Show/Hide sections based on login status
window.addEventListener('load', function() {
    if('serviceWorker' in navigator){
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    if(localStorage.getItem('studentAuth') && localStorage.getItem('currentStudent')) {
        // User is logged in - show dashboard
        document.getElementById("authBox").classList.add("hidden");
        document.getElementById("studentDashboard").classList.remove("hidden");
        document.getElementById("logoutBtn").classList.remove("hidden");
        loadStudentNotes();
        loadStudentAttendance();
    } else {
        // User not logged in - show registration/login form (registration by default)
        document.getElementById("authBox").classList.remove("hidden");
        document.getElementById("studentDashboard").classList.add("hidden");
        document.getElementById("logoutBtn").classList.add("hidden");
        document.getElementById("registerSection").classList.remove("hidden");
        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("welcomeButtons").classList.add("hidden");
    }
});

let selectedSubjects=[];
let feeStructureCache = [];
let feeLoadError = '';

function normalizeFeeToken(value){
    const raw = (value || '').toString().trim().toLowerCase();
    if(!raw) return '';
    const compact = raw.replace(/[^a-z0-9]/g, '');
    if(compact === 'math' || compact === 'mathematics') return 'maths';
    if(compact === 'socialstudies' || compact === 'sst' || compact === 'socialscience') return 'socialstudies';
    if(compact === 'bst' || compact === 'businessstudy') return 'businessstudies';
    return compact;
}

function normalizeClassToken(value){
    const raw = (value || '').toString().trim().toLowerCase();
    if(!raw) return '';
    const numMatch = raw.match(/\d{1,2}/);
    return numMatch ? numMatch[0] : normalizeFeeToken(raw);
}

// --- Navigation ---
function showRegister(){
    document.getElementById("registerSection").classList.remove("hidden");
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("welcomeButtons").classList.add("hidden");
}

function showLogin(){
    document.getElementById("loginSection").classList.remove("hidden");
    document.getElementById("registerSection").classList.add("hidden");
    document.getElementById("welcomeButtons").classList.add("hidden");
}

function logout(){
    if(confirm('Are you sure you want to logout?')) {
        localStorage.removeItem("currentStudent");
        localStorage.removeItem("studentAuth");
        window.location.href = "index.html";
    }
}

// --- Subject Logic ---
async function updateSubjects(){
    let cls = document.getElementById("class").value;
    let dropdown = document.getElementById("subjectDropdown");
    dropdown.innerHTML = '<option value="">Select Subject</option>';

    let subjects = [];
    if(['4th','5th','6th','7th','8th'].includes(cls)){
        subjects=["English","Maths","Sanskrit","Science","Social Studies","Hindi"];
    } else if(['9th','10th','11th','12th'].includes(cls)){
        // Use configured fee types so selected subjects always match configured rows.
        const fees = await getFeeStructure();
        const classFees = fees.filter(f => normalizeClassToken(f.class) === normalizeClassToken(cls));
        const dynamicSubjects = [...new Set(classFees.map(f => (f.type || '').toString().trim()).filter(Boolean))];
        if(dynamicSubjects.length > 0){
            subjects = dynamicSubjects;
        } else if(['9th','10th'].includes(cls)){
            subjects=["English","Maths","Science","Social Studies"];
        } else {
            subjects=["Accounts","Business Studies","Economics"];
        }
    }

    subjects.forEach(sub=>{
        let opt = document.createElement("option");
        opt.text = sub; opt.value = sub;
        dropdown.appendChild(opt);
    });

    selectedSubjects = [];
    document.getElementById("subjectTable").innerHTML = "";
    document.getElementById("monthlyFee").value = "";
    
    // Update fee label based on class
    updateFeeLabel(cls);
}

function updateFeeLabel(cls){
    let feeLabel = document.getElementById("feeLabel");
    let feeInfo = document.getElementById("feeInfo");
    
    if(['4th','5th','6th','7th','8th'].includes(cls)){
        feeLabel.textContent = "Monthly Fee (April-March) *";
        feeInfo.innerHTML = "<strong style='color: #2a5298;'>Class " + cls + ":</strong> Monthly fee calculated for 12 months (April to March)";
    } else if(['9th','10th','11th','12th'].includes(cls)){
        feeLabel.textContent = "Yearly Course Fee *";
        feeInfo.innerHTML = "<strong style='color: #2a5298;'>Class " + cls + ":</strong> Annual course fee per subject";
    }
}

function addSubject(){
    let sub = document.getElementById("subjectDropdown").value;
    if(sub && !selectedSubjects.includes(sub)){
        selectedSubjects.push(sub);
        renderSubjects();
        calculateFee();
    }
}

function removeSubject(index){
    selectedSubjects.splice(index,1);
    renderSubjects();
    calculateFee();
}

function renderSubjects(){
    let table = document.getElementById("subjectTable");
    table.innerHTML = "";
    selectedSubjects.forEach((sub,index)=>{
        let row = document.createElement("tr");
        row.innerHTML = `<td>${sub}</td>
        <td><button class="action-btn" type="button" onclick="removeSubject(${index})">Remove</button></td>`;
        table.appendChild(row);
    });
}

async function getFeeStructure(){
    feeLoadError = '';
    try {
        const { data, error } = await getDbClient()
            .from('fee_structure')
            .select('*')
            .order('class')
            .order('type');
        if(error){
            feeLoadError = error.message || 'Failed to load fee structure';
            feeStructureCache = [];
            return feeStructureCache;
        }
        feeStructureCache = Array.isArray(data) ? data : [];
        return feeStructureCache;
    } catch (err) {
        feeLoadError = (err && err.message) ? err.message : 'Failed to load fee structure';
        feeStructureCache = [];
        return feeStructureCache;
    }
}

async function calculateFee(){
    let selectedClass = document.getElementById("class").value;
    let fees = await getFeeStructure();
    let total = 0;

    if(!selectedClass || selectedSubjects.length === 0){
        document.getElementById("monthlyFee").value = "";
        return;
    }

    // normalize class key for robust matching
    let clsNorm = normalizeClassToken(selectedClass);

    let feeWarningEl = document.getElementById("feeWarning");
    feeWarningEl.classList.add('hidden');
    feeWarningEl.textContent = '';
    if(feeLoadError){
        feeWarningEl.textContent = 'Unable to load latest fee structure: ' + feeLoadError;
        feeWarningEl.classList.remove('hidden');
        document.getElementById("monthlyFee").value = "";
        return;
    }

    if(['4th','5th','6th','7th','8th'].includes(selectedClass)){
        let count = selectedSubjects.length;
        let combination = "";
        if(count==1) combination="Any1";
        else if(count==2) combination="Any2";
        else if(count==3) combination="Any3";
        else if(count==4) combination="Any4";
        else if(count>=5) combination="All";

        let match = fees.find(f=> normalizeClassToken(f.class)===clsNorm && normalizeFeeToken(f.type)===normalizeFeeToken(combination));
        if(match) {
            total = parseInt(match.amount) || 0;
        } else {
            feeWarningEl.textContent = 'No fee configured for selected class/combination. Please contact admin.';
            feeWarningEl.classList.remove('hidden');
        }
    } else if(['9th','10th','11th','12th'].includes(selectedClass)){
        let missing = [];
        selectedSubjects.forEach(sub=>{
            let subNorm = normalizeFeeToken(sub);
            let match = fees.find(f=> normalizeClassToken(f.class)===clsNorm && normalizeFeeToken(f.type)===subNorm);
            if(match) total += parseInt(match.amount) || 0;
            else missing.push(sub);
        });

        if(missing.length === selectedSubjects.length){
            feeWarningEl.textContent = 'No fees configured for the selected subjects. Please contact admin.';
            feeWarningEl.classList.remove('hidden');
        } else if(missing.length > 0){
            feeWarningEl.textContent = 'Some subjects are missing fee configuration: ' + missing.join(', ') + '. Contact admin.';
            feeWarningEl.classList.remove('hidden');
        }
    }

    document.getElementById("monthlyFee").value = total ? total : "";
}

// --- CORE REGISTRATION ---
async function registerStudent(e){
    if(e && typeof e.preventDefault === 'function') e.preventDefault();

    const feeValue = Number(document.getElementById("monthlyFee").value || 0);
    if(!document.getElementById("class").value || selectedSubjects.length === 0){
        alert("Please select class and at least one subject");
        return;
    }
    if(feeValue <= 0){
        alert("Fee is not configured for the selected class/subjects. Please contact admin.");
        return;
    }
    if(feeLoadError){
        alert("Cannot register right now because latest fee structure could not be loaded: " + feeLoadError);
        return;
    }

    const payload = {
        first_name: document.getElementById("firstName").value,
        last_name: document.getElementById("lastName").value,
        school: document.getElementById("school").value,
        guardian: document.getElementById("guardian").value,
        guardian_mobile: document.getElementById("guardianMobile").value,
        class: document.getElementById("class").value,
        subjects: selectedSubjects,
        monthly_fee: feeValue,
        course_fee: feeValue,
        status: "pending"
    };

    const { error } = await getDbClient().from('students').insert(payload);
    if(error){
        alert('Registration failed: ' + error.message);
        return;
    }

    alert("Registration Submitted. Wait for Admin Approval. Admin will assign your Student ID and Password.");
    location.reload();
}

// --- LOGIN ---
async function loginStudent(){
    let id = document.getElementById("loginId").value.trim();
    let pass = document.getElementById("loginPass").value;

    let data = null, error = null;
    try {
        ({ data, error } = await getDbClient()
            .from('students')
            .select('*')
            .eq('student_code', id)
            .eq('password_legacy', pass)
            .limit(1));
    } catch (err) {
        error = err;
    }

    if(error){
        alert((error && error.message) ? error.message : 'Login failed');
        return;
    }

    let row = (data || [])[0];
    if(!row){
        alert("Invalid ID or Password");
        return;
    }

    if(row.status !== "approved"){
        alert("Not approved by Admin yet.");
        return;
    }

    const user = {
        ...row,
        row_id: row.id,
        id: row.student_code || '',
        password: row.password_legacy || '',
        name: ((row.first_name||'') + ' ' + (row.last_name||'')).trim(),
        firstName: row.first_name || '',
        lastName: row.last_name || '',
        guardianMobile: row.guardian_mobile || ''
    };

    localStorage.setItem("currentStudent", JSON.stringify(user));
    localStorage.setItem("studentAuth", JSON.stringify({authenticated: true}));
    alert("Login Successful.");
    location.reload();
}

// --- Data Loading ---
async function loadStudentNotes(){
    let currentStudent = JSON.parse(localStorage.getItem("currentStudent"));
    if(!currentStudent) return;

    let table = document.getElementById("studentNotesList");
    let subjectFilter = document.getElementById("studentSubjectFilter").value;

    const { data, error } = await getDbClient()
        .from('notes')
        .select('*')
        .eq('class', currentStudent.class)
        .order('created_at', { ascending: false });

    if(error){
        table.innerHTML = `<tr><td colspan="4">Failed to load notes</td></tr>`;
        return;
    }

    let studentNotes = data || [];
    table.innerHTML = "";

    let subjects = [...new Set(studentNotes.map(n => n.subject))];
    let filterDropdown = document.getElementById("studentSubjectFilter");
    filterDropdown.innerHTML = '<option value="">All Subjects</option>';
    subjects.forEach(sub=>{
        let opt = document.createElement("option");
        opt.value = sub; opt.text = sub;
        filterDropdown.add(opt);
    });

    if(subjectFilter) studentNotes = studentNotes.filter(n => n.subject == subjectFilter);

    if(studentNotes.length === 0){
        table.innerHTML = `<tr><td colspan="4">No notes available</td></tr>`;
        return;
    }

    for (const note of studentNotes){
        const date = note.created_at ? new Date(note.created_at).toLocaleDateString() : '-';
        const url = await getNoteDownloadUrl(note);
        table.innerHTML += `<tr>
            <td>${note.title || '-'}</td>
            <td>${note.subject || '-'}</td>
            <td>${date}</td>
            <td><a href="${url}" download="${note.file_name || 'note'}"><button class="primary-btn">Download</button></a></td>
        </tr>`;
    }
}

async function getNoteDownloadUrl(note){
    if(note.file_url && /^https?:/i.test(note.file_url)) return note.file_url;
    if(!note.storage_path) return note.file_url || '#';
    const { data, error } = await getDbClient().storage.from(NOTE_BUCKET).createSignedUrl(note.storage_path, 3600);
    if(error || !data || !data.signedUrl) return '#';
    return data.signedUrl;
}

async function loadStudentAttendance(){
    let currentStudent = JSON.parse(localStorage.getItem("currentStudent"));
    if(!currentStudent) return;

    let table = document.getElementById("studentAttendanceList");
    table.innerHTML = "";

    const { data, error } = await getDbClient()
        .from('attendance')
        .select('*')
        .eq('student_id', currentStudent.row_id)
        .order('date', { ascending: false });

    if(error){
        table.innerHTML = `<tr><td colspan="3">Failed to load attendance</td></tr>`;
        return;
    }

    (data || []).forEach(record=>{
        table.innerHTML += `<tr>
            <td>${record.date}</td>
            <td>${record.subject || '-'}</td>
            <td>${record.status}</td>
        </tr>`;
    });

    if(table.innerHTML == "") table.innerHTML = `<tr><td colspan="3">No attendance records</td></tr>`;
}

async function loadStudentFeeDetails(){
    let currentStudent = JSON.parse(localStorage.getItem("currentStudent"));
    if(!currentStudent) return;
    const { data: rows, error } = await getDbClient().from('students').select('*').eq('id', currentStudent.row_id).limit(1);
    if(error) return;
    const s = (rows || [])[0] || currentStudent;
    const total = Number(s.total_fee || s.course_fee || s.monthly_fee || 0);
    const paid = Number(s.paid_fee || 0);
    const discount = Number(s.discount || 0);
    const fine = Number(s.fine || 0);
    const due = Math.max(0, total + fine - discount - paid);
    const summary = document.getElementById('studentFeeSummary');
    summary.innerHTML = `
        <p><strong>Total Fee:</strong> Rs. ${total}</p>
        <p><strong>Paid:</strong> Rs. ${paid} | <strong>Discount:</strong> Rs. ${discount} | <strong>Fine:</strong> Rs. ${fine}</p>
        <p><strong>Due:</strong> Rs. ${due}</p>
    `;

    const paymentsTable = document.getElementById('studentPaymentList');
    paymentsTable.innerHTML = '';
    const { data: payments } = await getDbClient()
        .from('fee_payments')
        .select('*')
        .eq('student_id', currentStudent.row_id)
        .order('payment_date', { ascending: false });
    (payments || []).forEach(p => {
        paymentsTable.innerHTML += `<tr>
            <td>${p.payment_date || '-'}</td>
            <td>Rs. ${p.amount_paid || 0}</td>
            <td>${p.receipt_no || '-'}</td>
            <td>${p.mode || 'cash'}</td>
            <td>${p.note || '-'}</td>
        </tr>`;
    });
    if(paymentsTable.innerHTML === ''){
        paymentsTable.innerHTML = '<tr><td colspan=\"5\">No payment entries yet</td></tr>';
    }
}

async function loadStudentTimetable(){
    let currentStudent = JSON.parse(localStorage.getItem("currentStudent"));
    if(!currentStudent) return;
    const tbody = document.getElementById('studentTimetableList');
    tbody.innerHTML = '';
    const { data, error } = await getDbClient().from('timetables').select('*').order('day_of_week').order('start_time');
    if(error){
        tbody.innerHTML = '<tr><td colspan=\"5\">Failed to load timetable</td></tr>';
        return;
    }
    (data || []).forEach(t => {
        if(normalizeClassToken(t.class) !== normalizeClassToken(currentStudent.class)) return;
        tbody.innerHTML += `<tr>
            <td>${t.day_of_week || '-'}</td>
            <td>${t.start_time || '-'} - ${t.end_time || '-'}</td>
            <td>${t.subject || '-'}</td>
            <td>${t.faculty_name || '-'}</td>
            <td>${t.room || '-'}</td>
        </tr>`;
    });
    if(tbody.innerHTML === ''){
        tbody.innerHTML = '<tr><td colspan=\"5\">No timetable entries</td></tr>';
    }
}

async function loadStudentMarks(){
    let currentStudent = JSON.parse(localStorage.getItem("currentStudent"));
    if(!currentStudent) return;
    const tbody = document.getElementById('studentMarksList');
    tbody.innerHTML = '';
    const { data, error } = await getDbClient()
        .from('exam_marks')
        .select('*')
        .eq('student_id', currentStudent.row_id)
        .order('exam_date', { ascending: false });
    if(error){
        tbody.innerHTML = '<tr><td colspan=\"5\">Failed to load marks</td></tr>';
        return;
    }
    (data || []).forEach(m => {
        tbody.innerHTML += `<tr>
            <td>${m.exam_name || '-'}</td>
            <td>${m.subject || '-'}</td>
            <td>${m.exam_date || '-'}</td>
            <td>${m.marks_obtained || 0}/${m.max_marks || 0}</td>
            <td>${m.remarks || '-'}</td>
        </tr>`;
    });
    if(tbody.innerHTML === ''){
        tbody.innerHTML = '<tr><td colspan=\"5\">No marks records</td></tr>';
    }
}

// --- Auth Check on Load ---
function checkAuth(){
    let currentStudent = JSON.parse(localStorage.getItem("currentStudent"));
    if(currentStudent){
        document.getElementById("authBox").classList.add("hidden");
        document.getElementById("studentDashboard").classList.remove("hidden");
        document.getElementById("logoutBtn").classList.remove("hidden");
        loadStudentNotes();
        loadStudentAttendance();
        loadStudentFeeDetails();
        loadStudentTimetable();
        loadStudentMarks();
        loadStudentFeeDetails();
        loadStudentTimetable();
        loadStudentMarks();
    }
}

checkAuth();
getFeeStructure();
