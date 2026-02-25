// Early bootstrap for any stale references before main scripts load.
window.supbase_url = "https://kgijlxshajimjbqcrygg.supabase.co";
window.supbase_anon_key = "sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG";
window.SUPABASE_URL = window.supbase_url;
window.SUPABASE_ANON_KEY = window.supbase_anon_key;
var supbase_url = window.supbase_url;
var supbase_anon_key = window.supbase_anon_key;

const SUPABASE_URL = "https://kgijlxshajimjbqcrygg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG";
// Backward-compatible aliases for any stale cached references.
var supbase_url = SUPABASE_URL;
var supbase_anon_key = SUPABASE_ANON_KEY;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.supbase_url = supbase_url;
window.supbase_anon_key = supbase_anon_key;
window.__dbClient = window.__dbClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.onerror = function (message, source, lineno, colno) {
    console.error("RuntimeError:", message, source, lineno, colno);
};

function getDbClient() {
    const url =
        (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) ||
        window.SUPABASE_URL ||
        window.supbase_url ||
        "https://kgijlxshajimjbqcrygg.supabase.co";
    const key =
        (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY) ||
        window.SUPABASE_ANON_KEY ||
        window.supbase_anon_key ||
        "sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG";

    if (window.__dbClient && typeof window.__dbClient.from === 'function') return window.__dbClient;

    if (window.supabase && typeof window.supabase.createClient === 'function') {
        try{
            window.__dbClient = window.supabase.createClient(url, key);
            return window.__dbClient;
        }
        catch (e) {
            console.error('Error creating Supabase client:', e);
            throw new Error('Supabase client creation failed');
        }
    }
    throw new Error('Supabase client not initialized');
}


let studentsCache = [];
let facultyCache = [];
let feesCache = [];
let notesCache = [];
let attendanceCache = [];
let selectedFeeStudent = null;
let adminTimetableCache = [];
let adminMarksCache = [];
let feeStudentCache = [];
const NOTE_BUCKET = 'notes-files';
const DEBUG_ADMIN = true;

function adminLog(...args){
    if(!DEBUG_ADMIN) return;
    console.log('[ADMIN DEBUG]', ...args);
}

