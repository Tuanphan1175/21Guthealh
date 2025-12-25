import { PersistRequest } from "./types";

export async function persistMealSuggestionsEdge(payload: PersistRequest) {
  // Using the project URL provided by the user, targeting the 'persist-meal-suggestions' function
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
    throw new Error(`EdgeFunction failed: ${res.status} ${text}`);
  }
  return res.json();
}
