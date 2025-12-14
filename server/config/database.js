// server/config/database.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for server-side operations
);

// Helper function to test database connection
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Query helper with error handling
async function query(table, operation, options = {}) {
  try {
    let queryBuilder = supabase.from(table);
    
    switch(operation) {
      case 'select':
        queryBuilder = queryBuilder.select(options.select || '*');
        if (options.where) {
          Object.entries(options.where).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value);
          });
        }
        if (options.limit) queryBuilder = queryBuilder.limit(options.limit);
        if (options.order) queryBuilder = queryBuilder.order(options.order.column, { ascending: options.order.ascending !== false });
        break;
      
      case 'insert':
        queryBuilder = queryBuilder.insert(options.data);
        if (options.select) queryBuilder = queryBuilder.select(options.select);
        break;
      
      case 'update':
        queryBuilder = queryBuilder.update(options.data);
        if (options.where) {
          Object.entries(options.where).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value);
          });
        }
        break;
      
      case 'delete':
        if (options.where) {
          Object.entries(options.where).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value);
          });
        }
        queryBuilder = queryBuilder.delete();
        break;
    }
    
    const { data, error } = await queryBuilder;
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error(`Database ${operation} error:`, error.message);
    return { success: false, error: error.message };
  }
}

// RPC call helper for complex queries
async function rpc(functionName, params = {}) {
  try {
    const { data, error } = await supabase.rpc(functionName, params);
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error(`RPC ${functionName} error:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  supabase,
  testConnection,
  query,
  rpc
};