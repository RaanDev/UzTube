import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Lazy initialization of the Supabase client.
 * This prevents the app from crashing on startup if environment variables are missing.
 */
const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      // We throw an error here so it's caught when the app actually tries to use Supabase,
      // rather than crashing the entire application on load.
      throw new Error(
        'Supabase configuration is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.'
      );
    }

    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      throw error;
    }
  }
  return supabaseInstance;
};

// Export a proxy that behaves like the Supabase client but initializes lazily.
// This allows us to keep the existing "import { supabase } from ..." syntax.
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    const instance = getSupabase();
    const value = Reflect.get(instance, prop);
    
    // If the value is a function, we need to bind it to the instance
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    
    return value;
  },
});