function parseArrayLike(value){
    if(Array.isArray(value)) return value.map(v => (v || '').toString().trim()).filter(Boolean);
    if(value === null || value === undefined) return [];
    const raw = (value || '').toString().trim();
    if(!raw) return [];
    if(raw.startsWith('{') && raw.endsWith('}')){
        return raw
            .slice(1, -1)
            .split(',')
            .map(v => v.replace(/^\"|\"$/g, '').trim())
            .filter(Boolean);
    }
    if(raw.includes(',')){
        return raw.split(',').map(v => v.trim()).filter(Boolean);
    }
    return [raw];
}

function isApprovedStatus(status){
    const token = ((status || '') + '').trim().toLowerCase();
    return token === 'approved' || token.startsWith('approved');
}

async function resolveStudentRowId(student) {
    if (student && student.row_id) return student.row_id;
    if (!student) return null;
    try {
        const firstName = (student.firstName || student.first_name || '').trim();
        const lastName = (student.lastName || student.last_name || '').trim();
        const guardianMobile = (student.guardianMobile || student.guardian_mobile || '').trim();
        const cls = (student.class || '').trim();
        if (!firstName || !lastName || !guardianMobile || !cls) return null;

        const { data, error } = await getDbClient()
            .from('students')
            .select('id')
            .eq('first_name', firstName)
            .eq('last_name', lastName)
            .eq('guardian_mobile', guardianMobile)
            .eq('class', cls)
            .order('created_at', { ascending: false })
            .limit(1);
        if (error) return null;
        const row = (data || [])[0];
        return row ? row.id : null;
    } catch (e) {
        return null;
    }
}

async function requireAdminSession() {
    const localAuth = JSON.parse(localStorage.getItem('adminAuth') || 'null');
    try {
        const { data: sessionData } = await getDbClient().auth.getSession();
        const user = sessionData && sessionData.session ? sessionData.session.user : null;
        if (!user) return !!(localAuth && localAuth.authenticated);

        const { data: profile } = await getDbClient()
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile && profile.role === 'admin') return true;
        return !!(localAuth && localAuth.authenticated);
    } catch (e) {
        return !!(localAuth && localAuth.authenticated);
    }
}

async function logoutAdmin() {
    if(confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminAuth');
        // Redirect immediately so logout never appears stuck in UI.
        window.location.href = 'index.html';
        try {
            await getDbClient().auth.signOut();
        } catch (e) {
            // Ignore signout errors; local logout + redirect already completed.
        }
    }
}

/* ================= TOGGLE LOGIC ================= */
function showStudents(){
    document.getElementById('studentBtn').classList.add('active');
    document.getElementById('facultyBtn').classList.remove('active');
    
    // Show Student & Fee Section
    document.getElementById('studentSection').style.display='block';
    document.getElementById('feeSection').style.display='block'; 
    
    // Hide Faculty Section
    document.getElementById('facultySection').style.display='none';
}

function showFaculty(){
    document.getElementById('facultyBtn').classList.add('active');
    document.getElementById('studentBtn').classList.remove('active');
    
    // Hide Student & Fee Section
    document.getElementById('studentSection').style.display='none';
    document.getElementById('feeSection').style.display='none'; 
    
    // Show Faculty Section
    document.getElementById('facultySection').style.display='block';
}

/* ================= STUDENT LOGIC ================= */
async function loadStudents(){
    adminLog('loadStudents() called');
    let tbody = document.querySelector('#studentTable tbody');
    setTableLoading(tbody, 'Loading students...', 9);
    const { data, error } = await getDbClient().from('students').select('*').order('created_at', { ascending: false });
    adminLog('students query result', { error: error ? error.message : null, rows: (data || []).length, raw: data });
    if(error) {
        alert('Failed to load students: ' + error.message);
        return;
    }
    const students = (data || []).map(s => ({
        ...s,
        row_id: s.id,
        local_index: -1,
        firstName: s.first_name || '',
        lastName: s.last_name || '',
        guardianMobile: s.guardian_mobile || '',
        guardian: s.guardian || '',
        id: s.student_code || '',
        password: s.password_legacy || ''
    }));
    adminLog('mapped students', students);
    studentsCache = students;
    adminLog('student tbody exists?', !!tbody);
    if(!tbody){
        console.error('[ADMIN DEBUG] #studentTable tbody not found in DOM');
        return;
    }
    tbody.innerHTML = '';

    students.forEach((s, index) => {
        let row = document.createElement('tr');
        let idDisplay = s.id ? `<strong style="color: #2a5298;">${s.id}</strong>` : '<span style="color:#999;">Pending</span>';
        let passDisplay = s.password ? `<strong style="color: #2a5298;">${s.password}</strong>` : '<span style="color:#999;">Pending</span>';
        
        row.innerHTML = `
            <td>${(s.firstName || '').trim()} ${(s.lastName || '').trim()}</td>
            <td>${s.class}</td>
            <td>${parseArrayLike(s.subjects).join(', ')}</td>
            <td>${s.guardian}</td>
            <td>${s.guardianMobile}</td>
            <td>${idDisplay}</td>
            <td>${passDisplay}</td>
            <td>${s.status}</td>
            <td>
                ${((s.status || '').toLowerCase() === 'pending') ? `
                <button onclick="approveStudent(${index})">Approve</button>
                <button class="reject" onclick="rejectStudent(${index})">Reject</button>` : `
                <button onclick="editStudentCredentials(${index})">Edit ID/Pass</button>`}
                <button class="delete" onclick="deleteStudent(${index})">Delete</button>
            </td>`;
        tbody.appendChild(row);
    });
    adminLog('render complete: rows in DOM', tbody.querySelectorAll('tr').length);
    if(document.getElementById('feeStudentSelect')) loadFeeStudentDropdown();
    if(document.getElementById('parentCredentialsList')) loadParentCredentialsTable();
}

async function approveStudent(index){
    const s = studentsCache[index];
    if(!s) return;
    let id = s.id || ('AR' + Math.floor(100000 + Math.random() * 900000));
    let pass = s.password || ('PASS' + Math.floor(1000 + Math.random() * 9000));
    const resolvedRowId = await resolveStudentRowId(s);
    const rowIdToUse = resolvedRowId || s.row_id;
    if(!rowIdToUse){
        alert('Failed to approve student: missing student row id');
        return;
    }
    const { error } = await getDbClient()
        .from('students')
        .update({ status: 'approved', student_code: id, password_legacy: pass })
        .eq('id', rowIdToUse);
    if(error){
        alert('Failed to approve student: ' + error.message);
        return;
    }
    alert('Student Approved!\nID: ' + id + '\nPassword: ' + pass);
    await loadStudents();
}

async function rejectStudent(index){
    const s = studentsCache[index];
    if(!s) return;
    const resolvedRowId = await resolveStudentRowId(s);
    const rowIdToUse = resolvedRowId || s.row_id;
    if(!rowIdToUse){
        alert('Failed to reject student: missing student row id');
        return;
    }
    const { error } = await getDbClient()
        .from('students')
        .update({ status: 'rejected' })
        .eq('id', rowIdToUse);
    if(error){
        alert('Failed to reject student: ' + error.message);
        return;
    }
    await loadStudents();
}

async function deleteStudent(index){
    if(!confirm("Are you sure?")) return;
    const s = studentsCache[index];
    if(!s) return;
    const resolvedRowId = await resolveStudentRowId(s);
    const rowIdToUse = resolvedRowId || s.row_id;
    if(!rowIdToUse){
        alert('Failed to delete student: missing student row id');
        return;
    }
    const { error } = await getDbClient().from('students').delete().eq('id', rowIdToUse);
    if(error){
        alert('Failed to delete student: ' + error.message);
        return;
    }
    await loadStudents();
}

/* ================= FACULTY LOGIC ================= */
async function loadFaculty(){
    let tbody = document.querySelector('#facultyTable tbody');
    setTableLoading(tbody, 'Loading faculty...', 7);
    const { data, error } = await getDbClient().from('faculty').select('*').order('created_at', { ascending: false });
    if(error) {
        alert('Failed to load faculty: ' + error.message);
        return;
    }
    const faculty = (data || []).map(f => ({
        ...f,
        row_id: f.id,
        id: f.faculty_code || '',
        password: f.password_legacy || ''
    }));
    facultyCache = faculty;
    tbody.innerHTML = '';

    faculty.forEach((f, index) => {
        let row = document.createElement('tr');
        let idDisplay = f.id ? `<strong style="color: #2a5298;">${f.id}</strong>` : '<span style="color:#999;">Pending</span>';
        let passDisplay = f.password ? `<strong style="color: #2a5298;">${f.password}</strong>` : '<span style="color:#999;">Pending</span>';

        row.innerHTML = `
            <td>${f.name}</td>
            <td>${f.qualification}</td>
            <td>${f.contact}</td>
            <td>${idDisplay}</td>
            <td>${passDisplay}</td>
            <td>${f.status}</td>
            <td>
                ${f.status === 'pending' ? `
                <button onclick="approveFaculty(${index})">Approve</button>
                <button class="reject" onclick="rejectFaculty(${index})">Reject</button>` : `
                <button onclick="editFacultyCredentials(${index})">Edit Credentials</button>`}
                <button class="delete" onclick="deleteFaculty(${index})">Delete</button>
            </td>`;
        tbody.appendChild(row);
    });
}

async function approveFaculty(index){
    const f = facultyCache[index];
    if(!f) return;

    let id = f.id || ('FAC' + Math.floor(100000 + Math.random() * 900000));
    let pass = f.password || ('FPASS' + Math.floor(1000 + Math.random() * 9000));

    const { error } = await getDbClient()
        .from('faculty')
        .update({ status: 'approved', faculty_code: id, password_legacy: pass })
        .eq('id', f.row_id);
    if(error){
        alert('Failed to approve faculty: ' + error.message);
        return;
    }

    alert('Faculty Approved!\n\nName: ' + f.name + '\nID: ' + id + '\nPassword: ' + pass);
    await loadFaculty();
}

async function rejectFaculty(index){
    const f = facultyCache[index];
    if(!f) return;
    const { error } = await getDbClient()
        .from('faculty')
        .update({ status: 'rejected' })
        .eq('id', f.row_id);
    if(error){
        alert('Failed to reject faculty: ' + error.message);
        return;
    }
    await loadFaculty();
}

async function deleteFaculty(index){
    if(!confirm("Are you sure?")) return;
    const f = facultyCache[index];
    if(!f) return;
    const { error } = await getDbClient().from('faculty').delete().eq('id', f.row_id);
    if(error){
        alert('Failed to delete faculty: ' + error.message);
        return;
    }
    await loadFaculty();
}
/* ================= EDIT CREDENTIALS LOGIC ================= */
let editingType = ''; // 'student' or 'faculty'
let editingIndex = -1;
let editingRowId = '';

function editStudentCredentials(index){
    let student = studentsCache[index];
    if(!student) return;

    editingType = 'student';
    editingIndex = index;
    editingRowId = student.row_id;

    document.getElementById('editModalTitle').textContent = 'Edit Student Credentials';
    document.getElementById('editName').textContent = (student.firstName || '') + ' ' + (student.lastName || '');
    document.getElementById('editId').value = student.id || '';
    document.getElementById('editPassword').value = student.password || '';
    document.getElementById('editCredentialsModal').style.display = 'flex';
}

function editFacultyCredentials(index){
    let fac = facultyCache[index];
    if(!fac) return;

    editingType = 'faculty';
    editingIndex = index;
    editingRowId = fac.row_id;

    document.getElementById('editModalTitle').textContent = 'Edit Faculty Credentials';
    document.getElementById('editName').textContent = fac.name;
    document.getElementById('editId').value = fac.id || '';
    document.getElementById('editPassword').value = fac.password || '';
    document.getElementById('editCredentialsModal').style.display = 'flex';
}

async function saveEditedCredentials(){
    let newId = document.getElementById('editId').value.trim();
    let newPass = document.getElementById('editPassword').value.trim();

    if(!newId || !newPass){
        alert('Please enter both ID and Password');
        return;
    }

    if(editingType === 'student'){
        const current = studentsCache[editingIndex];
        const resolvedRowId = await resolveStudentRowId(current);
        const rowIdToUse = resolvedRowId || editingRowId;
        if(!rowIdToUse){
            alert('Failed to update student credentials: missing student row id');
            return;
        }
        const { error } = await getDbClient()
            .from('students')
            .update({ student_code: newId, password_legacy: newPass })
            .eq('id', rowIdToUse);
        if(error){
            alert('Failed to update student credentials: ' + error.message);
            return;
        }
        alert('Student credentials updated successfully!');
        await loadStudents();
    } else if(editingType === 'faculty'){
        const { error } = await getDbClient()
            .from('faculty')
            .update({ faculty_code: newId, password_legacy: newPass })
            .eq('id', editingRowId);
        if(error){
            alert('Failed to update faculty credentials: ' + error.message);
            return;
        }
        alert('Faculty credentials updated successfully!');
        await loadFaculty();
    }

    closeEditModal();
}

function closeEditModal(){
    document.getElementById('editCredentialsModal').style.display = 'none';
    editingType = '';
    editingIndex = -1;
    editingRowId = '';
    document.getElementById('editId').value = '';
    document.getElementById('editPassword').value = '';
}

// Close modal when clicking outside
window.onclick = function(event) {
    let modal = document.getElementById('editCredentialsModal');
    if(event.target === modal) {
        modal.style.display = 'none';
    }
}
/* ================= FEE STRUCTURE LOGIC ================= */
let feeEditId = null;
function toggleFeeMode(){
    let cls = document.getElementById('feeClass').value;
    let monthlyDiv = document.getElementById('monthlyMode');
    let courseDiv = document.getElementById('courseMode');

    if(['4th','5th','6th','7th','8th'].includes(cls)){
        monthlyDiv.style.display = 'block';
        courseDiv.style.display = 'none';
    } else {
        monthlyDiv.style.display = 'none';
        courseDiv.style.display = 'block';
    }
}

async function saveFeeStructure(){
    const saveBtn = document.getElementById('saveFeeBtn');
    await withButtonLoading(saveBtn, 'Saving fee...', async () => {
    try {
        const db = getDbClient();
        let cls = document.getElementById('feeClass').value;
        let amount = document.getElementById('feeAmount').value;
        if(!cls || cls === '-- Choose a class --') { alert('Please select a class'); return; }
        if(!amount) { alert('Please enter an amount'); return; }

        let type = '';
        if(['4th','5th','6th','7th','8th'].includes(cls)){
            type = document.getElementById('feeCombination').value;
        } else {
            type = document.getElementById('courseSubject').value.trim();
            if(!type) { alert('Please enter a subject'); return; }
        }

        if(feeEditId){
            const { error } = await db
                .from('fee_structure')
                .update({ class: cls, type: type, amount: Number(amount) })
                .eq('id', feeEditId);
            if(error){
                alert('Failed to update fee: ' + error.message);
                return;
            }
            feeEditId = null;
            document.getElementById('saveFeeBtn').innerHTML = '<i class="fas fa-save"></i> Save Fee Structure';
            document.getElementById('cancelFeeBtn').style.display = 'none';
        } else {
            const { error: insertError } = await db
                .from('fee_structure')
                .insert({ class: cls, type: type, amount: Number(amount) });

            if(insertError){
                // Duplicate row: update existing class/type entry instead.
                if(insertError.code === '23505'){
                    const { error: updateDupError } = await db
                        .from('fee_structure')
                        .update({ amount: Number(amount) })
                        .eq('class', cls)
                        .eq('type', type);
                    if(updateDupError){
                        alert('Failed to update existing fee: ' + updateDupError.message);
                        return;
                    }
                } else {
                    alert('Failed to save fee: ' + insertError.message);
                    return;
                }
            }
        }

        // Verify saved row exists
        const { data: checkRows, error: checkError } = await db
            .from('fee_structure')
            .select('id')
            .eq('class', cls)
            .eq('type', type)
            .limit(1);
        if(checkError){
            alert('Saved but verification failed: ' + checkError.message);
        } else if(!checkRows || checkRows.length === 0){
            alert('Save did not persist. Please check table policies.');
        }

        await loadFees();
        document.getElementById('feeAmount').value = '';
        document.getElementById('courseSubject').value = '';
        document.getElementById('feeClass').value = '-- Choose a class --';
        toggleFeeMode();
    } catch (err) {
        alert('Unexpected fee save error: ' + (err && err.message ? err.message : err));
    }
    });
}

async function loadFees(){
    const db = getDbClient();
    let tbody = document.querySelector('#feeTable tbody');
    setTableLoading(tbody, 'Loading fee structure...', 4);
    const { data, error } = await db.from('fee_structure').select('*').order('class').order('type');
    if(error){
        alert('Failed to load fees: ' + error.message);
        return;
    }
    let fees = data || [];
    fees = fees.map(f => ({
        ...f,
        row_id: f.id || f.row_id || null
    }));
    feesCache = fees;

    tbody.innerHTML = '';

    fees.forEach((f, index) => {
        let row = document.createElement('tr');
        row.innerHTML = `
            <td>${f.class}</td>
            <td>${f.type}</td>
            <td>Rs. ${f.amount}</td>
            <td>
                <button class="update" onclick="editFee(${index})">Edit</button>
                <button class="delete" onclick="deleteFee(${index})">Delete</button>
            </td>`;
        tbody.appendChild(row);
    });
}

function editFee(index){
    let f = feesCache[index];
    if(!f) return;
    feeEditId = f.row_id || f.id || null;

    document.getElementById('feeClass').value = f.class || '-- Choose a class --';
    toggleFeeMode();

    if(['4th','5th','6th','7th','8th'].includes(f.class)){
        document.getElementById('feeCombination').value = f.type || 'Any1';
    } else {
        document.getElementById('courseSubject').value = f.type || '';
    }

    document.getElementById('feeAmount').value = f.amount || '';
    document.getElementById('saveFeeBtn').innerHTML = '<i class="fas fa-edit"></i> Update Fee';
    document.getElementById('cancelFeeBtn').style.display = 'block';
}

function cancelEditFee(){
    feeEditId = null;
    document.getElementById('feeAmount').value = '';
    document.getElementById('courseSubject').value = '';
    document.getElementById('feeClass').value = '-- Choose a class --';
    toggleFeeMode();
    document.getElementById('saveFeeBtn').innerHTML = '<i class="fas fa-save"></i> Save Fee Structure';
    document.getElementById('cancelFeeBtn').style.display = 'none';
}

async function deleteFee(index){
    let f = feesCache[index];
    if(!f) return;
    if(!confirm('Delete this fee entry?')) return;
    const db = getDbClient();
    let error = null;
    let deletedRows = [];
    const rowId = f.row_id || f.id || null;
    if(rowId){
        ({ data: deletedRows, error } = await db
            .from('fee_structure')
            .delete()
            .eq('id', rowId)
            .select('id,class,type'));
    } else {
        ({ data: deletedRows, error } = await db
            .from('fee_structure')
            .delete()
            .eq('class', f.class)
            .eq('type', f.type)
            .select('id,class,type'));
    }
    if(error){
        alert('Failed to delete fee: ' + error.message);
        return;
    }
    if(!deletedRows || deletedRows.length === 0){
        alert('Delete did not affect any row. Please refresh and try again.');
        return;
    }
    alert('Fee entry deleted');
    await loadFees();
}

/* ================= INITIALIZE DEFAULT FEES ================= */
async function initializeDefaultFees(){
    const db = getDbClient();
    const { data: existing, error: checkError } = await db.from('fee_structure').select('id').limit(1);
    if(checkError){
        alert('Fee initialization check failed: ' + checkError.message);
        return;
    }
    if(existing && existing.length > 0) return;

    let defaultFees = [
        {class: '4th', type: 'Any1', amount: 2000},
        {class: '4th', type: 'Any2', amount: 3500},
        {class: '4th', type: 'Any3', amount: 4800},
        {class: '4th', type: 'Any4', amount: 5800},
        {class: '4th', type: 'All', amount: 6500},
        {class: '5th', type: 'Any1', amount: 2200},
        {class: '5th', type: 'Any2', amount: 3800},
        {class: '5th', type: 'Any3', amount: 5200},
        {class: '5th', type: 'Any4', amount: 6300},
        {class: '5th', type: 'All', amount: 7000},
        {class: '6th', type: 'Any1', amount: 2500},
        {class: '6th', type: 'Any2', amount: 4200},
        {class: '6th', type: 'Any3', amount: 5800},
        {class: '6th', type: 'Any4', amount: 7000},
        {class: '6th', type: 'All', amount: 7800},
        {class: '7th', type: 'Any1', amount: 2800},
        {class: '7th', type: 'Any2', amount: 4600},
        {class: '7th', type: 'Any3', amount: 6500},
        {class: '7th', type: 'Any4', amount: 7800},
        {class: '7th', type: 'All', amount: 8500},
        {class: '8th', type: 'Any1', amount: 3000},
        {class: '8th', type: 'Any2', amount: 5000},
        {class: '8th', type: 'Any3', amount: 7000},
        {class: '8th', type: 'Any4', amount: 8500},
        {class: '8th', type: 'All', amount: 9500},
        {class: '9th', type: 'Maths', amount: 25000},
        {class: '9th', type: 'Science', amount: 28000},
        {class: '9th', type: 'English', amount: 20000},
        {class: '10th', type: 'Maths', amount: 28000},
        {class: '10th', type: 'Science', amount: 30000},
        {class: '10th', type: 'English', amount: 22000},
        {class: '11th', type: 'Accounts', amount: 35000},
        {class: '11th', type: 'Business Studies', amount: 32000},
        {class: '11th', type: 'Economics', amount: 30000},
        {class: '11th', type: 'Maths', amount: 30000},
        {class: '11th', type: 'Physics', amount: 32000},
        {class: '11th', type: 'Chemistry', amount: 32000},
        {class: '12th', type: 'Accounts', amount: 38000},
        {class: '12th', type: 'Business Studies', amount: 35000},
        {class: '12th', type: 'Economics', amount: 33000},
        {class: '12th', type: 'Maths', amount: 33000},
        {class: '12th', type: 'Physics', amount: 35000},
        {class: '12th', type: 'Chemistry', amount: 35000}
    ];

    const { error: seedError } = await db.from('fee_structure').insert(defaultFees);
    if(seedError){
        alert('Failed to initialize default fees: ' + seedError.message);
    }
}

async function insertTestFees(){
    const db = getDbClient();
    const { error: clearError } = await db.from('fee_structure').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if(clearError){
        alert('Failed to clear fees: ' + clearError.message);
        return;
    }
    await initializeDefaultFees();
    await loadFees();
    alert('Default test fees inserted successfully.');
}
/* ================= NOTES MONTORING LOGIC ================= */
async function loadAdminNotes(){

let facultyFilter = document.getElementById('filterFaculty').value;
let classFilter = document.getElementById('filterClass').value;
let table = document.getElementById('adminNotesList');
if(!table) return;
setTableLoading(table, 'Loading uploaded notes...', 7);

const { data, error } = await getDbClient().from('notes').select('*').order('created_at', { ascending: false });
if(error){
    alert('Failed to load notes: ' + error.message);
    return;
}
let notes = data || [];
table.innerHTML = '';

let faculties = [...new Set(notes.map(n => n.faculty_name || n.faculty).filter(Boolean))];
let facultyDropdown = document.getElementById('filterFaculty');
facultyDropdown.innerHTML = `<option value="">All Faculty</option>`;
faculties.forEach(f => {
    facultyDropdown.innerHTML += `<option value="${f}">${f}</option>`;
});

if(facultyFilter){
    notes = notes.filter(n => (n.faculty_name || n.faculty) === facultyFilter);
}

if(classFilter){
    notes = notes.filter(n => parseInt(n.class, 10) === parseInt(classFilter, 10));
}

notesCache = notes;

if(notes.length === 0){
    table.innerHTML = `
<tr>
<td colspan="7" style="text-align:center;">No uploads found</td>
</tr>`;
    return;
}

notes.forEach((note, index) => {
    const previewUrl = note.file_url || note.fileData || '';
    const showDate = note.created_at ? new Date(note.created_at).toLocaleDateString() : (note.date || '-');
    const facultyName = note.faculty_name || note.faculty || '-';

    table.innerHTML += `
<tr>
<td>${facultyName}</td>
<td>${note.title || '-'}</td>
<td>${note.subject || '-'}</td>
<td>${note.class || '-'}</td>
<td>${showDate}</td>
<td><button onclick="previewFileByIndex(${index})">Preview</button></td>
<td><button onclick="adminDeleteNote(${index})">Delete</button></td>
</tr>`;
});

}

async function getAdminNoteUrl(note){
    if(note.file_url && /^https?:/i.test(note.file_url)) return note.file_url;
    if(!note.storage_path) return note.file_url || '#';
    const { data, error } = await getDbClient().storage.from(NOTE_BUCKET).createSignedUrl(note.storage_path, 3600);
    if(error || !data || !data.signedUrl) return '#';
    return data.signedUrl;
}

async function previewFileByIndex(index){
const note = notesCache[index];
if(!note) return;
const url = await getAdminNoteUrl(note);
window.open(url, '_blank');
}

async function adminDeleteNote(index){
const note = notesCache[index];
if(!note) return;

if(confirm('Are you sure you want to delete this file?')){
    if(note.storage_path){
        await getDbClient().storage.from(NOTE_BUCKET).remove([note.storage_path]);
    }
    const { error } = await getDbClient().from('notes').delete().eq('id', note.id);
    if(error){
        alert('Failed to delete note: ' + error.message);
        return;
    }
    await loadAdminNotes();
}

}

function normalizeClassToken(value){
    const raw = (value || '').toString().trim().toLowerCase();
    if(!raw) return '';
    const m = raw.match(/\d{1,2}/);
    return m ? m[0] : raw;
}

async function loadAttendanceAdmin(){
    const classFilter = document.getElementById('attendanceClassFilter').value;
    const dateFilter = document.getElementById('attendanceDateFilter').value;
    const tbody = document.getElementById('attendanceAdminList');
    setTableLoading(tbody, 'Loading attendance...', 6);

    const { data, error } = await getDbClient().from('attendance').select('*').order('date', { ascending: false });
    if(error){
        tbody.innerHTML = '<tr><td colspan=\"6\">Failed to load attendance</td></tr>';
        return;
    }
    const { data: students } = await getDbClient().from('students').select('id,first_name,last_name');
    const studentMap = {};
    (students || []).forEach(s => { studentMap[s.id] = ((s.first_name || '') + ' ' + (s.last_name || '')).trim(); });

    attendanceCache = (data || []).filter(a => {
        if(classFilter && normalizeClassToken(a.class) !== normalizeClassToken(classFilter)) return false;
        if(dateFilter && a.date !== dateFilter) return false;
        return true;
    });

    attendanceCache.forEach(a => {
        tbody.innerHTML += `<tr>
            <td>${a.date || '-'}</td>
            <td>${a.class || '-'}</td>
            <td>${studentMap[a.student_id] || '-'}</td>
            <td>${a.subject || '-'}</td>
            <td>${a.status || '-'}</td>
            <td>${a.faculty_id || '-'}</td>
        </tr>`;
    });
    if(tbody.innerHTML === ''){
        tbody.innerHTML = '<tr><td colspan=\"6\">No attendance records found</td></tr>';
    }
}

function loadFeeStudentDropdown(){
    const select = document.getElementById('feeStudentSelect');
    adminLog('loadFeeStudentDropdown() called', { selectFound: !!select, cacheCount: studentsCache.length });
    if(!select){
        console.error('[ADMIN DEBUG] #feeStudentSelect not found');
        return;
    }
    select.innerHTML = '<option value=\"\">Select Student</option>';
    feeStudentCache = studentsCache.filter(s => isApprovedStatus(s.status));
    adminLog('approved students for fee dropdown', feeStudentCache);
    feeStudentCache.forEach((s, idx) => {
            const name = ((s.firstName || '') + ' ' + (s.lastName || '')).trim();
            select.innerHTML += '<option value=\"' + idx + '\">' + name + ' (' + (s.id || 'No ID') + ')</option>';
    });
    adminLog('fee dropdown option count', select.options.length);
}

function prefillStudentFee(){
    const idx = document.getElementById('feeStudentSelect').value;
    if(idx === '') return;
    selectedFeeStudent = feeStudentCache[Number(idx)];
    if(!selectedFeeStudent) return;
    document.getElementById('feeTotalInput').value = selectedFeeStudent.total_fee || selectedFeeStudent.course_fee || selectedFeeStudent.monthly_fee || 0;
    document.getElementById('feePaidInput').value = selectedFeeStudent.paid_fee || 0;
    document.getElementById('feeDiscountInput').value = selectedFeeStudent.discount || 0;
    document.getElementById('feeFineInput').value = selectedFeeStudent.fine || 0;
    loadStudentPaymentsAdmin();
}

async function saveStudentFeeProfile(){
    const saveBtn = document.getElementById('saveFeeProfileBtn');
    await withButtonLoading(saveBtn, 'Saving profile...', async () => {
    if(!selectedFeeStudent){
        alert('Select a student first');
        return;
    }
    const total = Number(document.getElementById('feeTotalInput').value || 0);
    const paid = Number(document.getElementById('feePaidInput').value || 0);
    const discount = Number(document.getElementById('feeDiscountInput').value || 0);
    const fine = Number(document.getElementById('feeFineInput').value || 0);
    const { error } = await getDbClient()
        .from('students')
        .update({ total_fee: total, paid_fee: paid, discount: discount, fine: fine })
        .eq('id', selectedFeeStudent.row_id);
    if(error){
        alert('Failed to save fee profile: ' + error.message);
        return;
    }
    alert('Fee profile saved');
    await loadStudents();
    loadFeeStudentDropdown();
    });
}

async function loadStudentPaymentsAdmin(){
    const tbody = document.getElementById('adminPaymentList');
    setTableLoading(tbody, 'Loading payments...', 5);
    if(!selectedFeeStudent) return;
    const { data, error } = await getDbClient()
        .from('fee_payments')
        .select('*')
        .eq('student_id', selectedFeeStudent.row_id)
        .order('payment_date', { ascending: false });
    if(error){
        tbody.innerHTML = '<tr><td colspan=\"5\">Failed to load payments</td></tr>';
        return;
    }
    (data || []).forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.payment_date || '-'}</td>
            <td>Rs. ${p.amount_paid || 0}</td>
            <td>${p.receipt_no || '-'}</td>
            <td>${p.mode || 'cash'}</td>
            <td>${p.note || '-'}</td>
        </tr>`;
    });
    if(tbody.innerHTML === ''){
        tbody.innerHTML = '<tr><td colspan=\"5\">No payment entries</td></tr>';
    }
}

async function recordFeePayment(){
    const saveBtn = document.getElementById('recordPaymentBtn');
    await withButtonLoading(saveBtn, 'Recording payment...', async () => {
    if(!selectedFeeStudent){ alert('Select a student first'); return; }
    const amount = Number(document.getElementById('paymentAmountInput').value || 0);
    const paymentDate = document.getElementById('paymentDateInput').value;
    const receipt = document.getElementById('paymentReceiptInput').value.trim();
    const note = document.getElementById('paymentNoteInput').value.trim();
    if(amount <= 0 || !paymentDate){ alert('Enter amount and payment date'); return; }
    const { error } = await getDbClient().from('fee_payments').insert({
        student_id: selectedFeeStudent.row_id,
        class: selectedFeeStudent.class,
        amount_paid: amount,
        payment_date: paymentDate,
        receipt_no: receipt,
        mode: 'cash',
        note: note,
        entered_by: 'admin'
    });
    if(error){ alert('Failed to record payment: ' + error.message); return; }

    const newPaid = Number(document.getElementById('feePaidInput').value || 0) + amount;
    document.getElementById('feePaidInput').value = newPaid;
    await saveStudentFeeProfile();
    await loadStudentPaymentsAdmin();
    document.getElementById('paymentAmountInput').value = '';
    document.getElementById('paymentReceiptInput').value = '';
    document.getElementById('paymentNoteInput').value = '';
    });
}

async function saveAdminTimetable(){
    const saveBtn = document.getElementById('saveAdminTtBtn');
    await withButtonLoading(saveBtn, 'Saving timetable...', async () => {
    const cls = document.getElementById('adminTtClass').value;
    const day = document.getElementById('adminTtDay').value;
    const start = document.getElementById('adminTtStart').value;
    const end = document.getElementById('adminTtEnd').value;
    const subject = document.getElementById('adminTtSubject').value.trim();
    const facultyName = document.getElementById('adminTtFaculty').value.trim();
    const room = document.getElementById('adminTtRoom').value.trim();
    if(!cls || !day || !start || !end || !subject){ alert('Fill class/day/time/subject'); return; }

    const { error } = await getDbClient().from('timetables').insert({
        class: cls,
        day_of_week: day,
        start_time: start,
        end_time: end,
        subject: subject,
        faculty_name: facultyName || null,
        room: room || null
    });
    if(error){ alert('Failed to save timetable: ' + error.message); return; }
    alert('Timetable saved');
    document.getElementById('adminTtStart').value = '';
    document.getElementById('adminTtEnd').value = '';
    document.getElementById('adminTtSubject').value = '';
    document.getElementById('adminTtFaculty').value = '';
    document.getElementById('adminTtRoom').value = '';
    await loadAdminTimetable();
    });
}

async function loadAdminTimetable(){
    const tbody = document.getElementById('adminTimetableList');
    setTableLoading(tbody, 'Loading timetable...', 7);
    const { data, error } = await getDbClient().from('timetables').select('*').order('class').order('day_of_week').order('start_time');
    if(error){
        tbody.innerHTML = '<tr><td colspan=\"7\">Failed to load timetable</td></tr>';
        return;
    }
    adminTimetableCache = data || [];
    adminTimetableCache.forEach((t, idx) => {
        tbody.innerHTML += `<tr>
            <td>${t.class || '-'}</td>
            <td>${t.day_of_week || '-'}</td>
            <td>${t.start_time || '-'} - ${t.end_time || '-'}</td>
            <td>${t.subject || '-'}</td>
            <td>${t.faculty_name || '-'}</td>
            <td>${t.room || '-'}</td>
            <td><button class=\"delete\" onclick=\"deleteAdminTimetable(${idx})\">Delete</button></td>
        </tr>`;
    });
    if(tbody.innerHTML === ''){
        tbody.innerHTML = '<tr><td colspan=\"7\">No timetable entries</td></tr>';
    }
}

async function deleteAdminTimetable(index){
    const row = adminTimetableCache[index];
    if(!row) return;
    const { error } = await getDbClient().from('timetables').delete().eq('id', row.id);
    if(error){ alert('Failed to delete timetable: ' + error.message); return; }
    await loadAdminTimetable();
}

async function loadAdminMarks(){
    const tbody = document.getElementById('adminMarksList');
    setTableLoading(tbody, 'Loading marks...', 6);
    const { data, error } = await getDbClient().from('exam_marks').select('*').order('exam_date', { ascending: false });
    if(error){
        tbody.innerHTML = '<tr><td colspan=\"6\">Failed to load marks</td></tr>';
        return;
    }
    adminMarksCache = data || [];
    adminMarksCache.forEach(m => {
        tbody.innerHTML += `<tr>
            <td>${m.student_name || '-'}</td>
            <td>${m.class || '-'}</td>
            <td>${m.exam_name || '-'}</td>
            <td>${m.subject || '-'}</td>
            <td>${m.marks_obtained || 0}/${m.max_marks || 0}</td>
            <td>${m.exam_date || '-'}</td>
        </tr>`;
    });
    if(tbody.innerHTML === ''){
        tbody.innerHTML = '<tr><td colspan=\"6\">No marks records</td></tr>';
    }
}

function loadParentCredentialsTable(){
    const tbody = document.getElementById('parentCredentialsList');
    tbody.innerHTML = '';
    studentsCache
        .filter(s => isApprovedStatus(s.status))
        .forEach((s, index) => {
            const name = ((s.firstName || '') + ' ' + (s.lastName || '')).trim();
            const parentId = s.parent_code || '';
            const parentPass = s.parent_password_legacy || '';
            tbody.innerHTML += `<tr>
                <td>${name}</td>
                <td>${s.class || '-'}</td>
                <td><input id=\"parentId_${index}\" value=\"${parentId}\" placeholder=\"PAR...\" /></td>
                <td><input id=\"parentPass_${index}\" value=\"${parentPass}\" placeholder=\"Password\" /></td>
                <td><button onclick=\"saveParentCredentials(${index})\">Save</button>
                <button class=\"update\" onclick=\"autoGenerateParentCredentials(${index})\">Auto Generate</button></td>
            </tr>`;
        });
    if(tbody.innerHTML === ''){
        tbody.innerHTML = '<tr><td colspan=\"5\">No approved students</td></tr>';
    }
}

function autoGenerateParentCredentials(index){
    const s = studentsCache.filter(st => isApprovedStatus(st.status))[index];
    if(!s) return;
    const idEl = document.getElementById('parentId_' + index);
    const passEl = document.getElementById('parentPass_' + index);
    if(idEl) idEl.value = s.parent_code || ('PAR' + Math.floor(100000 + Math.random() * 900000));
    if(passEl) passEl.value = s.parent_password_legacy || ('PPASS' + Math.floor(1000 + Math.random() * 9000));
}

async function saveParentCredentials(index){
    const approvedStudents = studentsCache.filter(st => isApprovedStatus(st.status));
    const s = approvedStudents[index];
    if(!s) return;
    const parentId = (document.getElementById('parentId_' + index).value || '').trim();
    const parentPass = (document.getElementById('parentPass_' + index).value || '').trim();
    if(!parentId || !parentPass){ alert('Enter parent ID and password'); return; }
    const { error } = await getDbClient()
        .from('students')
        .update({ parent_code: parentId, parent_password_legacy: parentPass })
        .eq('id', s.row_id);
    if(error){ alert('Failed to save parent credentials: ' + error.message); return; }
    alert('Parent credentials saved');
    await loadStudents();
    loadParentCredentialsTable();
}

window.addEventListener('load', async function(){
    adminLog('window load start');
    if('serviceWorker' in navigator){
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    const isAdmin = await requireAdminSession();
    adminLog('requireAdminSession()', isAdmin);
    if(!isAdmin){
        localStorage.removeItem('adminAuth');
        window.location.href = 'index.html';
        return;
    }

    localStorage.setItem('adminAuth', JSON.stringify({ authenticated: true }));
    await initializeDefaultFees();
    await loadStudents();
    await loadFaculty();
    await loadFees();
    loadFeeStudentDropdown();
    loadParentCredentialsTable();
    await loadAttendanceAdmin();
    await loadAdminTimetable();
    await loadAdminMarks();
    toggleFeeMode();
    await loadAdminNotes();
    showStudents();
    adminLog('window load complete');
});
