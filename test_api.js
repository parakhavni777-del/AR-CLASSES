/*
How to run (browser):
1) Open index.html
2) Open DevTools Console
3) Run: loadApiDiagnostics()
4) Share full console output
*/

async function loadApiDiagnostics() {
  try {
    if (!window.supabase || !window.supabase.createClient) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const SUPABASE_URL = 'https://kgijlxshajimjbqcrygg.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG';
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('=== API Diagnostics Start ===');

    const checks = [
      { name: 'students', query: () => sb.from('students').select('*').limit(20) },
      { name: 'faculty', query: () => sb.from('faculty').select('*').limit(20) },
      { name: 'attendance', query: () => sb.from('attendance').select('*').limit(20) },
      { name: 'notes', query: () => sb.from('notes').select('*').limit(20) },
      { name: 'fee_structure', query: () => sb.from('fee_structure').select('*').limit(20) },
      { name: 'fee_payments', query: () => sb.from('fee_payments').select('*').limit(20) },
      { name: 'timetables', query: () => sb.from('timetables').select('*').limit(20) },
      { name: 'exam_marks', query: () => sb.from('exam_marks').select('*').limit(20) }
    ];

    for (const c of checks) {
      const { data, error } = await c.query();
      if (error) {
        console.error('[' + c.name + '] ERROR', error);
      } else {
        console.log('[' + c.name + '] rows=' + ((data || []).length));
        if (c.name === 'students') {
          const sample = (data || []).map(s => ({
            id: s.id,
            student_code: s.student_code,
            name: ((s.first_name || '') + ' ' + (s.last_name || '')).trim(),
            status: s.status,
            subjects_type: Array.isArray(s.subjects) ? 'array' : typeof s.subjects,
            subjects_value: s.subjects
          }));
          console.log('[students] sample', sample);
        }
      }
    }

    const { data: storageList, error: storageError } = await sb.storage.from('notes-files').list('', { limit: 20 });
    if (storageError) {
      console.error('[storage:notes-files] ERROR', storageError);
    } else {
      console.log('[storage:notes-files] entries=' + ((storageList || []).length), storageList);
    }

    console.log('=== API Diagnostics End ===');
    return 'done';
  } catch (err) {
    console.error('Diagnostics failed:', err);
    return 'failed';
  }
}

