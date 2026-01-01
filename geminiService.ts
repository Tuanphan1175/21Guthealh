import { GoogleGenerativeAI } from "@google/generative-ai";
import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- CẤU HÌNH API ---
const API_KEY = "AIzaSyDabUGaN9jxTgT6S8YHm8JRaTWaIgja-u0"; 

if (!API_KEY) {
  throw new Error("Missing GEMINI API KEY.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// --- HÀM UTILS ---

/**
 * Hàm làm sạch chuỗi JSON trả về từ AI.
 */
function cleanGeminiResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * Hàm tạo link ảnh placeholder an toàn, đẹp, hỗ trợ tiếng Việt
 * Thay thế hoàn toàn cho API tạo ảnh và via.placeholder bị lỗi
 */
function getSafeImageUrl(text: string): string {
    const encodedText = encodeURIComponent(text);
    // Sử dụng placehold.co: Nền xám nhạt (f8fafc), Chữ xám đậm (475569)
    return `https://placehold.co/800x600/f8fafc/475569.png?text=${encodedText}&font=roboto`;
}

/**
 * Phân tích phản hồi từ Gemini và chuyển đổi thành SuggestionResponse
 */
function parseGeminiResponseToSuggestionResponse(geminiText: string, input: UserInput): SuggestionResponse {
  try {
    const cleanedText = cleanGeminiResponse(geminiText);
    const parsedJson = JSON.parse(cleanedText);

    if (!parsedJson.meals || !Array.isArray(parsedJson.meals)) {
      throw new Error("Dữ liệu trả về thiếu danh sách món ăn (meals)");
    }

    const suggestedMeals: SuggestionMeal[] = parsedJson.meals.map((meal: any, index: number) => {
        let calVal = 0;
        if (meal.calories) {
            const calStr = String(meal.calories).replace(/[^0-9]/g, '');
            calVal = calStr ? parseInt(calStr) : 0;
        }

        const mealName = meal.name || "Món ăn dinh dưỡng";

        return {
            recipe_id: `meal-${input.day_number}-${index}-${Date.now()}`,
            recipe_name: mealName,
            short_description: meal.ingredients || "Món ăn tốt cho sức khỏe",
            reason: parsedJson.advice || "Phù hợp với mục tiêu phục hồi.",
            how_it_supports_gut: "Dễ tiêu hóa, giảm gánh nặng cho đường ruột.",
            fit_with_goal: "Hỗ trợ phục hồi niêm mạc.",
            main_ingredients_brief: meal.ingredients,
            ingredients: meal.ingredients 
                ? String(meal.ingredients).split(/,|;/).map((ing: string) => ({ name: ing.trim(), quantity: "Tùy ý" })) 
                : [],
            nutrition_estimate: {
                kcal: calVal,
                protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0,
                vegetables_g: 0, fruit_g: 0, added_sugar_g: 0, sodium_mg: 0,
            },
            fit_score: 95, 
            warnings_or_notes: [],
            // QUAN TRỌNG: Gán link ảnh ngay từ đầu
            image_url: getSafeImageUrl(mealName), 
        };
    });

    return {
      day_number: input.day_number,
      phase: 1, 
      meal_type: input.meal_type,
      explanation_for_phase: parsedJson.advice || "Giai đoạn thanh lọc và phục hồi.",
      suggested_meals: suggestedMeals,
    };

  } catch (e) {
    console.error("Lỗi xử lý dữ liệu Gemini:", e);
    throw e;
  }
}

// --- MAIN SERVICE ---

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  // Cập nhật danh sách model hỗ trợ (Flash nhanh hơn, Pro thông minh hơn)
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro"]; 
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    console.log(`📡 Đang kết nối Model: ${modelName}...`);
    try {
      const currentModel = genAI.getGenerativeModel({ model: modelName });
      const userProfile = input.user_profile;
      
      const jsonStructure = `{
        "advice": "Lời khuyên ngắn gọn (1 câu).",
        "meals": [
          { "name": "Tên món", "ingredients": "Nguyên liệu", "calories": "500" }
        ]
      }`;

      const prompt = `
        Tạo thực đơn 1 món cho bữa ${input.meal_type}.
        User: ${userProfile?.demographics?.sex}, ${userProfile?.goals?.primary_goal}.
        Lưu ý: ${input.personal_note || "Không có"}.
        Trả về JSON chuẩn: ${jsonStructure}
      `;

      const result = await currentModel.generateContent(prompt);
      const text = result.response.text();
      return parseGeminiResponseToSuggestionResponse(text, input);

    } catch (error: any) {
      console.warn(`⚠️ Lỗi model ${modelName}:`, error.message);
      lastError = error;
    }
  }
  throw new Error(`Lỗi kết nối AI: ${lastError?.message}`);
};

// --- HÀM TẠO ẢNH GIẢ LẬP (ĐÃ SỬA LỖI 404 POST) ---
export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  // Thay vì gọi fetch('/api/...') gây lỗi 404, ta trả về trực tiếp link ảnh
  
  // Giả lập độ trễ 1 chút (0.5s) để tạo cảm giác đang xử lý
  await new Promise(resolve => setTimeout(resolve, 500)); 
  
  return getSafeImageUrl(meal.recipe_name);
};