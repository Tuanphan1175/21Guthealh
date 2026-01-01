import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
const API_KEY = "AIzaSyDf3VXB6lOd39RwRe0_ggr3ckBaqCXvUnU"; // <--- ĐỪNG QUÊN DÁN KEY
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash";

// --- TỪ ĐIỂN ẢNH AN TOÀN (Mapping) ---
// Thay vì tìm kiếm ngẫu nhiên, ta định nghĩa các từ khóa "bao chuẩn"
const SAFE_IMAGE_KEYWORDS: Record<string, string> = {
    "oats": "oatmeal,fruit,bowl",      // Nhóm Yến mạch -> Tìm ảnh yến mạch + trái cây
    "smoothie": "smoothie,glass,fruit", // Nhóm Sinh tố -> Tìm ảnh ly sinh tố
    "soup": "soup,bowl,spoon",         // Nhóm Súp/Cháo -> Tìm ảnh bát súp
    "salad": "salad,vegetable,plate",  // Nhóm Salad -> Tìm ảnh đĩa rau
    "rice": "fried,rice,food",         // Nhóm Cơm -> Tìm ảnh cơm rang (tránh ra hóa đơn)
    "noodle": "noodle,soup,bowl",      // Nhóm Mì/Phở -> Tìm ảnh bát mì
    "chicken": "roasted,chicken,food", // Nhóm Gà -> Gà quay/nướng
    "fish": "grilled,fish,food",       // Nhóm Cá
    "meat": "steak,beef,food",         // Nhóm Thịt đỏ
    "bread": "sandwich,bread,food",    // Nhóm Bánh mì
    "fruit": "fruit,platter,fresh",    // Nhóm Trái cây
    "default": "healthy,food,dish"     // Mặc định
};

// --- HÀM LẤY ẢNH THÔNG MINH ---
function getRealFoodImage(category: string): string {
    // 1. Chuẩn hóa category (về chữ thường, bỏ khoảng trắng)
    const key = category.trim().toLowerCase();
    
    // 2. Tra cứu từ khóa an toàn trong từ điển
    // Nếu Gemini trả về category lạ, dùng "default"
    const searchKeyword = SAFE_IMAGE_KEYWORDS[key] || SAFE_IMAGE_KEYWORDS["default"];
    
    // 3. Tạo random lock để ảnh thay đổi mỗi lần bấm (nhưng vẫn đúng chủ đề)
    const randomLock = Math.floor(Math.random() * 9999);

    // URL LoremFlickr với từ khóa ĐÃ ĐƯỢC KIỂM SOÁT
    return `https://loremflickr.com/800/600/${searchKeyword}?lock=${randomLock}`;
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
        
        // Lấy category từ Gemini (Ví dụ: "oats", "soup")
        const imageCategory = meal.image_category || "default";

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
            // Gọi hàm lấy ảnh với category
            image_url: getRealFoodImage(imageCategory), 
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
    
    QUAN TRỌNG VỀ HÌNH ẢNH:
    - Hãy phân loại món ăn vào ĐÚNG 1 trong các nhóm sau (điền vào trường "image_category"):
    - Danh sách nhóm: "oats", "smoothie", "soup", "salad", "rice", "noodle", "chicken", "fish", "meat", "bread", "fruit".
    - Ví dụ: 
      + "Yến mạch/Cháo yến mạch" -> "oats"
      + "Cơm gà" -> "rice"
      + "Sinh tố bơ" -> "smoothie"
      + "Phở bò" -> "noodle"
    
    JSON Mẫu: 
    { 
      "advice": "...", 
      "meals": [{ 
        "name": "Tên món", 
        "image_category": "oats", 
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
  // Khi tạo lại ảnh, ta không biết category, nên dùng tên món làm từ khóa fallback
  return `https://loremflickr.com/800/600/${meal.recipe_name.replace(/ /g, ',')},food?lock=${Math.random()}`;
};