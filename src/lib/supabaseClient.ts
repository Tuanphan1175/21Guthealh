import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zdqliaurykbomhdxfmjk.supabase.co";
const SUPABASE_ANON_KEY = "2DBB7fPbnzXgLteH3XJc4TYjbME67As1uFbVSPZVIOKFY98vw8SGZD0VLjvWxg2ZX1UtPKY0sY80tKCiZCor7Q==";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);