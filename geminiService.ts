import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
const API_KEY = "AIzaSyDf3VXB6lOd39RwRe0_ggr3ckBaqCXvUnU"; // <--- NHỚ DÁN KEY CỦA BẠN
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash";

// --- HÀM TẠO ẢNH THÔNG MINH ---
// Sử dụng từ khóa tiếng Anh do Gemini cung cấp để vẽ chính xác
function getRealFoodImage(englishDishName: string): string {
    // 1. Dọn dẹp từ khóa (xóa ký tự lạ)
    const cleanName = englishDishName.replace(/[^a-zA-Z0-9 ]/g, "");
    
    // 2. Tạo prompt vẽ ảnh chuẩn studio
    const prompt = encodeURIComponent(`professional food photography of ${cleanName}, michelin star plating, 8k resolution, soft lighting, appetizing, delicious`);
    
    // 3. Gọi Pollinations (Vẽ chính xác theo tên)
    // Thêm seed để ảnh không bị trùng lặp
    return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=600&nologo=true&seed=${Math.floor(Math.random() * 9999)}`;
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
        
        // --- ĐIỂM MẤU CHỐT: LẤY TÊN TIẾNG ANH TỪ AI ---
        // Nếu AI quên trả về tiếng Anh, dùng tạm tên tiếng Việt
        const imageKeyword = meal.image_keyword_en || mealName;

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
            // Truyền tên Tiếng Anh vào hàm tạo ảnh
            image_url: getRealFoodImage(imageKeyword), 
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
  // --- CÂU LỆNH PROMPT MỚI (Yêu cầu trả về cả tên Tiếng Anh) ---
  const promptText = `
    Bạn là API JSON dinh dưỡng. Chỉ trả về JSON.
    Tạo thực đơn 1 món cho bữa ${input.meal_type}.
    Khách hàng: ${input.user_profile?.demographics?.sex}, Mục tiêu: ${input.user_profile?.goals?.primary_goal}.
    
    YÊU CẦU ĐẶC BIỆT:
    - Trường "image_keyword_en": Hãy dịch tên món ăn sang tiếng Anh ngắn gọn (Ví dụ: "Pho Bo" -> "Beef Noodle Soup").
    
    JSON Mẫu Bắt Buộc: 
    { 
      "advice": "...", 
      "meals": [{ 
        "name": "Tên món (Việt)", 
        "image_keyword_en": "English Name Here", 
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
  // Khi bấm nút tạo lại ảnh, dùng tên món để vẽ lại
  return getRealFoodImage(meal.recipe_name);
};