import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- ĐÂY LÀ KEY LẤY TỪ ẢNH MÀN HÌNH CỦA BẠN (CHẮC CHẮN ĐÚNG) ---
const API_KEY = "AIzaSyCJ8-8krZ5lozRzQUP1QEppp1hinu1xpv4"; 

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// --- HÀM UTILS ---
function getSafeImageUrl(text: string): string {
    return `https://placehold.co/800x600/f8fafc/475569.png?text=${encodeURIComponent(text)}&font=roboto`;
}

function cleanGeminiResponse(text: string): string {
  // Xóa các ký tự markdown thừa nếu có
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function parseGeminiResponseToSuggestionResponse(geminiText: string, input: UserInput): SuggestionResponse {
  try {
    const cleanedText = cleanGeminiResponse(geminiText);
    const parsedJson = JSON.parse(cleanedText);

    if (!parsedJson.meals || !Array.isArray(parsedJson.meals)) {
      throw new Error("Dữ liệu trả về thiếu danh sách món ăn (meals)");
    }

    const suggestedMeals: SuggestionMeal[] = parsedJson.meals.map((meal: any, index: number) => {
        let calVal = 0;
        if (meal.calories) calVal = parseInt(String(meal.calories).replace(/[^0-9]/g, '')) || 0;
        const mealName = meal.name || "Món ăn dinh dưỡng";

        return {
            recipe_id: `meal-${input.day_number}-${index}-${Date.now()}`,
            recipe_name: mealName,
            short_description: meal.ingredients || "Món ăn tốt cho sức khỏe",
            reason: parsedJson.advice || "Phù hợp với mục tiêu phục hồi.",
            how_it_supports_gut: "Dễ tiêu hóa.",
            fit_with_goal: "Hỗ trợ phục hồi.",
            main_ingredients_brief: meal.ingredients,
            ingredients: meal.ingredients 
                ? String(meal.ingredients).split(/,|;/).map((ing: string) => ({ name: ing.trim(), quantity: "Tùy ý" })) 
                : [],
            nutrition_estimate: {
                kcal: calVal, protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0, 
                vegetables_g: 0, fruit_g: 0, added_sugar_g: 0, sodium_mg: 0,
            },
            fit_score: 95, 
            warnings_or_notes: [],
            image_url: getSafeImageUrl(mealName), 
        };
    });

    return {
      day_number: input.day_number,
      phase: 1, 
      meal_type: input.meal_type,
      explanation_for_phase: parsedJson.advice || "Thực đơn lành mạnh.",
      suggested_meals: suggestedMeals,
    };
  } catch (e) {
    console.error("Lỗi xử lý dữ liệu Gemini:", e);
    throw e;
  }
}

// --- MAIN SERVICE (DÙNG FETCH TRỰC TIẾP ĐỂ TRÁNH LỖI THƯ VIỆN) ---
export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  // Danh sách model khớp với tài khoản của bạn
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"]; 
  let lastError: any = null;

  const userProfile = input.user_profile;
  const jsonStructure = `{ "advice": "Lời khuyên", "meals": [{ "name": "Tên món", "ingredients": "Nguyên liệu", "calories": "500" }] }`;
  
  const promptText = `
    Đóng vai chuyên gia dinh dưỡng. Tạo thực đơn 1 món cho bữa ${input.meal_type}.
    Khách hàng: ${userProfile?.demographics?.sex}, ${userProfile?.goals?.primary_goal}.
    Ghi chú: ${input.personal_note || "Không có"}.
    BẮT BUỘC trả về JSON đúng định dạng: ${jsonStructure}
  `;

  for (const modelName of modelsToTry) {
    console.log(`📡 Đang gọi model: ${modelName}...`);
    try {
      // Gọi API trực tiếp, loại bỏ mọi vấn đề về version thư viện
      const response = await fetch(`${BASE_URL}/${modelName}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`⚠️ Model ${modelName} lỗi (${response.status}): ${errText}`);
        // Nếu lỗi 404 (Model not found) hoặc 400 (Bad Request), thử model tiếp theo
        throw new Error(errText);
      }

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
         return parseGeminiResponseToSuggestionResponse(data.candidates[0].content.parts[0].text, input);
      } else {
         throw new Error("API trả về nhưng không có nội dung.");
      }
    } catch (error: any) {
      lastError = error;
    }
  }

  throw new Error(`Không thể tạo thực đơn (Đã thử hết các model). Lỗi cuối cùng: ${lastError?.message}`);
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  return getSafeImageUrl(meal.recipe_name);
};