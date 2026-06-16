import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xoltdexbtqkixmmbupqa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvbHRkZXhidHFraXhtbWJ1cHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MzY1OTYsImV4cCI6MjA5NzIxMjU5Nn0.BjmIvK0viEwYU5NuauGcGEc-RgbZ0c-Bebuo-rZ3gnk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
