import { supabase } from "./src/lib/supabaseClient";

export async function invokeGutHealth(body: any) {
  const { data, error } = await supabase.functions.invoke("guthealth_generate", { body });
  if (error) throw error;
  return data;
}
