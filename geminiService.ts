import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
// 👇👇👇 DÁN KEY CỦA BẠN VÀO GIỮA HAI DẤU NGOẶC KÉP DƯỚI ĐÂY 👇👇👇
const API_KEY = "DÁN_KEY_CỦA_BẠN_VÀO_ĐÂY"; // <--- Xóa cái này đi và dán key AIza... vào
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// --- QUAY LẠI MODEL 2.5 (VÌ TÀI KHOẢN BẠN BẮT BUỘC DÙNG CÁI NÀY) ---
const MODEL_NAME = "gemini-2.5-flash"; 

// --- CÔNG THỨC SINH TỐ XANH (BẤT DI BẤT DỊCH) ---
const SINH_TO_XANH_RECIPE = `
- 1 cup xà lách thái nhỏ
- 1/2 cup rau dền non
- 1 cây bạc hà non (lấy cả thân)
- 1/2 trái bơ
- 1/2 quả táo
- 1 quả cà chua (bỏ vỏ và hạt)
- 2 muỗng canh nước cốt chanh tươi
- Chất tạo ngọt: Cỏ ngọt stevia / Đường mía nâu / Mật ong tự nhiên
- Nước lọc và đá viên
`;

// --- QUY TẮC GUT HEALTH ---
const GUT_HEALTH_RULES = `
QUY TẮC DINH DƯỠNG "GUT HEALTH 21 NGÀY":
1. GIAI ĐOẠN 1 (Ngày 1-3): THANH LỌC. CẤM TINH BỘT, SỮA BÒ. Bắt buộc Sinh Tố Xanh buổi sáng.
2. GIAI ĐOẠN 2 (Ngày 4-21): PHỤC HỒI. Ăn tinh bột tốt (khoai, gạo lứt).
3. DANH SÁCH CẤM: Thịt công nghiệp, đường, đồ chiên, lúa mì.
`;

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

// --- HÀM "KIÊN TRÌ" (TỰ ĐỘNG THỬ LẠI KHI GẶP LỖI 429) ---
async function fetchWithRetry(url: string, options: any, retries = 5, delay = 2000): Promise<any> {
    try {
        const response = await fetch(url, options);

        // Nếu gặp lỗi 429 (Hết hạn mức)
        if (response.status === 429) {
            if (retries > 0) {
                console.warn(`⚠️ Server bận (429). Đang chờ ${delay/1000} giây để thử lại... (Còn ${retries} lần)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchWithRetry(url, options, retries - 1, delay * 1.5); // Lần sau chờ lâu hơn chút
            } else {
                throw new Error("Hệ thống đang quá tải, vui lòng đợi 1 phút rồi thử lại.");
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Lỗi Google (${response.status}): ${errorText}`);
        }
        return response.json();

    } catch (error: any) {
        throw error;
    }
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
                kcal: parseInt(meal.calories) || 400, 
                protein_g: 20, fat_g: 10, carb_g: 40, fiber_g: 10, vegetables_g: 200, fruit_g: 50, added_sugar_g: 0, sodium_mg: 0 
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
      explanation_for_phase: input.day_number <= 3 ? "Giai đoạn 1: Thanh Lọc (Sinh Tố Xanh)" : "Giai đoạn 2: Phục Hồi & Tái tạo",
      suggested_meals: suggestedMeals,
    };
  } catch (e) {
    console.error("Lỗi JSON:", e);
    throw e;
  }
}

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  const promptText = `
    Bạn là Chuyên gia Dinh dưỡng GutHealth21.
    Khách hàng: ${input.user_profile?.demographics?.sex}, Mục tiêu: ${input.user_profile?.goals?.primary_goal}.
    NGÀY THỨ: ${input.day_number} (Giai đoạn ${input.day_number <= 3 ? "1" : "2"}).
    Bữa: ${input.meal_type}.

    QUY TẮC:
    ${GUT_HEALTH_RULES}

    NẾU BỮA SÁNG GIAI ĐOẠN 1:
    - BẮT BUỘC: "Sinh Tố Xanh GutHealth".
    - Công thức: ${SINH_TO_XANH_RECIPE}

    YÊU CẦU ẢNH:
    - Chọn nhóm: "smoothie", "fish", "chicken", "meat", "rice", "potato", "soup", "salad", "oats".
    
    JSON Mẫu: 
    { 
      "advice": "...", 
      "meals": [{ 
        "name": "Tên món", 
        "image_category": "smoothie", 
        "ingredients": "...", 
        "calories": "350" 
      }] 
    }
  `;

  // KIỂM TRA KEY TRƯỚC KHI CHẠY
  if (API_KEY.includes("DÁN_KEY") || API_KEY.length < 20) {
      alert("⚠️ BẠN CHƯA DÁN API KEY! Hãy mở file code và dán Key vào dòng số 4.");
      throw new Error("Chưa dán API Key");
  }

  try {
    // Dùng hàm fetchWithRetry thay cho fetch thường
    const data = await fetchWithRetry(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    
    if (data.candidates && data.candidates.length > 0) {
       return parseGeminiResponseToSuggestionResponse(data.candidates[0].content.parts[0].text, input);
    }
    throw new Error("Không có dữ liệu trả về.");
  } catch (error: any) {
    console.error("Lỗi cuối cùng:", error);
    throw error;
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  return getSafeImage("healthy"); 
};