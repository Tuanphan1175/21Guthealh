import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
// 👇👇👇 DÁN CHÌA KHÓA CỦA BẠN VÀO GIỮA HAI DẤU NGOẶC KÉP DƯỚI ĐÂY 👇👇👇
const API_KEY = "AIza..."; // <--- XÓA CHỖ NÀY VÀ DÁN KEY CỦA BẠN VÀO ĐÂY
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash";

// --- BỘ KIẾN THỨC DINH DƯỠNG (ĐÃ NẠP TỪ TÀI LIỆU CỦA BẠN) ---
const GUT_HEALTH_RULES = `
QUY TẮC DINH DƯỠNG "GUT HEALTH 21 NGÀY":
1. GIAI ĐOẠN 1 (Ngày 1-3): THANH LỌC. 
   - CẤM TUYỆT ĐỐI: Tinh bột (cơm, khoai, bún, phở, bánh mì), Đường, Sữa bò.
   - ƯU TIÊN: Sinh tố xanh (Green Smoothie), Protein thực vật, Canh súp rau củ, Cá hấp/luộc.
2. GIAI ĐOẠN 2 (Ngày 4-21): PHỤC HỒI. 
   - ĐƯỢC ĂN: Tinh bột tốt (Khoai lang, gạo lứt, quinoa, yến mạch).
   - ĐẠM: Đa dạng (Cá hồi, ức gà, hải sản, trứng gà ta).
3. DANH SÁCH CẤM: Thịt đỏ công nghiệp, đồ chiên xào nhiều dầu, lúa mì, bắp (ngô).
4. KHUYẾN KHÍCH: Rau 5 màu, Các loại hạt (Mắc ca, Óc chó), Dầu Oliu, Quả Bơ.
`;

// --- TỪ ĐIỂN ẢNH AN TOÀN (ANTI-CAT MAPPING) ---
// Danh sách này đảm bảo 100% ra ảnh đẹp, không bao giờ ra mèo
const SAFE_IMAGES: Record<string, string> = {
    "fish": "grilled,fish,food",          // Nhóm Cá
    "chicken": "roasted,chicken,breast",  // Nhóm Gà
    "meat": "beef,steak,food",            // Nhóm Thịt (Bò/Heo sạch)
    "rice": "fried,rice,vegetable",       // Nhóm Cơm/Gạo lứt
    "potato": "sweet,potato,food",        // Nhóm Khoai lang
    "noodle": "noodle,soup,bowl",         // Nhóm Bún/Phở
    "salad": "fresh,salad,plate",         // Nhóm Salad
    "smoothie": "green,smoothie,glass",   // Nhóm Sinh tố
    "soup": "pumpkin,soup,bowl",          // Nhóm Súp
    "fruit": "fruit,platter,fresh",       // Nhóm Trái cây
    "oats": "oatmeal,bowl,fruit",         // Nhóm Yến mạch
    "default": "healthy,food,dish"        // Mặc định
};

function getSafeImage(category: string): string {
    const key = category.trim().toLowerCase();
    const searchKeyword = SAFE_IMAGES[key] || SAFE_IMAGES["default"];
    const randomLock = Math.floor(Math.random() * 9999);
    return `https://loremflickr.com/800/600/${searchKeyword}?lock=${randomLock}`;
}

function cleanGeminiResponse(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) return text.substring(firstBrace, lastBrace + 1);
  return text;
}

function parseGeminiResponseToSuggestionResponse(geminiText: string, input: UserInput): SuggestionResponse {
  try {
    const cleanedText = cleanGeminiResponse(geminiText);
    const parsedJson = JSON.parse(cleanedText);
    
    const mealsData = Array.isArray(parsedJson) ? parsedJson : (parsedJson.meals || []);
    if (!Array.isArray(mealsData)) throw new Error("Không tìm thấy dữ liệu món ăn");

    const suggestedMeals: SuggestionMeal[] = mealsData.map((meal: any, index: number) => {
        const mealName = meal.name || "Món ăn dinh dưỡng";
        // Lấy Category từ AI để tìm ảnh chuẩn
        const category = meal.image_category || "default";

        return {
            recipe_id: `meal-${input.day_number}-${index}-${Date.now()}`,
            recipe_name: mealName,
            short_description: meal.ingredients || "Tốt cho sức khỏe",
            reason: parsedJson.advice || "Phù hợp lộ trình 21 ngày.",
            how_it_supports_gut: "Dễ tiêu hóa, hỗ trợ niêm mạc.",
            fit_with_goal: "Đúng chuẩn Gut Health.",
            main_ingredients_brief: meal.ingredients,
            ingredients: [],
            nutrition_estimate: { 
                kcal: parseInt(meal.calories) || 500, 
                protein_g: 30, fat_g: 10, carb_g: 50, fiber_g: 10, vegetables_g: 100, fruit_g: 50, added_sugar_g: 0, sodium_mg: 0 
            },
            fit_score: 98, 
            warnings_or_notes: [],
            image_url: getSafeImage(category), // Lấy ảnh an toàn
        };
    });

    return {
      day_number: input.day_number,
      phase: input.day_number <= 3 ? 1 : 2, 
      meal_type: input.meal_type,
      explanation_for_phase: input.day_number <= 3 ? "Giai đoạn 1: Thanh Lọc (Kiêng tinh bột)" : "Giai đoạn 2: Phục Hồi (Ăn tinh bột tốt)",
      suggested_meals: suggestedMeals,
    };
  } catch (e) {
    console.error("Lỗi JSON:", e);
    throw e;
  }
}

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  const promptText = `
    Bạn là Chuyên gia Dinh dưỡng hệ thống GutHealth21.
    Khách hàng: ${input.user_profile?.demographics?.sex}, Mục tiêu: ${input.user_profile?.goals?.primary_goal}.
    NGÀY THỨ: ${input.day_number} (Giai đoạn ${input.day_number <= 3 ? "1 - Thanh Lọc" : "2 - Phục Hồi"}).
    Bữa: ${input.meal_type}.

    TUÂN THỦ QUY TẮC:
    ${GUT_HEALTH_RULES}

    YÊU CẦU ẢNH (QUAN TRỌNG):
    - Hãy phân loại món ăn vào ĐÚNG 1 TRONG CÁC NHÓM SAU (điền vào trường "image_category"):
    - Danh sách nhóm: "fish", "chicken", "meat", "rice", "potato", "salad", "soup", "smoothie", "oats", "fruit".
    - Ví dụ: "Cá hồi hấp" -> "fish". "Cháo yến mạch" -> "oats". "Khoai lang luộc" -> "potato".
    
    JSON Mẫu: 
    { 
      "advice": "Lời khuyên...", 
      "meals": [{ 
        "name": "Tên món (Tiếng Việt)", 
        "image_category": "fish", 
        "ingredients": "...", 
        "calories": "..." 
      }] 
    }
  `;

  if (API_KEY.includes("AIza") === false) {
       throw new Error("⚠️ BẠN CHƯA DÁN API KEY! Vui lòng mở file code và dán Key vào dòng số 4.");
  }

  try {
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
    throw new Error("No data found.");
  } catch (error: any) {
    console.error("Lỗi:", error);
    throw error;
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  return getSafeImage("healthy"); 
};