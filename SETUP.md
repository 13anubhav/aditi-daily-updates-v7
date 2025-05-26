# Aditi Daily Updates App Setup Guide

This guide will help you set up the Aditi Daily Updates application with OTP-based authentication and role-based access control (RBAC).

## Prerequisites

1. A Supabase account and project
2. Node.js and npm installed
3. Next.js application (this project)

## Supabase Setup

### 1. Authentication Setup

1. Navigate to your Supabase project dashboard
2. Go to Authentication > Providers
3. Make sure Email provider is enabled
4. Enable "Email OTP" in the Email provider settings
5. Set up custom email templates if desired

### 2. Database Setup

Run the SQL commands in the `sql/schema.sql` file in your Supabase SQL editor to create:
- Admin users table (`aditi_admins`)
- Teams table (`aditi_teams`) if not already created
- Team members table (`aditi_team_members`) if not already created
- Daily updates table (`aditi_daily_updates`) if not already created
- Row-level security policies
- Helper functions

### 3. Environment Variables

Create a `.env.local` file with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Make sure to add these to your hosting environment if deploying.

## User Roles Setup

The application supports three user roles:

1. **Regular User**
   - Can only see their own entries
   - Can submit new daily updates

2. **Manager**
   - Can see entries for all users in their teams
   - Can manage their team members

3. **Admin**
   - Can see entries for all users across all teams
   - Has full access to the system

### Adding an Admin

Use the Supabase SQL Editor to run:

```sql
SELECT add_admin('admin@example.com', 'Admin Name');
```

### Adding a Manager

Managers are defined by their email being in the `manager_email` field of the `aditi_teams` table:

```sql
INSERT INTO aditi_teams (team_name, manager_email) 
VALUES ('Team Name', 'manager@example.com');
```

### Adding a User to a Team

```sql
INSERT INTO aditi_team_members (team_id, employee_email, employee_id, team_member_name, team_name) 
VALUES (
  '550e8400-e29b-41d4-a716-446655440000', -- team UUID
  'user@example.com',
  'EMP123',
  'User Name',
  'Team Name'
);
```

## Running the Application

1. Install dependencies:
   ```
   npm install
   ```

2. Run in development mode:
   ```
   npm run dev
   ```

3. Build for production:
   ```
   npm run build
   npm start
   ```

## User Flow

1. Users navigate to the home page and enter their email for OTP login
2. After authentication:
   - Admins and managers are directed to the dashboard
   - Regular users are directed to the user dashboard
3. Users can submit daily updates with their tasks and any blockers
4. Managers can view updates from their teams
5. Admins can view updates from all teams

## Troubleshooting

### OTP Email Not Received

- Check spam folder
- Verify email provider settings in Supabase
- Ensure email templates are configured correctly

### Access Control Issues

- Verify the user has the correct role:
  - Check if the user's email is in the `aditi_admins` table for admin access
  - Check if the user's email is a `manager_email` in `aditi_teams` for manager access
  - Check if the user is in `aditi_team_members` for regular user access

### Database Errors

- Ensure all tables are created properly
- Verify RLS policies are configured correctly
- Check that indexes exist for performance

## Support

For additional help, please contact the development team or refer to the documentation of the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) 