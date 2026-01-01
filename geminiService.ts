import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
// 👇👇👇 DÁN KEY CỦA BẠN VÀO DƯỚI ĐÂY 👇👇👇
const API_KEY = "AIzaSyDf3VXB6lOd39RwRe0_ggr3ckBaqCXvUnU"; 
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash"; 

// --- KHO ẢNH CỐ ĐỊNH CHẤT LƯỢNG CAO (UNSPLASH) ---
// Không dùng random nữa -> Đảm bảo ảnh luôn đẹp và đúng chủ đề
const FIXED_IMAGES: Record<string, string> = {
    "smoothie": "https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=800&q=80", // Sinh tố xanh
    "fish": "https://images.unsplash.com/photo-1467003909585-2f8a7270028d?auto=format&fit=crop&w=800&q=80",     // Cá hồi nướng
    "chicken": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80",  // Ức gà salad
    "meat": "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=800&q=80",     // Bò bít tết
    "rice": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",     // Cơm/Gạo lứt
    "potato": "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?auto=format&fit=crop&w=800&q=80",   // Khoai lang
    "soup": "https://images.unsplash.com/photo-1547592166-23acbe3a624b?auto=format&fit=crop&w=800&q=80",      // Súp bí đỏ
    "salad": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",    // Salad tươi
    "oats": "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=800&q=80",     // Yến mạch
    "fruit": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=800&q=80",    // Trái cây
    "default": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80"   // Món ăn healthy chung
};

// --- THỰC ĐƠN DỰ PHÒNG (KHI GOOGLE BẬN) ---
const BACKUP_MENU_DATA = (day: number): any => {
    return {
        advice: "Hệ thống AI đang bận, đây là thực đơn mẫu chuẩn Y khoa.",
        meals: [{
            name: day <= 3 ? "Sinh Tố Xanh GutHealth (Thanh Lọc)" : "Cá Hồi Áp Chảo & Khoai Lang Tím",
            image_category: day <= 3 ? "smoothie" : "fish", // Sẽ lấy đúng ảnh trong kho FIXED_IMAGES
            ingredients: day <= 3 
                ? "Xà lách, Rau dền non, Bạc hà, Bơ, Táo, Cà chua, Chanh (Công thức chuẩn)" 
                : "Phi lê cá hồi, khoai lang tím hấp, măng tây, dầu oliu, tỏi.",
            calories: "450"
        }]
    };
};

const GUT_HEALTH_RULES = `
QUY TẮC DINH DƯỠNG "GUT HEALTH 21 NGÀY":
1. GIAI ĐOẠN 1 (Ngày 1-3): THANH LỌC. CẤM TINH BỘT. Bắt buộc Sinh Tố Xanh sáng.
2. GIAI ĐOẠN 2 (Ngày 4-21): PHỤC HỒI. Ăn tinh bột tốt.
`;
const SINH_TO_XANH_RECIPE = `1 cup xà lách, 1/2 cup rau dền, 1 cây bạc hà, 1/2 bơ, 1/2 táo, 1 cà chua, chanh.`;

function getSafeImage(category: string): string {
    const key = category.trim().toLowerCase();
    // Lấy ảnh trực tiếp từ kho Unsplash xịn, không random nữa
    return FIXED_IMAGES[key] || FIXED_IMAGES["default"];
}

function cleanGeminiResponse(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) return text.substring(firstBrace, lastBrace + 1);
  return text;
}

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
    ẢNH: BẮT BUỘC CHỌN 1 TRONG CÁC TỪ KHÓA SAU: "smoothie", "fish", "chicken", "meat", "rice", "potato", "soup", "salad", "oats", "fruit".
    JSON Mẫu: { "advice": "...", "meals": [{ "name": "...", "image_category": "...", "ingredients": "...", "calories": "..." }] }
  `;

  if (API_KEY.includes("DÁN_KEY") || API_KEY.length < 20) {
      return processResponseData(BACKUP_MENU_DATA(input.day_number), input);
  }

  try {
    const response = await fetch(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    if (!response.ok) {
        console.warn(`⚠️ Google bận/hết quota (${response.status}) -> Dùng thực đơn mẫu.`);
        return processResponseData(BACKUP_MENU_DATA(input.day_number), input);
    }

    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
       return parseGeminiResponseToSuggestionResponse(data.candidates[0].content.parts[0].text, input);
    }
    throw new Error("No data");

  } catch (error) {
    console.error("⚠️ Hệ thống AI bận, chuyển sang thực đơn mẫu.");
    return processResponseData(BACKUP_MENU_DATA(input.day_number), input);
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  return getSafeImage("healthy"); 
};