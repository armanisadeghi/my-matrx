# Form Submissions Troubleshooting

## Error: "Database save failed but saving as text"

This error means the form couldn't connect to the API to save data. Here's how to fix it:

### Step 1: Check if Dev Server is Running

```bash
# Make sure your Next.js dev server is running
npm run dev
# or
pnpm dev
```

The form needs the Next.js API routes to be running at `http://localhost:3000`

### Step 2: Test the API Endpoint

Open in your browser:
```
http://localhost:3000/api/form-submissions/test
```

You should see something like:
```json
{
  "status": "ready",
  "diagnostics": {
    "envVarsPresent": {
      "SUPABASE_URL": true,
      "SUPABASE_SERVICE_ROLE": true
    },
    "databaseTest": "success"
  }
}
```

### Step 3: Check Environment Variables

If the test shows `"status": "missing env vars"`, you need to set up your environment variables.

**Check for environment file:**
```bash
ls -la | grep env
```

**You need these variables set:**
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE` (or `SUPABASE_SERVICE_ROLE_KEY`)

### Step 4: Set Environment Variables

Based on your `package.json`, it looks like you're using Doppler for secrets management:

```bash
# Pull environment variables from Doppler
npm run env:pull
```

Or create a `.env.local` file manually:
```bash
# .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key
```

**Where to find these values:**
1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings → API
4. Copy:
   - Project URL → `SUPABASE_URL`
   - Service Role Key → `SUPABASE_SERVICE_ROLE`

### Step 5: Restart Dev Server

After setting environment variables, restart:
```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

### Step 6: Check Browser Console

Open the RealSingles form and open browser DevTools (F12):

1. Go to the Console tab
2. Fill out the form
3. Click "Export Summary"
4. Look for error messages in the console

The error will now show detailed information about what went wrong.

### Step 7: Check Supabase Connection

In the Supabase SQL Editor, run:
```sql
-- Check if table exists
SELECT * FROM form_submissions LIMIT 1;
```

If you get "relation does not exist", the migration didn't run. Check the migrations were applied.

### Common Issues

#### Issue: "Failed to fetch" or "Network Error"

**Cause:** Next.js dev server not running or wrong port

**Fix:**
```bash
# Check if server is running on port 3000
lsof -i :3000

# If not running, start it
npm run dev
```

#### Issue: "Missing or invalid form_type"

**Cause:** JavaScript error in the form submission code

**Fix:** Check browser console for JavaScript errors. The form might have a syntax error.

#### Issue: "PGRST116" or "relation does not exist"

**Cause:** Database table not created

**Fix:** The migration might not have run. Check in Supabase SQL Editor if the table exists.

#### Issue: "Insufficient permissions" or RLS error

**Cause:** Row Level Security blocking the insert

**Fix:** The API should use service role key which bypasses RLS. Make sure `SUPABASE_SERVICE_ROLE` is set (not the anon key).

### Verify Everything Works

1. Test endpoint: `http://localhost:3000/api/form-submissions/test` should show `"status": "ready"`
2. Fill out the form
3. Click "Export Summary"
4. Check console - should see "✓ Saved to database!"
5. Visit `http://localhost:3000/form-submissions` to see your submission
6. Or check in Supabase SQL Editor:
   ```sql
   SELECT * FROM form_submissions 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

## Still Having Issues?

1. Check Next.js terminal logs for API errors
2. Check Supabase logs in Dashboard → Logs
3. Try the test endpoint and share the output
4. Check browser network tab for failed requests

## Quick Debug Commands

```bash
# Check if API route exists
ls -la pages/api/form-submissions.js

# Check if Supabase package is installed
npm list @supabase/supabase-js

# Test Supabase connection (in Node.js)
node -e "const { createClient } = require('@supabase/supabase-js'); console.log('Supabase client loaded successfully');"
```
