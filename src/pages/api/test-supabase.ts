import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Create a Supabase client with the service role key for admin privileges
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the table name from the query parameters or use a default
    const tableName = req.query.table as string || 'aditi_daily_updates';
    
    // Test connection by getting schema information
    const { data: schemaData, error: schemaError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
      
    if (schemaError) {
      console.error(`Error fetching schema for ${tableName}:`, schemaError);
      return res.status(500).json({ 
        success: false, 
        error: schemaError.message,
        details: `Failed to get schema for ${tableName}`
      });
    }

    // Get list of tables in public schema
    const { data: tableList, error: tableListError } = await supabase
      .rpc('get_tables');

    // Get column information for the specified table
    const { data: columnInfo, error: columnError } = await supabase
      .rpc('get_columns', { table_name: tableName });
      
    return res.status(200).json({
      success: true,
      message: 'Supabase connection successful',
      tableExampleData: schemaData,
      tables: tableList || [],
      columns: columnInfo || [],
      tableName: tableName
    });
  } catch (error) {
    console.error('API route error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
} 