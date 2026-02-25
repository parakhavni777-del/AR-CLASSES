const SUPABASE_URL = "https://kgijlxshajimjbqcrygg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG";
let supabaseClient = null;
function showInlineError(errorDiv, message) {
    if (!errorDiv) return;
    errorDiv.textContent = message || '';
    errorDiv.style.display = message ? 'block' : 'none';
    if (message && window.notifyError) window.notifyError(message);
}

async function ensureSupabaseClient() {
    if (supabaseClient) return supabaseClient;

    if (!window.supabase || !window.supabase.createClient) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/@supabase/supabase-js@2';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    if (!window.supabase || !window.supabase.createClient) {
        throw new Error('Supabase library failed to load. Check internet connection.');
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
}

async function getSupabaseProfile() {
    const sb = await ensureSupabaseClient();
    const { data: sessionData } = await sb.auth.getSession();
    const user = sessionData && sessionData.session ? sessionData.session.user : null;
    if (!user) return null;

    const { data: profile, error } = await sb
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .single();

    if (error) return null;
    return { user, profile };
}

// ADMIN LOGIN
async function loginAdmin(e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    let user = document.getElementById('adminUser').value.trim();
    let pass = document.getElementById('adminPass').value;
    let errorDiv = document.getElementById('adminError');
    const submitBtn = document.querySelector('#adminForm button[type="submit"]');

    showInlineError(errorDiv, '');
    if(!user || !pass) {
        showInlineError(errorDiv, 'Invalid admin credentials');
        return;
    }

    await withButtonLoading(submitBtn, 'Logging in...', async () => {
        try {
            const sb = await ensureSupabaseClient();

            const { error: signInError } = await sb.auth.signInWithPassword({
                email: user,
                password: pass
            });

            if(signInError) {
                showInlineError(errorDiv, signInError.message || 'Admin login failed');
                return;
            }
        } catch (err) {
            showInlineError(errorDiv, (err && err.message) ? err.message : 'Unexpected login error');
            return;
        }

        localStorage.setItem('adminAuth', JSON.stringify({authenticated: true, user: user}));
        window.location.href = 'admin.html';
    });
}
// FACULTY LOGIN
async function loginFaculty(e) {
    if(e && e.preventDefault) e.preventDefault();
    let facId = document.getElementById('facultyId').value.trim();
    let facPass = document.getElementById('facultyPass').value;
    let errorDiv = document.getElementById('facultyError');
    const submitBtn = document.querySelector('#facultyForm button[type="submit"]');
    showInlineError(errorDiv, '');

    if(!facId || !facPass){
        showInlineError(errorDiv, 'Please enter Faculty ID and password');
        return;
    }

    await withButtonLoading(submitBtn, 'Logging in...', async () => {
        let data = null, error = null;
        try {
            const sb = await ensureSupabaseClient();
            ({ data, error } = await sb
                .from('faculty')
                .select('*')
                .eq('faculty_code', facId)
                .eq('password_legacy', facPass)
                .limit(1));
        } catch (err) {
            showInlineError(errorDiv, (err && err.message) ? err.message : 'Login failed');
            return;
        }

        if(error){
            showInlineError(errorDiv, error.message || 'Login failed');
            return;
        }

        const exact = (data || [])[0];
        if(!exact){
            showInlineError(errorDiv, 'Invalid Faculty ID or password');
            return;
        }

        if(exact.status !== 'approved'){
            showInlineError(errorDiv, 'Faculty pending admin approval or rejected');
            return;
        }

        const user = {
            ...exact,
            row_id: exact.id,
            id: exact.faculty_code || '',
            password: exact.password_legacy || ''
        };

        localStorage.setItem('currentFaculty', JSON.stringify(user));
        localStorage.setItem('facultyAuth', JSON.stringify({authenticated: true}));
        window.location.href = 'faculty.html';
    });
}
// STUDENT LOGIN
async function loginStudent(e) {
    if(e && e.preventDefault) e.preventDefault();
    let id = document.getElementById('studentId').value.trim();
    let pass = document.getElementById('studentPass').value;
    let errorDiv = document.getElementById('studentError');
    const submitBtn = document.querySelector('#studentForm button[type="submit"]');
    showInlineError(errorDiv, '');

    if(!id || !pass){
        showInlineError(errorDiv, 'Please enter ID and password');
        return;
    }

    await withButtonLoading(submitBtn, 'Logging in...', async () => {
        let data = null, error = null;
        try {
            const sb = await ensureSupabaseClient();
            ({ data, error } = await sb
                .from('students')
                .select('*')
                .eq('student_code', id)
                .eq('password_legacy', pass)
                .limit(1));
        } catch (err) {
            showInlineError(errorDiv, (err && err.message) ? err.message : 'Login failed');
            return;
        }

        if(error){
            showInlineError(errorDiv, error.message || 'Login failed');
            return;
        }

        const userRow = (data || [])[0];
        if(!userRow){
            showInlineError(errorDiv, 'Invalid ID or password');
            return;
        }

        if(userRow.status !== 'approved'){
            showInlineError(errorDiv, 'Not approved by admin yet');
            return;
        }

        const user = {
            ...userRow,
            row_id: userRow.id,
            id: userRow.student_code || '',
            password: userRow.password_legacy || '',
            firstName: userRow.first_name || '',
            lastName: userRow.last_name || '',
            guardianMobile: userRow.guardian_mobile || ''
        };

        localStorage.setItem('currentStudent', JSON.stringify(user));
        localStorage.setItem('studentAuth', JSON.stringify({authenticated: true}));
        window.location.href = 'student.html';
    });
}
// MODAL FUNCTIONS
function showFacultyRegister() {
    document.getElementById('facultyRegisterModal').style.display = 'flex';
}

