import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
const API_KEY = "AIzaSyDf3VXB6lOd39RwRe0_ggr3ckBaqCXvUnU"; // <--- DÁN KEY CỦA BẠN
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash";

// --- HÀM LẤY ẢNH (TỐI GIẢN HÓA) ---
function getRealFoodImage(simpleKeyword: string): string {
    // 1. Làm sạch từ khóa (chỉ giữ lại chữ cái và dấu phẩy)
    // Ví dụ: "Green Smoothie" -> "Green,Smoothie"
    const finalKeyword = simpleKeyword.trim().replace(/ /g, ',');

    // 2. Thêm "food" để đảm bảo không ra vật thể lạ
    // Cấu trúc: TỪ_KHÓA_NGẮN + food
    const searchString = `${finalKeyword},food`; 

    const randomLock = Math.floor(Math.random() * 9999);
    return `https://loremflickr.com/800/600/${searchString}?lock=${randomLock}`;
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
        
        // Lấy từ khóa SIÊU NGẮN từ Gemini (Ví dụ: "Green Smoothie")
        const searchKey = meal.image_search_term || "healthy food";

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
            // Truyền từ khóa siêu ngắn vào hàm lấy ảnh
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
    
    YÊU CẦU TỐI QUAN TRỌNG VỀ ẢNH ("image_search_term"):
    - Hãy đóng vai một chuyên gia tìm kiếm ảnh Stock.
    - Cung cấp 1 từ khóa Tiếng Anh CỰC NGẮN (Tối đa 2 từ) mô tả loại món ăn và màu sắc chủ đạo.
    - TUYỆT ĐỐI KHÔNG liệt kê nguyên liệu phụ.
    
    VÍ DỤ MẪU:
    - Món: "Sinh tố chuối, rau bina, gừng" -> Từ khóa: "Green Smoothie" (Đừng ghi Banana Spinach...)
    - Món: "Cháo yến mạch táo quế" -> Từ khóa: "Oatmeal"
    - Món: "Cơm gạo lứt gà nướng" -> Từ khóa: "Chicken Rice"
    - Món: "Canh bí đỏ thịt bằm" -> Từ khóa: "Pumpkin Soup"
    
    JSON Mẫu: 
    { 
      "advice": "...", 
      "meals": [{ 
        "name": "Tên món (Việt)", 
        "image_search_term": "Green Smoothie", 
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
  // Fallback an toàn khi tạo lại ảnh
  return getRealFoodImage("healthy food"); 
};