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
    const suggestedMeals: SuggestionMeal[] = parsedJson.meals.map((meal: any) => {
      const mealName = meal.name || "Món ăn dinh dưỡng"; // Đảm bảo có tên món

      return {
        recipe_id: mealName.replace(/\s+/g, '-').toLowerCase(), // Tạo ID đơn giản
        recipe_name: mealName,
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
        // Tạo đường dẫn ảnh động dựa trên tên món ăn.
        // Sử dụng dịch vụ placehold.co để tạo ảnh nhanh, đẹp, hỗ trợ tiếng Việt.
        image_url: `https://placehold.co/600x400/EF4444/FFFFFF/png?text=${encodeURIComponent(mealName)}&font=roboto`,
      };
    });

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

      const jsonFormat = `{
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
        }`;

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
        
        Trả về kết quả dưới dạng JSON thuần (không có markdown \`\`\`json) theo cấu trúc sau:
        ${jsonFormat}
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
  try {
    const response = await fetch('/api/generate-meal-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mealName: meal.recipe_name, description: meal.short_description }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to generate image from API.');
    }

    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error('Error calling generate-meal-image API:', error);
    return "https://via.placeholder.com/400x300?text=Meal+Image+Error"; // Fallback image on API error
  }
};

// Export giả để buộc Vite tái biên dịch module
export const __dummyExport = {};