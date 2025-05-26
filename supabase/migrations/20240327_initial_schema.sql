-- Create teams table
CREATE TABLE IF NOT EXISTS aditi_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT UNIQUE NOT NULL,
    manager_email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create team members table
CREATE TABLE IF NOT EXISTS aditi_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES aditi_teams(id) ON DELETE CASCADE,
    employee_email TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    team_member_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(team_id, employee_email)
);

-- Create daily updates table
CREATE TABLE IF NOT EXISTS aditi_daily_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_name TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_email TEXT NOT NULL,
    team_id UUID REFERENCES aditi_teams(id) ON DELETE SET NULL,
    tasks_completed TEXT,
    blocker_type TEXT CHECK (blocker_type IN ('Blockers', 'Risks', 'Dependencies')),
    expected_resolution_date DATE,
    blocker_description TEXT,
    status TEXT DEFAULT 'in-progress',
    additional_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_team_members_employee_email ON aditi_team_members(employee_email);
CREATE INDEX IF NOT EXISTS idx_daily_updates_employee_email ON aditi_daily_updates(employee_email);
CREATE INDEX IF NOT EXISTS idx_daily_updates_employee_id ON aditi_daily_updates(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_updates_team_id ON aditi_daily_updates(team_id);
CREATE INDEX IF NOT EXISTS idx_daily_updates_created_at ON aditi_daily_updates(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE aditi_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE aditi_team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE aditi_daily_updates DISABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Teams are viewable by everyone" ON aditi_teams
    FOR SELECT USING (true);

CREATE POLICY "Teams can be created by authenticated users" ON aditi_teams
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Team members policies
CREATE POLICY "Team members are viewable by everyone" ON aditi_team_members
    FOR SELECT USING (true);

CREATE POLICY "Team members can be added by authenticated users" ON aditi_team_members
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Daily updates policies
CREATE POLICY "Daily updates are viewable by team members" ON aditi_daily_updates
    FOR SELECT USING (
        auth.email() IN (
            SELECT employee_email 
            FROM aditi_team_members 
            WHERE team_id = aditi_daily_updates.team_id
        )
    );

CREATE POLICY "Daily updates can be created by team members" ON aditi_daily_updates
    FOR INSERT WITH CHECK (
        auth.email() IN (
            SELECT employee_email 
            FROM aditi_team_members 
            WHERE team_id = aditi_daily_updates.team_id
        )
    ); 