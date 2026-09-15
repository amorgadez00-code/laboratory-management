const SUPABASE_URL = "https://bfapfbhipemiouugyahi.supabase.co";

const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
