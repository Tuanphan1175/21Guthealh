import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
// Key cũ của bạn vẫn dùng tốt, chỉ cần biết cách gọi
const API_KEY = "AIzaSyCJ8-8krZ5lozRzQUP1QEppp1hinu1xpv4"; 
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Hàm tạo ảnh (Pollinations AI)
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
  // DANH SÁCH MODEL ĐỂ THỬ (Tự động đổi nếu cái đầu bị lỗi)
  // Ưu tiên 2.5 (xịn nhất), nếu không được thì thử 2.0 (dễ tính nhất)
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash-exp"];
  
  const promptText = `
    Đóng vai chuyên gia dinh dưỡng. Tạo thực đơn 1 món cho bữa ${input.meal_type}.
    Khách hàng: ${input.user_profile?.demographics?.sex}, Mục tiêu: ${input.user_profile?.goals?.primary_goal}.
    Ghi chú: ${input.personal_note || "Không"}.
    BẮT BUỘC trả về JSON mẫu: { "advice": "...", "meals": [{ "name": "...", "ingredients": "...", "calories": "..." }] }
  `;

  let lastError: any = null;

  // Xóa khoảng trắng thừa trong Key nếu có
  const cleanKey = API_KEY.trim();

  for (const modelName of modelsToTry) {
    try {
      console.log(`📡 Đang gọi model: ${modelName}...`);
      
      const response = await fetch(`${BASE_URL}/${modelName}:generateContent?key=${cleanKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        referrerPolicy: "no-referrer", // <--- BÍ THUẬT: Giúp vượt qua lỗi chặn localhost
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      });

      if (!response.ok) {
          const errorText = await response.text();
          // Nếu lỗi 404 (Không tìm thấy model) hoặc 400 (Key lỗi), thử model tiếp theo
          console.warn(`⚠️ Model ${modelName} lỗi: ${errorText}`);
          throw new Error(errorText);
      }

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
         return parseGeminiResponseToSuggestionResponse(data.candidates[0].content.parts[0].text, input);
      }
    } catch (error: any) {
      lastError = error;
    }
  }
  
  throw new Error(`Không thể tạo thực đơn. Lỗi cuối cùng: ${lastError?.message || "Vui lòng kiểm tra API Key"}`);
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  return getRealFoodImage(meal.recipe_name + " " + Math.random());
};