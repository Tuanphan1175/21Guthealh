import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
const API_KEY = "DÁN_KEY_MỚI_CỦA_BẠN_VÀO_ĐÂY"; // <--- DÁN KEY CỦA BẠN
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash";

// --- HÀM LẤY ẢNH TỪ BING (SỨC MẠNH TÌM KIẾM THỰC TẾ) ---
function getRealFoodImage(keyword: string): string {
    // 1. Tạo từ khóa tìm kiếm chuẩn: Tên món + "food photography" để ra ảnh đẹp
    const searchLayout = `${keyword} food photography delicious`;
    const encodedQuery = encodeURIComponent(searchLayout);
    
    // 2. Sử dụng Bing Thumbnail Proxy (Tìm ảnh thực trên mạng)
    // w=800, h=600: Kích thước ảnh
    // c=7: Cắt ảnh (Crop) thông minh để vừa khung
    return `https://tse4.mm.bing.net/th?q=${encodedQuery}&w=800&h=600&c=7&rs=1`;
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
        
        // Lấy tên tiếng Anh để tìm trên Bing cho chuẩn xác
        // Nếu không có, dùng luôn tên tiếng Việt (Bing vẫn hiểu tốt!)
        const searchKey = meal.image_search_term || mealName;

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
            // Truyền từ khóa vào hàm Bing
            image_url: getRealFoodImage(searchKey), 
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
    
    VỀ HÌNH ẢNH ("image_search_term"):
    - Hãy cung cấp tên món ăn bằng Tiếng Anh ngắn gọn.
    - Ví dụ: "Sinh tố chuối rau bina" -> "Banana Spinach Smoothie".
    - "Cơm gà nướng" -> "Grilled Chicken Rice".
    
    JSON Mẫu: 
    { 
      "advice": "...", 
      "meals": [{ 
        "name": "Tên món (Việt)", 
        "image_search_term": "English Dish Name", 
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
  // Tìm lại ảnh bằng chính tên món tiếng Việt khi bấm nút (Bing hiểu cả tiếng Việt!)
  return getRealFoodImage(meal.recipe_name); 
};