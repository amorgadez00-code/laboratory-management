const SUPABASE_URL = "https://bfapfbhipemiouugyahi.supabase.co";


const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmYXBmYmhpcGVtaW91dWd5YWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NDc3MjQsImV4cCI6MjEwNTAyMzcyNH0.LR2u3Cc4RuwwFV4RKk5FzHf5_UX3-5gInJQmz6i9wJg";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );
