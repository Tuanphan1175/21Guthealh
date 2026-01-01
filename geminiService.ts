import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
const API_KEY = "AIzaSyDf3VXB6lOd39RwRe0_ggr3ckBaqCXvUnU"; // <--- DÁN KEY CỦA BẠN VÀO ĐÂY
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash";

// --- HÀM TẠO ẢNH AI (DÙNG MODEL FLUX - KHÔNG CÒN LỖI BẢO TRÌ) ---
function getRealFoodImage(keyword: string): string {
    // 1. Dọn dẹp từ khóa
    const cleanKeyword = keyword.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    
    // 2. Tạo prompt tiếng Anh chuẩn cho Model Flux
    const prompt = encodeURIComponent(`professional food photography of ${cleanKeyword}, michelin restaurant style, 8k, hyperrealistic, soft studio lighting, delicious`);
    
    // 3. Gọi Pollinations với Model FLUX (Quan trọng!)
    const seed = Math.floor(Math.random() * 99999);
    return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=600&nologo=true&model=flux&seed=${seed}`;
}

function cleanGeminiResponse(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return text;
}

function parseGeminiResponseToSuggestionResponse(geminiText: string, input: UserInput): SuggestionResponse {
  try {
    const cleanedText = cleanGeminiResponse(geminiText);
    const parsedJson = JSON.parse(cleanedText);
    
    const mealsData = Array.isArray(parsedJson) ? parsedJson : (parsedJson.meals || []);
    if (!Array.isArray(mealsData)) throw new Error("Không tìm thấy danh sách món ăn");

    const suggestedMeals: SuggestionMeal[] = mealsData.map((meal: any, index: number) => {
        const mealName = meal.name || "Món ăn dinh dưỡng";
        
        // Lấy tên Tiếng Anh từ Gemini để vẽ cho chuẩn
        const imageKeyword = meal.image_keyword_en || "delicious healthy food";

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
            image_url: getRealFoodImage(imageKeyword), // Vẽ bằng Model Flux
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
    console.error("Lỗi xử lý JSON:", e);
    throw e;
  }
}

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  const promptText = `
    Bạn là API JSON. Chỉ trả về JSON.
    Tạo thực đơn 1 món cho bữa ${input.meal_type}.
    Khách hàng: ${input.user_profile?.demographics?.sex}, Mục tiêu: ${input.user_profile?.goals?.primary_goal}.
    
    QUAN TRỌNG:
    - Hãy dịch tên món ăn sang Tiếng Anh (ngắn gọn, chính xác) và điền vào trường "image_keyword_en".
    - Ví dụ: "Sinh tố bơ" -> "Avocado Smoothie". "Cháo gà" -> "Chicken Rice Porridge".
    
    JSON Mẫu: 
    { 
      "advice": "...", 
      "meals": [{ 
        "name": "Tên món (Việt)", 
        "image_keyword_en": "English Name", 
        "ingredients": "...", 
        "calories": "..." 
      }] 
    }
  `;

  if (API_KEY.includes("DÁN_KEY") || API_KEY.length < 10) throw new Error("⚠️ Chưa nhập API Key!");

  try {
    console.log(`📡 Đang gọi model: ${MODEL_NAME}...`);
    const response = await fetch(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
       return parseGeminiResponseToSuggestionResponse(data.candidates[0].content.parts[0].text, input);
    }
    throw new Error("Không có dữ liệu.");
  } catch (error: any) {
    console.error("Lỗi:", error);
    throw error;
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  // Khi tạo lại ảnh, cũng dùng tên món tiếng Anh (nếu có lưu) hoặc tên tiếng Việt
  return getRealFoodImage(meal.recipe_name);
};