-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Admins Table
CREATE TABLE aditi_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Teams Table
CREATE TABLE aditi_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_name VARCHAR(255) NOT NULL,
  manager_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Team Members Table
CREATE TABLE aditi_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL,
  employee_email VARCHAR(255) NOT NULL,
  employee_id VARCHAR(50) NOT NULL,
  team_member_name VARCHAR(255) NOT NULL,
  manager_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Daily Updates Table
CREATE TABLE aditi_daily_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_email VARCHAR(255) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  employee_id VARCHAR(50) NOT NULL,
  team_id UUID NOT NULL,
  tasks_completed TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  blocker_type VARCHAR(50),
  blocker_description TEXT,
  expected_resolution_date DATE,
  additional_notes TEXT,
  start_date DATE,
  end_date DATE,
  story_points NUMERIC(5,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Basic indexes for performance
CREATE INDEX idx_daily_updates_employee ON aditi_daily_updates(employee_email);
CREATE INDEX idx_daily_updates_team ON aditi_daily_updates(team_id);
CREATE INDEX idx_team_members_team ON aditi_team_members(team_id);
CREATE INDEX idx_team_members_employee ON aditi_team_members(employee_email);

-- Add admin user
INSERT INTO aditi_admins (email, name)
VALUES ('anubhavchaudhary459@gmail.com', 'Anubhav Chaudhary');

INSERT INTO aditi_admins (email, name)
VALUES ('anubhav.chaudhary@aditiconsulting.com', 'Anubhav Chaudhary');
select * from aditi_admins limit 10;

INSERT INTO aditi_admins (email, name)
VALUES ('shivaku@aditiconsulting.com', 'Shiva');