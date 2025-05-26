import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Use service role key to be able to create/alter tables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Checking database tables...');

    // Get a list of all tables
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('tablename, schemaname')
      .eq('schemaname', 'public');

    if (tablesError) {
      return res.status(500).json({ error: `Error fetching tables: ${tablesError.message}` });
    }

    // Fetch sample data from each important table
    const tableResults: Record<string, any> = {};
    
    const requiredTables = [
      'aditi_teams',
      'aditi_team_members',
      'aditi_daily_updates'
    ];
    
    for (const tableName of requiredTables) {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(5);
        
      if (error) {
        tableResults[tableName] = { error: error.message };
      } else {
        tableResults[tableName] = { 
          count, 
          sample: data,
          exists: true 
        };
      }
    }

    return res.status(200).json({
      message: 'Database check complete',
      tables: tables?.map(t => t.tablename) || [],
      tableData: tableResults
    });
  } catch (error) {
    console.error('Error checking database:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
} 