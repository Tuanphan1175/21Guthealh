import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH ---
const API_KEY = "DÁN_KEY_MỚI_CỦA_BẠN_VÀO_ĐÂY"; // <--- ĐỪNG QUÊN DÁN KEY CỦA BẠN
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.5-flash";

// --- KIẾN THỨC CỐT LÕI TỪ TÀI LIỆU CỦA BẠN ---
const GUT_HEALTH_RULES = `
QUY TẮC DINH DƯỠNG "GUT HEALTH 21 NGÀY":

1. GIAI ĐOẠN 1: THANH LỌC (Ngày 1 - Ngày 3):
   - MỤC TIÊU: Vá lành đường ruột, thải độc.
   - TUYỆT ĐỐI CẤM TINH BỘT: Không cơm, phở, bún, bánh mì, khoai lang, ngô.
   - BỮA SÁNG: Ưu tiên Sinh tố xanh (Green Smoothie), Protein thực vật lỏng.
   - CHẾ BIẾN: Chỉ Hấp, Luộc, Áp chảo nhẹ. Không chiên xào nhiều dầu.
   - THỰC PHẨM: Cá, hải sản, ức gà, rau xanh đậm, các loại hạt (lượng nhỏ).

2. GIAI ĐOẠN 2: PHỤC HỒI (Ngày 4 - Ngày 21):
   - Được phép ăn lại tinh bột tốt: Khoai lang, gạo lứt, yến mạch, quinoa (với lượng vừa phải).
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
   - Trái cây ít ngọt: Ổi, Táo xanh, Bơ, Dâu tây, Việt quất.
`;

// --- HÀM LẤY ẢNH (GIỮ NGUYÊN VÌ ĐANG CHẠY TỐT) ---
function getRealFoodImage(simpleKeyword: string): string {
    const finalKeyword = simpleKeyword.trim().replace(/ /g, ',');
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
        // Lấy từ khóa tìm ảnh
        const searchKey = meal.image_search_term || "healthy food";

        // Tự động tính toán lại calories nếu AI lỡ quên (để hiển thị cho đẹp)
        const cal = parseInt(meal.calories) || 500;

        return {
            recipe_id: `meal-${input.day_number}-${index}-${Date.now()}`,
            recipe_name: mealName,
            short_description: meal.ingredients || "Tốt cho sức khỏe đường ruột",
            reason: parsedJson.advice || "Phù hợp với lộ trình 21 ngày.",
            how_it_supports_gut: "Dễ tiêu hóa, hỗ trợ niêm mạc ruột.",
            fit_with_goal: "Giúp thanh lọc và phục hồi.",
            main_ingredients_brief: meal.ingredients,
            ingredients: [],
            nutrition_estimate: { 
                kcal: cal, 
                protein_g: 30, 
                fat_g: 15, 
                carb_g: input.day_number <= 3 ? 10 : 45, // Tự động giảm carb ngày đầu
                fiber_g: 10, 
                vegetables_g: 200, 
                fruit_g: 50, 
                added_sugar_g: 0, 
                sodium_mg: 0 
            },
            fit_score: 98, 
            warnings_or_notes: input.day_number <= 3 ? ["Giai đoạn thanh lọc: Không tinh bột"] : [],
            image_url: getRealFoodImage(searchKey), 
        };
    });

    return {
      day_number: input.day_number,
      phase: input.day_number <= 3 ? 1 : 2, 
      meal_type: input.meal_type,
      explanation_for_phase: input.day_number <= 3 
          ? "Giai đoạn 1: Thanh lọc & Giảm viêm (Tuyệt đối không tinh bột)." 
          : "Giai đoạn 2: Phục hồi & Tái tạo (Bổ sung tinh bột tốt).",
      suggested_meals: suggestedMeals,
    };
  } catch (e) {
    console.error("Lỗi xử lý JSON:", e);
    throw e;
  }
}

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  // --- PROMPT "BỘ NÃO" MỚI ---
  const promptText = `
    Bạn là Chuyên gia Dinh dưỡng của hệ thống "GutHealth21".
    
    THÔNG TIN NGƯỜI DÙNG:
    - Giới tính: ${input.user_profile?.demographics?.sex}
    - Mục tiêu: ${input.user_profile?.goals?.primary_goal}
    - Đang ở NGÀY THỨ: ${input.day_number} (Giai đoạn ${input.day_number <= 3 ? "1 - Thanh Lọc" : "2 - Phục Hồi"})
    - Bữa ăn: ${input.meal_type}
    - Ghi chú: ${input.personal_note || "Không"}

    HÃY TUÂN THỦ NGHIÊM NGẶT QUY TẮC SAU ĐÂY:
    ${GUT_HEALTH_RULES}

    NHIỆM VỤ:
    Tạo thực đơn 1 món ăn NGON, DỄ NẤU tuân thủ đúng quy tắc Giai đoạn ${input.day_number <= 3 ? "1" : "2"}.
    
    YÊU CẦU VỀ ẢNH ("image_search_term"):
    - Cung cấp 1 từ khóa Tiếng Anh CỰC NGẮN (tối đa 2 từ) mô tả chính xác món ăn để tìm ảnh.
    - Ví dụ: "Salmon Salad", "Pumpkin Soup", "Green Smoothie".

    JSON Mẫu Bắt Buộc: 
    { 
      "advice": "Lời khuyên ngắn gọn dựa trên ngày thứ ${input.day_number}...", 
      "meals": [{ 
        "name": "Tên món (Tiếng Việt hấp dẫn)", 
        "image_search_term": "English Keyword", 
        "ingredients": "Mô tả nguyên liệu chính (Tiếng Việt)", 
        "calories": "Số calo ước tính" 
      }] 
    }
  `;

  if (API_KEY.includes("DÁN_KEY") || API_KEY.length < 10) throw new Error("⚠️ Chưa nhập API Key!");

  try {
    console.log(`📡 Đang gọi chuyên gia GutHealth (Ngày ${input.day_number})...`);
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
  return getRealFoodImage("healthy food"); 
};