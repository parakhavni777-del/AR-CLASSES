import { createClient } from '@supabase/supabase-js';
import { lookup } from 'node:dns/promises';
import https from 'node:https';

const SUPABASE_URL = 'https://kgijlxshajimjbqcrygg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1ujAiqxV8MEd0E3SWEIrlQ_EQjM8edG';

console.log('=== Network Diagnostics ===\n');

// Test DNS resolution
async function testDNS() {
    try {
        console.log('Testing DNS resolution for supabase...');
        const results = await lookup('kgijlxshajimjbqcrygg.supabase.co', { all: true });
        console.log('✓ DNS Resolution Success:');
        results.forEach(r => console.log(`  - ${r.address} (${r.family})`));
        return true;
    } catch (err) {
        console.error('✗ DNS Resolution Failed:', err.message);
        return false;
    }
}

// Test HTTPS connectivity
function testHTTPS() {
    return new Promise((resolve) => {
        console.log('\nTesting HTTPS connection to Supabase...');
        const req = https.get('https://kgijlxshajimjbqcrygg.supabase.co/rest/v1/', {
            timeout: 5000,
            headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        }, (res) => {
            console.log(`✓ HTTPS Connection Success (Status: ${res.statusCode})`);
            resolve(true);
        });

        req.on('error', (err) => {
            console.error('✗ HTTPS Connection Failed:', err.message);
            resolve(false);
        });

        req.on('timeout', () => {
            console.error('✗ HTTPS Connection Timeout (5s)');
            req.destroy();
            resolve(false);
        });
    });
}

// Test Supabase client
async function testSupabaseClient() {
    try {
        console.log('\nTesting Supabase client connection...');
        const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data, error } = await sb.from('students').select('*').limit(1);
        
        if (error) {
            console.error('✗ Supabase Query Failed:', error.message);
            return false;
        }
        console.log('✓ Supabase Client Connected Successfully');
        return true;
    } catch (err) {
        console.error('✗ Supabase Client Error:', err.message);
        return false;
    }
}

// Test with longer timeout
async function testSupabaseClientExtended() {
    try {
        console.log('\nTesting Supabase with 15s timeout...');
        const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                fetch: (url, options) => {
                    return fetch(url, {
                        ...options,
                        timeout: 15000
                    });
                }
            }
        });
        const { data, error } = await sb.from('students').select('*').limit(1);
        
        if (error) {
            console.error('✗ Extended Timeout Query Failed:', error.message);
            return false;
        }
        console.log('✓ Extended Timeout Successful');
        return true;
    } catch (err) {
        console.error('✗ Extended Timeout Error:', err.message);
        return false;
    }
}

// Run all tests
async function runDiagnostics() {
    const results = {
        dns: await testDNS(),
        https: await testHTTPS(),
        supabase: await testSupabaseClient(),
        extended: await testSupabaseClientExtended()
    };

    console.log('\n=== Diagnosis Summary ===');
    console.log(`DNS:              ${results.dns ? '✓ OK' : '✗ FAILED'}`);
    console.log(`HTTPS:            ${results.https ? '✓ OK' : '✗ FAILED'}`);
    console.log(`Supabase (10s):    ${results.supabase ? '✓ OK' : '✗ FAILED'}`);
    console.log(`Supabase (15s):    ${results.extended ? '✓ OK' : '✗ FAILED'}`);

    if (results.dns && !results.https) {
        console.log('\n💡 Suggestion: DNS works but HTTPS fails - check firewall/proxy settings');
    } else if (!results.dns) {
        console.log('\n💡 Suggestion: DNS fails - check internet connection or network settings');
    } else if (!results.supabase && results.extended) {
        console.log('\n💡 Suggestion: Increase timeout in your Supabase client configuration');
    } else if (results.supabase) {
        console.log('\n✓ All tests passed! Your network configuration is OK.');
    }
}

runDiagnostics().catch(console.error);
