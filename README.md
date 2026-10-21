# EmployeeHub — Employee Management System

## Files
- `employee.html` — page structure
- `employee.css` — responsive styling
- `employee.js` — employee, department, search, filter, edit/delete and export logic
- `supabase-schema.sql` — optional database schema

## Run locally
1. Keep all files in the same folder.
2. Open `employee.html` in a modern browser. For best results, use VS Code with the Live Server extension.
3. The app runs immediately in **browser storage mode** and includes sample employee records on first launch. Changes are saved in that browser's localStorage.

Browser storage is local to that browser/device. It is not a shared database and may be cleared by the user.

## Optional: connect Supabase for shared database storage
1. Create a Supabase project.
2. In Supabase SQL Editor, run the contents of `supabase-schema.sql`.
3. In `employee.js`, fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your Supabase project's API settings.
4. Configure Row Level Security and authentication before using real employee data. The example schema enables RLS and intentionally does not add public access policies. Without appropriate policies/authentication, database requests will be denied.
5. Reload the page. The sidebar should show “Connected to Supabase” when tables and credentials work.

**Security note:** Never put a Supabase `service_role` key in browser JavaScript. For real employee data, add authentication, restrictive RLS policies, and server-side validation. This starter app does not implement user login or access roles.

## Included features
- Responsive dashboard and navigation
- Add, edit, and delete employee records
- Unique email check in the UI
- Department management and employee counts
- Search by employee name, email, or ID
- Filter by department and employment status
- Employee ID display, joining date, and employment status
- Dashboard counts and recent employees
- CSV export
- localStorage by default, optional Supabase database integration

## Notes
- Sample records are only demo data.
- The department list starts with IT, HR, Finance, Marketing, and Operations.
- For production deployment, use HTTPS, authentication, role-based access, server-side validation, and a tested backup strategy.
