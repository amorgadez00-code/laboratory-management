# Laboratory Management System

This project is a role-based asset transaction and approval management web app built for GitHub Pages and Supabase.

## Features
- Role-based navigation and access rules for Administrator, Staff, and Requester roles
- Borrowing request workflow with approval, release, return, and close actions
- Equipment availability and maintenance validation
- Audit logging for sensitive actions
- Responsive interface with enhanced styling

## Local development
1. Open the project in a browser using a local static server or GitHub Pages hosting.
2. Configure the Supabase URL and anon key in `js/supabase.js`.
3. Apply the database schema in `supabase/schema.sql`.

## Database setup
The included `supabase/schema.sql` file creates the required tables and Row Level Security policies for:
- `profiles`
- `equipment`
- `borrowing_requests`
- `maintenance_requests`
- `audit_logs`

## Notes
This app relies on Supabase for authentication and database enforcement. The role checks are implemented in the interface and in the database policies to satisfy the laboratory requirement.
