import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { UserInput, SuggestionResponse, SuggestionMeal, UserProfile } from "./types";
// import { SYSTEM_INSTRUCTION } from "./constants"; // Bỏ comment nếu bạn cần dùng biến này

// --- CẤU HÌNH API ---
// LƯU Ý: Để bảo mật, sau này bạn nên chuyển key này vào file .env (ví dụ: import.meta.env.VITE_GEMINI_API_KEY)
const API_KEY = "AIzaSyDabUGaN9jxTgT6S8YHm8JRaTWaIgja-u0"; 

if (!API_KEY) {
  throw new Error("Missing GEMINI API KEY.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// --- HÀM UTILS ---

/**
 * Hàm làm sạch chuỗi JSON trả về từ AI.
 * Loại bỏ các ký tự markdown như ```json hoặc ``` và khoảng trắng thừa.
 */
function cleanGeminiResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * Phân tích phản hồi từ Gemini và chuyển đổi thành SuggestionResponse
 */
function parseGeminiResponseToSuggestionResponse(geminiText: string, input: UserInput): SuggestionResponse {
  try {
    // BƯỚC QUAN TRỌNG: Làm sạch chuỗi trước khi parse
    const cleanedText = cleanGeminiResponse(geminiText);
    const parsedJson = JSON.parse(cleanedText);

    // Kiểm tra cấu trúc dữ liệu cơ bản
    if (!parsedJson.meals || !Array.isArray(parsedJson.meals)) {
      throw new Error("Dữ liệu trả về thiếu mảng 'meals'");
    }

    // Chuyển đổi định dạng JSON đơn giản thành SuggestionResponse đầy đủ
    const suggestedMeals: SuggestionMeal[] = parsedJson.meals.map((meal: any, index: number) => {
        // Xử lý an toàn cho calories
        let calVal = 0;
        if (meal.calories) {
            const calStr = String(meal.calories).replace(/[^0-9]/g, '');
            calVal = calStr ? parseInt(calStr) : 0;
        }

        return {
            recipe_id: `meal-${input.day_number}-${index}-${Date.now()}`, // Tạo ID unique hơn
            recipe_name: meal.name || "Món ăn chưa đặt tên",
            short_description: meal.ingredients || "",
            reason: parsedJson.advice || "Phù hợp với mục tiêu sức khỏe", 
            how_it_supports_gut: parsedJson.advice,
            fit_with_goal: "Hỗ trợ phục hồi đường ruột",
            main_ingredients_brief: meal.ingredients,
            // Tách nguyên liệu an toàn hơn
            ingredients: meal.ingredients 
                ? meal.ingredients.split(/,|;/).map((ing: string) => ({ name: ing.trim(), quantity: "Tùy khẩu phần" })) 
                : [],
            nutrition_estimate: {
                kcal: calVal,
                protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0,
                vegetables_g: 0, fruit_g: 0, added_sugar_g: 0, sodium_mg: 0,
            },
            fit_score: 90, 
            warnings_or_notes: [],
            image_url: "", // Sẽ được tạo sau
        };
    });

    return {
      day_number: input.day_number,
      phase: 1, 
      meal_type: input.meal_type,
      explanation_for_phase: parsedJson.advice || "Tập trung vào thực phẩm dễ tiêu hóa.",
      suggested_meals: suggestedMeals,
    };

  } catch (e) {
    console.error("Lỗi khi parse JSON từ Gemini:", e);
    console.log("Chuỗi văn bản gốc gây lỗi:", geminiText); // Log để debug
    throw new Error("Không thể đọc dữ liệu thực đơn từ AI. Vui lòng thử lại.");
  }
}

// --- MAIN SERVICE ---

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  // Cập nhật danh sách model: Ưu tiên Flash 1.5 (nhanh/rẻ), Fallback sang Pro 1.5 (thông minh hơn)
  const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro"]; 
  
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    console.log(`Đang gọi Model: ${modelName}...`);
    
    try {
      const currentModel = genAI.getGenerativeModel({ model: modelName });

      const userProfile = input.user_profile;
      
      if (!userProfile) {
        throw new Error("Thiếu thông tin User Profile.");
      }

      // Xây dựng context từ input
      const conditions = input.conditions?.length ? `Tình trạng: ${input.conditions.join(', ')}.` : '';
      const restrictions = input.dietary_restrictions?.length ? `Kiêng kỵ: ${input.dietary_restrictions.join(', ')}.` : '';
      const avoid = userProfile.dietary_preferences?.avoid_ingredients?.length ? `Tránh: ${userProfile.dietary_preferences.avoid_ingredients.join(', ')}.` : '';
      const note = userProfile.personal_note ? `Note: ${userProfile.personal_note}.` : '';

      // Định nghĩa cấu trúc JSON mong muốn
      const jsonStructure = `{
        "advice": "Lời khuyên dinh dưỡng ngắn gọn (1-2 câu) cho ngày hôm nay.",
        "meals": [
          { "name": "Tên món Sáng", "ingredients": "Nguyên liệu chính", "calories": "300 kcal" },
          { "name": "Tên món Trưa", "ingredients": "Nguyên liệu chính", "calories": "500 kcal" },
          { "name": "Tên món Tối", "ingredients": "Nguyên liệu chính", "calories": "400 kcal" },
          { "name": "Tên món Phụ", "ingredients": "Nguyên liệu chính", "calories": "150 kcal" }
        ]
      }`;

      const prompt = `
        Đóng vai Chuyên gia dinh dưỡng "Bác sĩ chính mình".
        Hãy thiết kế thực đơn NGÀY ${input.day_number} cho người dùng sau:
        - Giới tính: ${userProfile.demographics.sex === 'male' ? 'Nam' : 'Nữ'}, ${userProfile.demographics.age_years} tuổi.
        - Cân nặng: ${userProfile.anthropometrics.weight_kg} kg.
        - Mục tiêu: ${userProfile.goals.primary_goal}.
        ${conditions} ${restrictions} ${avoid} ${note}

        Yêu cầu đặc biệt:
        1. Thực đơn phải gồm chính xác 4 phần tử: Bữa Sáng, Bữa Trưa, Bữa Tối, Bữa Phụ.
        2. Ưu tiên món ăn Việt Nam, dễ nấu, tốt cho đường ruột (Metabolic Health).
        3. CHỈ TRẢ VỀ JSON THUẦN (raw json), không giải thích thêm, theo cấu trúc:
        ${jsonStructure}
      `;

      const result = await currentModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Xử lý kết quả
      return parseGeminiResponseToSuggestionResponse(text, input);

    } catch (error) {
      console.warn(`Lỗi với model ${modelName}:`, error);
      lastError = error;
      // Thử model tiếp theo trong vòng lặp
    }
  }

  // Nếu chạy hết vòng lặp mà vẫn lỗi
  throw new Error(`Hệ thống đang bận. Vui lòng thử lại sau giây lát. (Chi tiết: ${lastError?.message})`);
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  // Placeholder hiện tại
  return "[https://via.placeholder.com/400x300?text=Dang+Tao+Anh](https://via.placeholder.com/400x300?text=Dang+Tao+Anh)..."; 
};