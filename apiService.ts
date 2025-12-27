// apiService.ts (ROOT)

import { supabase } from "./src/lib/supabaseClient"; 
// Nếu của Bác nằm ở "./lib/supabaseClient" thì đổi lại đúng path.

export async function invokeGutHealth(body: any) {
  const { data, error } = await supabase.functions.invoke("guthealth_generate", {
    body,
  });
  if (error) throw error;
  return data;
}
