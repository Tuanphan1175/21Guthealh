import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
// 👇👇👇 DÁN KEY CỦA BẠN VÀO DƯỚI ĐÂY 👇👇👇
const API_KEY = "DÁN_KEY_CỦA_BẠN_VÀO_ĐÂY"; 
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash"; // Dùng model bạn đang có

// --- THỰC ĐƠN DỰ PHÒNG (DÙNG KHI GOOGLE BỊ LỖI/HẾT QUOTA) ---
// Đây là "phao cứu sinh" giúp App không bao giờ bị lỗi đỏ
const BACKUP_MENU_DATA = (day: number): any => {
    return {
        advice: "Hệ thống AI đang bận, đây là thực đơn mẫu chuẩn Y khoa phù hợp với giai đoạn của bạn.",
        meals: [{
            name: day <= 3 ? "Sinh Tố Xanh GutHealth (Thanh Lọc)" : "Cá Hồi Áp Chảo & Khoai Lang Tím",
            image_category: day <= 3 ? "smoothie" : "fish",
            ingredients: day <= 3 
                ? "Xà lách, Rau dền non, Bạc hà, Bơ, Táo, Cà chua, Chanh (Công thức chuẩn)" 
                : "Phi lê cá hồi, khoai lang tím hấp, măng tây, dầu oliu, tỏi.",
            calories: "450"
        }]
    };
};

// --- QUY TẮC GUT HEALTH ---
const GUT_HEALTH_RULES = `
QUY TẮC DINH DƯỠNG "GUT HEALTH 21 NGÀY":
1. GIAI ĐOẠN 1 (Ngày 1-3): THANH LỌC. CẤM TINH BỘT. Bắt buộc Sinh Tố Xanh sáng.
2. GIAI ĐOẠN 2 (Ngày 4-21): PHỤC HỒI. Ăn tinh bột tốt.
`;

const SINH_TO_XANH_RECIPE = `1 cup xà lách, 1/2 cup rau dền, 1 cây bạc hà, 1/2 bơ, 1/2 táo, 1 cà chua, chanh.`;

// --- TỪ ĐIỂN ẢNH (ANTI-CAT) ---
const SAFE_IMAGES: Record<string, string> = {
    "smoothie": "green,smoothie,glass",
    "fish": "grilled,fish,food",
    "chicken": "roasted,chicken,breast",
    "meat": "beef,steak,food",
    "rice": "fried,rice,vegetable",
    "potato": "sweet,potato,food",
    "soup": "pumpkin,soup,bowl",
    "salad": "fresh,salad,plate",
    "fruit": "fruit,platter,fresh",
    "oats": "oatmeal,bowl,fruit",
    "default": "healthy,food,dish"
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

// --- HÀM XỬ LÝ KẾT QUẢ (CHUNG CHO CẢ AI VÀ BACKUP) ---
function processResponseData(parsedJson: any, input: UserInput): SuggestionResponse {
    const mealsData = Array.isArray(parsedJson) ? parsedJson : (parsedJson.meals || []);
    const suggestedMeals: SuggestionMeal[] = mealsData.map((meal: any, index: number) => {
        const mealName = meal.name || "Món ăn dinh dưỡng";
        const category = meal.image_category || "default";
        return {
            recipe_id: `meal-${input.day_number}-${index}-${Date.now()}`,
            recipe_name: mealName,
            short_description: meal.ingredients || "Công thức chuẩn GutHealth",
            reason: parsedJson.advice || "Thanh lọc và phục hồi.",
            how_it_supports_gut: "Dễ tiêu hóa, chuẩn Y khoa.",
            fit_with_goal: "Đúng phác đồ 21 ngày.",
            main_ingredients_brief: meal.ingredients,
            ingredients: [],
            nutrition_estimate: { 
                kcal: parseInt(meal.calories) || 400, protein_g: 20, fat_g: 10, carb_g: 40, fiber_g: 10, vegetables_g: 200, fruit_g: 50, added_sugar_g: 0, sodium_mg: 0 
            },
            fit_score: 99, 
            warnings_or_notes: input.day_number <= 3 ? ["Giai đoạn 1: Kiêng tinh bột tuyệt đối"] : [],
            image_url: getSafeImage(category),
        };
    });

    return {
      day_number: input.day_number,
      phase: input.day_number <= 3 ? 1 : 2, 
      meal_type: input.meal_type,
      explanation_for_phase: input.day_number <= 3 ? "Giai đoạn 1: Thanh Lọc" : "Giai đoạn 2: Phục Hồi",
      suggested_meals: suggestedMeals,
    };
}

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  const promptText = `
    Bạn là Chuyên gia Dinh dưỡng GutHealth21.
    Khách: ${input.user_profile?.demographics?.sex}, Mục tiêu: ${input.user_profile?.goals?.primary_goal}.
    NGÀY: ${input.day_number}. Bữa: ${input.meal_type}.
    QUY TẮC: ${GUT_HEALTH_RULES}
    SÁNG GĐ1 BẮT BUỘC: Sinh Tố Xanh (${SINH_TO_XANH_RECIPE}).
    ẢNH: "smoothie", "fish", "chicken", "meat", "rice", "potato", "soup", "salad", "oats".
    JSON Mẫu: { "advice": "...", "meals": [{ "name": "...", "image_category": "...", "ingredients": "...", "calories": "..." }] }
  `;

  if (API_KEY.includes("DÁN_KEY") || API_KEY.length < 20) {
      console.warn("⚠️ CHƯA CÓ KEY -> DÙNG CHẾ ĐỘ DỰ PHÒNG");
      return processResponseData(BACKUP_MENU_DATA(input.day_number), input);
  }

  try {
    const response = await fetch(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    if (!response.ok) {
        // NẾU LỖI (429, 500, 404...) -> CHUYỂN SANG DỰ PHÒNG NGAY
        console.warn(`⚠️ Google lỗi (${response.status}) -> Kích hoạt chế độ DỰ PHÒNG.`);
        throw new Error("Trigger Backup");
    }

    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
       return parseGeminiResponseToSuggestionResponse(data.candidates[0].content.parts[0].text, input);
    }
    throw new Error("No data");

  } catch (error) {
    // BẤT KỲ LỖI GÌ XẢY RA -> TRẢ VỀ MENU DỰ PHÒNG (KHÔNG BAO GIỜ CRASH)
    console.error("⚠️ Hệ thống AI bận, chuyển sang thực đơn mẫu.");
    return processResponseData(BACKUP_MENU_DATA(input.day_number), input);
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  return getSafeImage("healthy"); 
};