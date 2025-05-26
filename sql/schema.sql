-- Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admin users table
CREATE TABLE IF NOT EXISTS aditi_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create RLS policies for admin table
ALTER TABLE aditi_admins ENABLE ROW LEVEL SECURITY;

-- Only allow admins to read the admin table
CREATE POLICY "Admin users can read all admins"
  ON aditi_admins
  FOR SELECT
  TO authenticated
  USING (
    email IN (SELECT email FROM aditi_admins)
  );

-- For admin changes, use API functions or supabase admin panel

-- Teams table (if not already existing)
CREATE TABLE IF NOT EXISTS aditi_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_name TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Team members table (if not already existing)
CREATE TABLE IF NOT EXISTS aditi_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES aditi_teams(id) ON DELETE CASCADE,
  employee_email TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  team_member_name TEXT NOT NULL,
  manager_name TEXT,
  team_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily updates table (if not already existing)
CREATE TABLE IF NOT EXISTS aditi_daily_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_email TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES aditi_teams(id) ON DELETE CASCADE,
  tasks_completed TEXT NOT NULL,
  status TEXT NOT NULL,
  blocker_type TEXT,
  blocker_description TEXT,
  expected_resolution_date DATE,
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_members_employee_email ON aditi_team_members(employee_email);
CREATE INDEX IF NOT EXISTS idx_teams_manager_email ON aditi_teams(manager_email);
CREATE INDEX IF NOT EXISTS idx_daily_updates_employee_email ON aditi_daily_updates(employee_email);
CREATE INDEX IF NOT EXISTS idx_daily_updates_team_id ON aditi_daily_updates(team_id);
CREATE INDEX IF NOT EXISTS idx_daily_updates_created_at ON aditi_daily_updates(created_at);

-- RLS Policies for teams
ALTER TABLE aditi_teams ENABLE ROW LEVEL SECURITY;

-- Anyone can read all teams
CREATE POLICY "Anyone can read all teams"
  ON aditi_teams
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins and the team's manager can update teams
CREATE POLICY "Admins and team managers can update teams"
  ON aditi_teams
  FOR UPDATE
  TO authenticated
  USING (
    (manager_email = auth.email()) OR
    (auth.email() IN (SELECT email FROM aditi_admins))
  );

-- RLS Policies for team members
ALTER TABLE aditi_team_members ENABLE ROW LEVEL SECURITY;

-- Anyone can read team members
CREATE POLICY "Anyone can read team members"
  ON aditi_team_members
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for daily updates
ALTER TABLE aditi_daily_updates ENABLE ROW LEVEL SECURITY;

-- Users can read their own updates, managers can read their team's updates, admins can read all
CREATE POLICY "Access control for daily updates"
  ON aditi_daily_updates
  FOR SELECT
  TO authenticated
  USING (
    employee_email = auth.email() OR
    team_id IN (
      SELECT id FROM aditi_teams WHERE manager_email = auth.email()
    ) OR
    auth.email() IN (SELECT email FROM aditi_admins)
  );

-- Users can insert their own updates
CREATE POLICY "Users can insert their own updates"
  ON aditi_daily_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_email = auth.email()
  );

-- Users can update only their own updates
CREATE POLICY "Users can update their own updates"
  ON aditi_daily_updates
  FOR UPDATE
  TO authenticated
  USING (
    employee_email = auth.email()
  );

-- Users can delete only their own updates
CREATE POLICY "Users can delete their own updates"
  ON aditi_daily_updates
  FOR DELETE
  TO authenticated
  USING (
    employee_email = auth.email()
  );

-- Function to add admin user
CREATE OR REPLACE FUNCTION add_admin(
  admin_email TEXT,
  admin_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO aditi_admins (email, name)
  VALUES (admin_email, admin_name)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove admin user
CREATE OR REPLACE FUNCTION remove_admin(
  admin_email TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  DELETE FROM aditi_admins
  WHERE email = admin_email
  RETURNING id INTO affected_rows;
  
  RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 