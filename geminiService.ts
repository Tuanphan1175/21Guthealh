import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { UserInput, SuggestionResponse, SuggestionMeal, UserProfile, ComputedTargets } from "./types";
import { SYSTEM_INSTRUCTION } from "./constants";

// Lấy API Key từ biến môi trường
const API_KEY = "AIzaSyDabUGaN9jxTgT6S8YHm8JRaTWaIgja-u0"; // API Key của bạn

if (!API_KEY) {
  throw new Error("Missing VITE_GEMINI_API_KEY environment variable.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Hàm để phân tích cú pháp phản hồi JSON từ Gemini
function parseGeminiResponseToSuggestionResponse(geminiText: string, input: UserInput): SuggestionResponse {
  try {
    const parsedJson = JSON.parse(geminiText);

    // Chuyển đổi định dạng JSON đơn giản thành SuggestionResponse đầy đủ
    const suggestedMeals: SuggestionMeal[] = parsedJson.meals.map((meal: any) => ({
      recipe_id: meal.name.replace(/\s+/g, '-').toLowerCase(), // Tạo ID đơn giản
      recipe_name: meal.name,
      short_description: meal.ingredients,
      reason: parsedJson.advice, // Sử dụng advice làm lý do chung
      how_it_supports_gut: parsedJson.advice,
      fit_with_goal: parsedJson.advice,
      main_ingredients_brief: meal.ingredients,
      ingredients: meal.ingredients.split(', ').map((ing: string) => ({ name: ing.trim(), quantity: "" })), // Tách nguyên liệu
      nutrition_estimate: {
        kcal: parseInt(meal.calories.replace(/[^0-9]/g, '')) || 0,
        protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0,
        vegetables_g: 0, fruit_g: 0, added_sugar_g: 0, sodium_mg: 0,
      },
      fit_score: 80, // Điểm mặc định
      warnings_or_notes: [],
      image_url: "", // Sẽ được tạo bởi RecipeCard
    }));

    return {
      day_number: input.day_number,
      phase: 1, // Giả định Pha 1
      meal_type: input.meal_type,
      explanation_for_phase: parsedJson.advice,
      suggested_meals: suggestedMeals,
    };
  } catch (e) {
    console.error("Lỗi khi phân tích cú pháp phản hồi Gemini thành JSON:", e);
    throw new Error("Phản hồi từ AI không đúng định dạng. Vui lòng thử lại.");
  }
}

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  const modelsToTry = ["gemini-2.5-flash", "gemini-pro"]; // Đã thay đổi tên model ưu tiên
  let currentModel: GenerativeModel | null = null;
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    console.log(`Model: ${modelName} | Key: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`); // Log để kiểm tra
    try {
      currentModel = genAI.getGenerativeModel({ model: modelName });

      const userProfile = input.user_profile;
      const targets = input.targets;

      if (!userProfile || !targets) {
        throw new Error("Missing user profile or nutritional targets for Gemini API call.");
      }

      const conditions = input.conditions.length > 0 ? `Tình trạng sức khỏe: ${input.conditions.join(', ')}.` : '';
      const restrictions = input.dietary_restrictions.length > 0 ? `Hạn chế ăn uống: ${input.dietary_restrictions.join(', ')}.` : '';
      const avoidIngredients = userProfile.dietary_preferences.avoid_ingredients.length > 0 ? `Tránh các nguyên liệu: ${userProfile.dietary_preferences.avoid_ingredients.join(', ')}.` : '';
      const personalNote = userProfile.personal_note ? `Lưu ý cá nhân: ${userProfile.personal_note}.` : '';

      const prompt = `
        Bạn là chuyên gia dinh dưỡng cao cấp cho chương trình 21 ngày phục hồi đường ruột.
        Dựa trên hồ sơ người dùng sau:
        - Giới tính: ${userProfile.demographics.sex === 'male' ? 'Nam' : 'Nữ'}
        - Tuổi: ${userProfile.demographics.age_years}
        - Cân nặng: ${userProfile.anthropometrics.weight_kg} kg
        - Mục tiêu chính: ${userProfile.goals.primary_goal}.
        ${conditions}
        ${restrictions}
        ${avoidIngredients}
        ${personalNote}

        Hãy tạo một thực đơn cho Ngày 1, bao gồm 3 bữa chính (Sáng, Trưa, Tối) và 1 bữa phụ.
        BẮT BUỘC tuân thủ NGHIÊM NGẶT danh sách thực phẩm "KHÔNG NÊN ĂN" (CẤM) và "QUY ĐỊNH ĐẶC BIỆT CỦA CHƯƠNG TRÌNH" đã được cung cấp trong SYSTEM_INSTRUCTION.
        
        Trả về kết quả dưới dạng JSON thuần (không có markdown ```json) theo cấu trúc sau:
        {
          "advice": "Lời khuyên ngắn gọn cho thực đơn này dựa trên hồ sơ người dùng và mục tiêu phục hồi đường ruột.",
          "meals": [
            {
              "name": "Tên món ăn bữa sáng",
              "ingredients": "Nguyên liệu chính (ví dụ: Yến mạch, hạt chia, sữa hạt)",
              "calories": "Số calo ước tính (ví dụ: 300 kcal)"
            },
            {
              "name": "Tên món ăn bữa trưa",
              "ingredients": "Nguyên liệu chính",
              "calories": "Số calo ước tính"
            },
            {
              "name": "Tên món ăn bữa tối",
              "ingredients": "Nguyên liệu chính",
              "calories": "Số calo ước tính"
            },
            {
              "name": "Tên món ăn bữa phụ",
              "ingredients": "Nguyên liệu chính",
              "calories": "Số calo ước tính"
            }
          ]
        }
      `;

      const result = await currentModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Phân tích cú pháp phản hồi văn bản thành cấu trúc SuggestionResponse
      return parseGeminiResponseToSuggestionResponse(text, input);

    } catch (error) {
      console.error(`Lỗi khi gọi API Gemini với model ${modelName}:`, error);
      lastError = error;
      // Tiếp tục thử model tiếp theo
    }
  }

  // Nếu tất cả các model đều thất bại
  throw new Error(`Không thể tạo thực đơn từ Gemini sau khi thử tất cả các model. Lỗi cuối cùng: ${lastError?.message || "Không rõ lỗi."}`);
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  // Giữ nguyên hàm này nếu bạn vẫn muốn sử dụng Edge Function cho việc tạo ảnh
  // hoặc bạn có thể thay đổi để gọi một API tạo ảnh khác.
  // Hiện tại, tôi sẽ để nó như cũ.
  return "https://via.placeholder.com/400x300?text=Meal+Image"; // Placeholder image
};