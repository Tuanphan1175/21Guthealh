import { supabase } from "./lib/supabaseClient";
import { PersistRequest } from "./types";

// Giữ lại hàm cũ dùng fetch cho tính năng persist (hoặc có thể refactor sau)
export async function persistMealSuggestionsEdge(payload: PersistRequest) {
  const PROJECT_URL = "https://zdqliaurykbomhdxfmjk.supabase.co";
  const FUNCTION_NAME = "persist-meal-suggestions";
  const fullUrl = `${PROJECT_URL}/functions/v1/${FUNCTION_NAME}`;

  const res = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer 2DBB7fPbnzXgLteH3XJc4TYjbME67As1uFbVSPZVIOKFY98vw8SGZD0VLjvWxg2ZX1UtPKY0sY80tKCiZCor7Q=="
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EdgeFunction persist failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Hàm mới sử dụng Supabase Client SDK
export async function invokeGutHealth(body: any) {
  const { data, error } = await supabase.functions.invoke("guthealth_generate", {
    body,
  });
  
  if (error) {
    console.error("Supabase Invoke Error:", error);
    throw error;
  }
  
  return data;
}