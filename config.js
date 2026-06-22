// MediCore — Supabase connection settings
// These are PUBLIC-safe keys (designed to be used in frontend code).
// Do not put your database password or any "service_role" key here — ever.

const SUPABASE_URL = "https://ncrsxidmglgkvmlnzadd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sKnJIbGwC_YgO_JlF-7xBw_Cs8n9XhV";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
