# Kerbside Mechanic

Node.js/Express mobile mechanic website with booking requests, SQLite and password-protected admin at `/admin`.

## Render
Use a **Web Service**, Node runtime, blank root directory, build command `npm install`, start command `npm start`.
Set `ADMIN_USERNAME` (default `admin`), `ADMIN_PASSWORD` (strong unique password), `SESSION_SECRET` (random 32+ character secret), `NODE_ENV=production`, and `DATA_DIR` (persistent disk directory when supported).

**Important:** SQLite data in ephemeral Render storage is lost on redeploy. Configure persistent storage or migrate to a managed database before accepting real customer requests. The free plan may not support persistent disks.

No passwords or database files belong in GitHub. Visit `/admin` after setting credentials.
