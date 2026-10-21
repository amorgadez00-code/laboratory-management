const SUPABASE_URL = "https://bfapfbhipemiouugyahi.supabase.co";

const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmYXBmYmhpcGVtaW91dWd5YWhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTQ0NzcyNCwiZXhwIjoyMTA1MDIzNzI0fQ.yXIq4RZJHEmCWuT3KIkIT6FMPgpS0wGXGWfzBLjo_pw";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
