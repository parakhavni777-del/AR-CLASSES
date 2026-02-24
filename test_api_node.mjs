import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL = 'https://kgijlxshajimjbqcrygg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG';
const NOTE_BUCKET = 'notes-files';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function parseArrayLike(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  const raw = String(value).trim();
  if (!raw) return [];
  if (raw.startsWith('{') && raw.endsWith('}')) {
    return raw
      .slice(1, -1)
      .split(',')
      .map((v) => v.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }
  if (raw.includes(',')) return raw.split(',').map((v) => v.trim()).filter(Boolean);
  return [raw];
}

async function checkTable(name, queryFn) {
  const { data, error } = await queryFn();
  if (error) {
    console.error(`[${name}] ERROR`, { message: error.message, code: error.code, details: error.details });
    return [];
  }
  console.log(`[${name}] rows=${(data || []).length}`);
  return data || [];
}

async function run() {
  console.log('=== Node API Diagnostics Start ===');

  const students = await checkTable('students', () => sb.from('students').select('*').limit(200));
  await checkTable('faculty', () => sb.from('faculty').select('*').limit(50));
  await checkTable('attendance', () => sb.from('attendance').select('*').limit(50));
  await checkTable('notes', () => sb.from('notes').select('*').limit(50));
  await checkTable('fee_structure', () => sb.from('fee_structure').select('*').limit(100));
  await checkTable('fee_payments', () => sb.from('fee_payments').select('*').limit(50));
  await checkTable('timetables', () => sb.from('timetables').select('*').limit(50));
  await checkTable('exam_marks', () => sb.from('exam_marks').select('*').limit(50));

  const approved = students.filter((s) => String(s.status || '').toLowerCase().startsWith('approved'));
  console.log(`[students] approved_count=${approved.length}`);
  console.log(
    '[students] approved_sample=',
    approved.slice(0, 10).map((s) => ({
      id: s.id,
      student_code: s.student_code,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      status: s.status,
      subjects_type: Array.isArray(s.subjects) ? 'array' : typeof s.subjects,
      subjects_preview: parseArrayLike(s.subjects).slice(0, 4),
    }))
  );

  const { data: files, error: storageError } = await sb.storage.from(NOTE_BUCKET).list('', { limit: 50 });
  if (storageError) {
    console.error('[storage:notes-files] ERROR', {
      message: storageError.message,
      statusCode: storageError.statusCode,
    });
  } else {
    console.log(`[storage:notes-files] entries=${(files || []).length}`);
  }

  const localPdfPath = path.resolve('test.pdf');
  let uploadedPath = '';
  try {
    const pdfBytes = await readFile(localPdfPath);
    uploadedPath = `diagnostics/${Date.now()}-test.pdf`;
    const { error: uploadError } = await sb.storage
      .from(NOTE_BUCKET)
      .upload(uploadedPath, pdfBytes, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      console.error('[storage:upload test.pdf] ERROR', {
        message: uploadError.message,
        statusCode: uploadError.statusCode,
      });
    } else {
      console.log(`[storage:upload test.pdf] OK path=${uploadedPath}`);
      const { data: signedData, error: signedError } = await sb.storage.from(NOTE_BUCKET).createSignedUrl(uploadedPath, 300);
      if (signedError) {
        console.error('[storage:createSignedUrl] ERROR', { message: signedError.message });
      } else {
        console.log('[storage:createSignedUrl] OK', signedData?.signedUrl ? 'signed_url_generated=true' : 'signed_url_generated=false');
      }
    }
  } catch (err) {
    console.error('[storage:upload test.pdf] CRASH', { message: err?.message || String(err), path: localPdfPath });
  } finally {
    if (uploadedPath) {
      const { error: deleteError } = await sb.storage.from(NOTE_BUCKET).remove([uploadedPath]);
      if (deleteError) {
        console.error('[storage:cleanup] ERROR', { message: deleteError.message, path: uploadedPath });
      } else {
        console.log(`[storage:cleanup] OK removed=${uploadedPath}`);
      }
    }
  }

  console.log('=== Node API Diagnostics End ===');
}

run().catch((err) => {
  console.error('Diagnostics crashed:', err);
  process.exitCode = 1;
});