function showStudentRegister() {
    document.getElementById('studentRegisterModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    let facultyModal = document.getElementById('facultyRegisterModal');
    let studentModal = document.getElementById('studentRegisterModal');
    if(event.target === facultyModal) {
        facultyModal.style.display = 'none';
    }
    if(event.target === studentModal) {
        studentModal.style.display = 'none';
    }
}

// FACULTY REGISTRATION FROM INDEX
async function registerFacultyFromIndex(e) {
    e.preventDefault();
    const submitBtn = e && e.target ? e.target.querySelector('button[type="submit"]') : null;
    let name = document.getElementById('regFacultyName').value.trim();
    let qualification = document.getElementById('regFacultyQualification').value.trim();
    let contact = document.getElementById('regFacultyContact').value.trim();
    let email = document.getElementById('regFacultyEmail').value.trim();

    if(!name || !qualification || !contact) {
        alert('Please fill all required fields');
        return;
    }

    if(contact.length !== 10) {
        alert('Contact must be 10 digits');
        return;
    }

    await withButtonLoading(submitBtn, 'Registering...', async () => {
        let sb;
        try {
            sb = await ensureSupabaseClient();
        } catch (err) {
            alert('Registration failed: ' + ((err && err.message) ? err.message : err));
            return;
        }
        const { data: existing, error: findError } = await sb
            .from('faculty')
            .select('id,name,contact')
            .eq('contact', contact);

        if(findError){
            alert('Registration failed: ' + findError.message);
            return;
        }

        const exists = (existing || []).find(f => (f.name || '').toLowerCase() === name.toLowerCase());
        if(exists) {
            alert('Faculty already registered with this name and contact');
            return;
        }

        const { error: insertErrorBase } = await sb.from('faculty').insert({
            name: name,
            qualification: qualification,
            contact: contact,
            email: email,
            subjects: [],
            classes: [],
            status: 'pending'
        });

        let insertError = insertErrorBase || null;
        if(insertError && /column|schema cache|subjects|classes|email/i.test(insertError.message || '')){
            const { error: fallbackInsertError } = await sb.from('faculty').insert({
                name: name,
                qualification: qualification,
                contact: contact,
                status: 'pending'
            });
            insertError = fallbackInsertError || null;
        }
        if(insertError){
            alert('Registration failed: ' + insertError.message);
            return;
        }

        closeModal('facultyRegisterModal');
        alert('Registration successful!\nWait for Admin approval.\n\nRedirecting to Faculty Panel...');
        setTimeout(() => {
            window.location.href = 'faculty.html';
        }, 500);
    });
}
// STUDENT REGISTRATION FROM INDEX
async function registerStudentFromIndex(e) {
    e.preventDefault();
    const submitBtn = e && e.target ? e.target.querySelector('button[type="submit"]') : null;
    let firstName = document.getElementById('regStudentFirstName').value.trim();
    let lastName = document.getElementById('regStudentLastName').value.trim();
    let school = document.getElementById('regStudentSchool').value.trim();
    let guardian = document.getElementById('regStudentGuardian').value.trim();
    let guardianMobile = document.getElementById('regStudentGuardianMobile').value.trim();
    let classVal = document.getElementById('regStudentClass').value;

    if(!firstName || !lastName || !school || !guardian || !guardianMobile || !classVal) {
        alert('Please fill all required fields');
        return;
    }

    if(guardianMobile.length !== 10) {
        alert('Guardian mobile must be 10 digits');
        return;
    }

    await withButtonLoading(submitBtn, 'Registering...', async () => {
        let sb;
        try {
            sb = await ensureSupabaseClient();
        } catch (err) {
            alert('Registration failed: ' + ((err && err.message) ? err.message : err));
            return;
        }
        const { error } = await sb.from('students').insert({
            first_name: firstName,
            last_name: lastName,
            school: school,
            guardian: guardian,
            guardian_mobile: guardianMobile,
            class: classVal,
            subjects: [],
            monthly_fee: 0,
            course_fee: 0,
            status: 'pending'
        });

        if(error){
            alert('Registration failed: ' + error.message);
            return;
        }

        closeModal('studentRegisterModal');
        alert('Registration Successful!\n\nYour application is pending admin approval.\nAdmin will assign your Student ID and Password.\n\nRedirecting to Student Panel...');
        setTimeout(() => {
            window.location.href = 'student.html';
        }, 500);
    });
}
function showAlert() {
    alert('Please register through your respective panel first!\\n\\n' +
          '👨‍🎓 Students: Register in the Student Panel\\n' +
          '👨‍🏫 Faculty: Register in the Faculty Panel');
}

// Check if already logged in
window.addEventListener('load', async function() {
    if('serviceWorker' in navigator){
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    if(localStorage.getItem('adminAuth')) {
        window.location.href = 'admin.html';
        return;
    }
    if(localStorage.getItem('facultyAuth') && localStorage.getItem('currentFaculty')) {
        window.location.href = 'faculty.html';
        return;
    }
    if(localStorage.getItem('studentAuth') && localStorage.getItem('currentStudent')) {
        window.location.href = 'student.html';
        return;
    }
    if(localStorage.getItem('parentAuth') && localStorage.getItem('currentParentStudent')) {
        window.location.href = 'parent.html';
    }
});
