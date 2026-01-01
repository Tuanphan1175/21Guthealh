import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- DÁN CHÌA KHÓA MỚI CỦA BẠN VÀO ĐÂY ---
const API_KEY = "AIzaSyAUOOs-fblTPpB4sLop2vjmj405U9nTZco"; 
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Hàm tạo ảnh (Giữ nguyên)
function getRealFoodImage(text: string): string {
    const prompt = encodeURIComponent(`delicious food photography, ${text}, 8k resolution, cinematic lighting, appetizing`);
    return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=600&nologo=true&seed=${Math.floor(Math.random() * 9999)}`;
}

function cleanGeminiResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function parseGeminiResponseToSuggestionResponse(geminiText: string, input: UserInput): SuggestionResponse {
  try {
    const cleanedText = cleanGeminiResponse(geminiText);
    const parsedJson = JSON.parse(cleanedText);
    if (!parsedJson.meals || !Array.isArray(parsedJson.meals)) throw new Error("Thiếu dữ liệu meals");

    const suggestedMeals: SuggestionMeal[] = parsedJson.meals.map((meal: any, index: number) => {
        const mealName = meal.name || "Món ăn dinh dưỡng";
        return {
            recipe_id: `meal-${input.day_number}-${index}-${Date.now()}`,
            recipe_name: mealName,
            short_description: meal.ingredients || "Tốt cho sức khỏe",
            reason: parsedJson.advice || "Hỗ trợ phục hồi.",
            how_it_supports_gut: "Dễ tiêu hóa.",
            fit_with_goal: "Phù hợp mục tiêu.",
            main_ingredients_brief: meal.ingredients,
            ingredients: [],
            nutrition_estimate: { kcal: 500, protein_g: 30, fat_g: 10, carb_g: 50, fiber_g: 5, vegetables_g: 100, fruit_g: 0, added_sugar_g: 0, sodium_mg: 0 },
            fit_score: 95, 
            warnings_or_notes: [],
            image_url: getRealFoodImage(mealName),
        };
    });

    return {
      day_number: input.day_number,
      phase: 1, 
      meal_type: input.meal_type,
      explanation_for_phase: parsedJson.advice || "Lời khuyên dinh dưỡng.",
      suggested_meals: suggestedMeals,
    };
  } catch (e) {
    console.error("Lỗi xử lý:", e);
    throw e;
  }
}

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  // Dùng model 1.5 Flash vì nó nhanh và ổn định nhất
  const modelName = "gemini-1.5-flash";
  
  const promptText = `
    Đóng vai chuyên gia dinh dưỡng. Tạo thực đơn 1 món cho bữa ${input.meal_type}.
    Khách hàng: ${input.user_profile?.demographics?.sex}, Mục tiêu: ${input.user_profile?.goals?.primary_goal}.
    Ghi chú: ${input.personal_note || "Không"}.
    BẮT BUỘC trả về JSON mẫu: { "advice": "...", "meals": [{ "name": "...", "ingredients": "...", "calories": "..." }] }
  `;

  try {
    const response = await fetch(`${BASE_URL}/${modelName}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Error: ${errorText}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
       return parseGeminiResponseToSuggestionResponse(data.candidates[0].content.parts[0].text, input);
    }
    throw new Error("Không có dữ liệu trả về.");
  } catch (error: any) {
    console.error("Lỗi:", error);
    throw error;
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  return getRealFoodImage(meal.recipe_name + " " + Math.random());
};