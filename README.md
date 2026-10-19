# Kerbside Mechanic (Node.js)

## Run
Install Node.js 20+ and run:

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Open http://localhost:3000

## Features
- Responsive Welsh-branded landing page using your supplied logo
- Services and mobile mechanic marketing content
- Booking request and quote request forms stored in SQLite
- Basic rate limiting and server-side input validation
- Admin enquiry API: `GET /api/admin/enquiries` with `x-admin-key` header set to ADMIN_API_KEY from `.env`

## Before public launch
Replace placeholder contact and coverage details, set a strong ADMIN_API_KEY, configure HTTPS and backups, add privacy policy and retention policy, add anti-spam protection, and implement a proper authenticated admin UI. Form submissions are enquiries, not confirmed appointments. No email notifications are configured yet.
