# API Connection Issue - Root Cause & Solutions

## Diagnosis Result ❌

```
✓ DNS:              WORKS (can find Supabase servers)
✗ HTTPS:            BLOCKED (firewall/ISP issue)
✗ Supabase Client:  CANNOT CONNECT (depends on HTTPS)
```

## Root Cause

Your **firewall or ISP is blocking HTTPS connections** to Supabase's servers at these IPs:

- `2405:200:1607:2820:41::36` (IPv6)
- `49.44.79.236` (IPv4)

This is why:

- ✓ DNS resolution works (name lookup is allowed)
- ✗ HTTPS connection fails (port 443 is blocked)
- ✗ Node script crashes with timeout

## Solutions

### Solution 1: Check Your Network Settings

#### Windows Firewall Check:

```powershell
# Open Windows Defender Firewall
# Settings → Privacy & Security → Windows Defender Firewall → Allow an app through firewall
# OR from terminal:
Get-NetFirewallProfile | Select-Object -Property Name, Enabled
```

#### Check if ISP is Blocking:

```bash
# Your gateway/router might be blocking this IP
# 1. Check your router's firewall settings (192.168.1.1 or 192.168.0.1)
# 2. Try connecting from mobile hotspot (different network)
#    - If works on mobile → ISP is likely blocking
#    - If fails on mobile → Your device firewall issue
```

### Solution 2: Use VPN

If firewall/ISP is blocking, use a VPN:

```bash
# Install any VPN provider (NordVPN, ExpressVPN, ProtonVPN, etc.)
# Connect to VPN
# Then run:
node test_api_node_improved.mjs
```

✓ This bypasses ISP/network-level blocks

### Solution 3: Use GitHub Actions for API Testing

If you can't test locally, use **GitHub Actions** (free CI/CD):

Create `.github/workflows/api-test.yml`:

```yaml
name: API Connection Test

on: [push, workflow_dispatch]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm install
      - run: node test_api_node_improved.mjs
```

Push to GitHub → GitHub runs test automatically → Check results in Actions tab

### Solution 4: Use Different Network

Try these alternatives:

1. **Mobile Hotspot**

   ```bash
   # Connect phone hotspot to PC
   # Run test from mobile network
   ```

2. **Public WiFi (Cafe/Library)**

   ```bash
   # Connect to public network
   # Run test
   ```

3. **Different ISP**
   - Visit friend's house with different ISP
   - Test there

## Why Browser Works on GitHub Pages

When you visit `https://parakhavni777-del.github.io/AR-CLASSES/`:

1. Browser connects to GitHub's servers (allowed)
2. GitHub serves your static HTML
3. Browser loads Supabase library from CDN/unpkg (different IP)
4. Supabase library might use alternative connection method

But Node.js directly connects to Supabase - no middle layer.

## Technical Details

Your block is at **TCP port 443 (HTTPS)** to specific Supabase IPs:

```
Blocked: 49.44.79.236:443 (HTTPS)
Blocked: 2405:200:1607:2820:41::36:443 (IPv6 HTTPS)
```

This prevents Node.js Supabase client from connecting, but:

- DNS lookups work ✓
- Browser might bypass via JS sandbox
- VPN changes your exit IP ✓

## Recommended Actions (Priority Order)

1. **Try VPN** (Easiest, takes 5 min)
   - Download ProtonVPN free or similar
   - Connect
   - Run test

2. **Check Router Settings** (Next)
   - Access router at 192.168.1.1
   - Look for firewall rules blocking these IPs
   - Whitelist Supabase IPs

3. **Contact ISP** (If persistent)
   - Tell them: Can't connect to kgijlxshajimjbqcrygg.supabase.co
   - Ask them to unblock port 443 to Supabase IPs
   - Provide these IPs: 2405:200:1607:2820:41::36, 49.44.79.236

4. **Use GitHub Actions** (Workaround)
   - No local testing needed
   - Tests run on GitHub servers
   - Checks pass if API works

## Verification Steps

### Step 1: Try VPN

```bash
# 1. Install VPN (ProtonVPN, NordVPN free trial)
# 2. Connect VPN
# 3. Run diagnostic again
node diagnose_network.mjs
# If all ✓ now → ISP/Firewall issue confirmed

# 4. Run test
node test_api_node_improved.mjs
```

### Step 2: If VPN Works

Your ISP/firewall is blocking. Options:

- Keep using VPN for development
- Contact ISP to unblock
- Use GitHub Actions for testing

### Step 3: If VPN Still Fails

It's your machine firewall. Check:

```powershell
# Windows Firewall
Get-NetFirewallProfile | Where-Object {$_.Enabled}
# Should show domains/private/public

# Check specific rules
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Node*" -or $_.DisplayName -like "*npm*"}
```

## Expected Results After Fix

**Local Testing (With VPN or Fixed Network):**

```bash
$ node diagnose_network.mjs
✓ DNS:              OK
✓ HTTPS:            OK
✓ Supabase (10s):   OK
✓ Supabase (15s):   OK
```

**GitHub Pages (Already Works):**

```
https://parakhavni777-del.github.io/AR-CLASSES/
✓ Loads
✓ CSS loads
✓ No CORS errors
✓ Can authenticate to Supabase
```

## Questions to Answer

1. **Can you use a VPN?** → Try VPN solution
2. **Are you on corporate network?** → Contact IT to whitelist Supabase IPs
3. **On residential ISP?** → Contact ISP support
4. **Want automated testing?** → Use GitHub Actions

Let me know which solution you want to pursue!
