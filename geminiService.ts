import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
const API_KEY = "AIzaSyDf3VXB6lOd39RwRe0_ggr3ckBaqCXvUnU"; // <--- DÁN KEY CỦA BẠN
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash";

// --- BỘ KIẾN THỨC DINH DƯỠNG (ĐÃ NẠP) ---
const GUT_HEALTH_RULES = `
QUY TẮC DINH DƯỠNG "GUT HEALTH 21 NGÀY":
// --- KIẾN THỨC CỐT LÕI TỪ TÀI LIỆU CỦA BẠN ---
const GUT_HEALTH_RULES = `
QUY TẮC DINH DƯỠNG "GUT HEALTH 21 NGÀY":
1. GIAI ĐOẠN 1: THANH LỌC (Ngày 1 - Ngày 3):
   - MỤC TIÊU: Vá lành đường ruột, thải độc.
   - TUYỆT ĐỐI CẤM TINH BỘT: Không cơm, khoai lang, phở, bún, hủ tiếu, bánh mì, ngô.
   - BỮA SÁNG: Ưu tiên Sinh tố xanh (Green Smoothie), Protein thực vật lỏng.
   - CHẾ BIẾN: Chỉ Hấp, Luộc, Áp chảo nhẹ. Không chiên xào nhiều dầu.
   - THỰC PHẨM: Cá, hải sản, ức gà, rau xanh đậm, các loại hạt (lượng nhỏ).

2. GIAI ĐOẠN 2: PHỤC HỒI (Ngày 4 - Ngày 21):
   - Được phép ăn lại tinh bột tốt: Khoai lang, khoai từ , khoai sọ, gạo trắng.
   - Đa dạng đạm: Cá hồi, gà thả vườn, hải sản.
   - Tăng cường rau củ 5 màu sắc.

3. DANH SÁCH "ĐÈN ĐỎ" (CẤM TRONG MỌI GIAI ĐOẠN):
   - Đường tinh luyện, bánh kẹo ngọt, nước ngọt có ga.
   - Sữa bò và chế phẩm từ sữa bò (trừ bơ Ghee).
   - Thịt đỏ nuôi công nghiệp (Heo, Bò công nghiệp).
   - Lúa mì, Bắp (Ngô), Đậu nành (trừ loại lên men như Miso/Tempeh/Natto).
   - Dầu thực vật công nghiệp (Dầu nành, dầu hướng dương).
   - Đồ hộp, đồ chế biến sẵn (Xúc xích, thịt nguội).

4. DANH SÁCH "ĐÈN XANH" (KHUYẾN KHÍCH):
   - Chất béo tốt: Dầu Oliu, Dầu dừa, Quả bơ, Các loại hạt (Mắc ca, Óc chó, Hạnh nhân).
   - Đạm sạch: Cá hồi, Cá thu, Tôm, Gà thả vườn, Trứng gà ta.
   - Rau củ: Súp lơ, Cải xoăn (Kale), Rau Bina, Cà rốt, Củ dền.
   - Trái cây ít ngọt: Ổi, Táo xanh, Bơ, Xoài xanh, Đu đủ xanh, Dâu tây, Việt quất.
`;

// --- TỪ ĐIỂN ẢNH AN TOÀN (MAPPING) ---
// Đây là danh sách các từ khóa "Bất tử" - Không bao giờ ra mèo
const SAFE_IMAGES: Record<string, string> = {
    "fish": "grilled,fish,food",          // Nhóm Cá
    "chicken": "roasted,chicken,breast",  // Nhóm Gà
    "meat": "beef,steak,food",            // Nhóm Thịt
    "rice": "fried,rice,vegetable",       // Nhóm Cơm
    "potato": "sweet,potato,food",        // Nhóm Khoai (cho Giai đoạn 2)
    "noodle": "noodle,soup,bowl",         // Nhóm Bún/Phở (nếu có)
    "salad": "fresh,salad,plate",         // Nhóm Salad
    "smoothie": "green,smoothie,glass",   // Nhóm Sinh tố
    "soup": "pumpkin,soup,bowl",          // Nhóm Súp
    "fruit": "fruit,platter,fresh",       // Nhóm Trái cây
    "oats": "oatmeal,bowl,fruit",         // Nhóm Yến mạch
    "default": "healthy,food,dish"        // Mặc định
};

// --- HÀM LẤY ẢNH THEO DANH MỤC ---
function getSafeImage(category: string): string {
    // Chuẩn hóa category
    const key = category.trim().toLowerCase();
    
    // Tra cứu trong từ điển. Nếu AI đưa từ lạ, dùng 'default'
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
        
        // Lấy Category từ AI (Ví dụ: "fish", "potato")
        const category = meal.image_category || "default";

        return {
            recipe_id: `meal-${input.day_number}-${index}-${Date.now()}`,
            recipe_name: mealName,
            short_description: meal.ingredients || "Tốt cho sức khỏe",
            reason: parsedJson.advice || "Phù hợp lộ trình.",
            how_it_supports_gut: "Dễ tiêu hóa, phục hồi niêm mạc.",
            fit_with_goal: "Đúng chuẩn 21 Ngày.",
            main_ingredients_brief: meal.ingredients,
            ingredients: [],
            nutrition_estimate: { 
                kcal: parseInt(meal.calories) || 500, 
                protein_g: 30, fat_g: 10, carb_g: 50, fiber_g: 10, vegetables_g: 100, fruit_g: 50, added_sugar_g: 0, sodium_mg: 0 
            },
            fit_score: 98, 
            warnings_or_notes: [],
            // Gọi hàm lấy ảnh an toàn
            image_url: getSafeImage(category), 
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
    - Hãy phân loại món ăn vào ĐÚNG 1 TRONG CÁC NHÓM SAU (trường "image_category"):
    - Danh sách nhóm: "fish", "chicken", "meat", "rice", "potato", "salad", "soup", "smoothie", "oats", "fruit".
    - Ví dụ: "Cá hồi hấp khoai lang" -> Chọn nhóm "fish" (hoặc "potato"). Ưu tiên món chính.
    
    JSON Mẫu: 
    { 
      "advice": "Lời khuyên...", 
      "meals": [{ 
        "name": "Tên món (Việt)", 
        "image_category": "fish", 
        "ingredients": "...", 
        "calories": "..." 
      }] 
    }
  `;

  if (API_KEY.includes("DÁN_KEY") || API_KEY.length < 10) throw new Error("⚠️ Chưa nhập API Key!");

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