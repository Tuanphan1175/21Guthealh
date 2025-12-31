import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { UserInput, SuggestionResponse, SuggestionMeal, UserProfile, ComputedTargets } from "./types";
import { SYSTEM_INSTRUCTION } from "./constants";

// Lấy API Key từ biến môi trường
const API_KEY = "AIzaSyDabUGaN9jxTgT6S8YHm8JRaTWaIgja-u0"; // API Key mới của bạn

if (!API_KEY) {
  throw new Error("Missing VITE_GEMINI_API_KEY environment variable.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Hàm giả định để tạo một SuggestionResponse từ văn bản
function parseGeminiResponseToSuggestionResponse(geminiText: string): SuggestionResponse {
  // Đây là một hàm giả định. Trong thực tế, bạn sẽ cần một cách phức tạp hơn
  // để phân tích cú pháp phản hồi của Gemini thành cấu trúc JSON mong muốn.
  // Ví dụ: bạn có thể yêu cầu Gemini trả về JSON trực tiếp trong prompt.

  // Để đơn giản, tôi sẽ tạo một phản hồi mẫu.
  const sampleMeal: SuggestionMeal = {
    recipe_id: "sample-meal-1",
    recipe_name: "Salad Rau Củ Quả Tươi Mát",
    short_description: "Salad giàu chất xơ với rau xanh, bơ và chanh, hỗ trợ tiêu hóa.",
    reason: "Món ăn này cung cấp nhiều chất xơ từ rau xanh, giúp cải thiện nhu động ruột và bơ cung cấp chất béo lành mạnh. Chanh giúp tăng cường vitamin C và hỗ trợ hấp thu.",
    how_it_supports_gut: "Chất xơ hòa tan và không hòa tan giúp nuôi dưỡng lợi khuẩn đường ruột và làm sạch hệ tiêu hóa. Bơ chứa chất béo không bão hòa đơn có lợi cho niêm mạc ruột.",
    fit_with_goal: "Phù hợp với mục tiêu cải thiện tiêu hóa và giảm đầy hơi.",
    main_ingredients_brief: "Rau xà lách, bơ, cà chua bi, dưa chuột, nước cốt chanh, dầu ô liu.",
    ingredients: [
      { name: "Rau xà lách", quantity: "100g" },
      { name: "Bơ", quantity: "1/2 quả" },
      { name: "Cà chua bi", quantity: "50g" },
      { name: "Dưa chuột", quantity: "50g" },
      { name: "Nước cốt chanh", quantity: "1 muỗng canh" },
      { name: "Dầu ô liu", quantity: "1 muỗng canh" },
    ],
    nutrition_estimate: {
      kcal: 250,
      protein_g: 5,
      fat_g: 20,
      carb_g: 15,
      fiber_g: 8,
      vegetables_g: 200,
      fruit_g: 0,
      added_sugar_g: 0,
      sodium_mg: 50,
    },
    fit_score: 90,
    warnings_or_notes: [],
    image_url: "https://images.unsplash.com/photo-1512621776951-a579fd9f8ed8?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  };

  const sampleResponse: SuggestionResponse = {
    day_number: 1,
    phase: 1,
    meal_type: "breakfast", // Hoặc bất kỳ loại bữa ăn nào
    explanation_for_phase: "Trong pha 1, chúng ta tập trung vào việc thanh lọc và giảm viêm, sử dụng các thực phẩm dễ tiêu hóa và giàu chất chống oxy hóa.",
    suggested_meals: [sampleMeal],
  };

  return sampleResponse;
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
        ${SYSTEM_INSTRUCTION}

        Hãy gợi ý một thực đơn chi tiết cho Bữa ${input.meal_type} của Ngày ${input.day_number}.
        Hồ sơ người dùng:
        - Giới tính: ${userProfile.demographics.sex === 'male' ? 'Nam' : 'Nữ'}
        - Tuổi: ${userProfile.demographics.age_years}
        - Chiều cao: ${userProfile.anthropometrics.height_cm} cm
        - Cân nặng: ${userProfile.anthropometrics.weight_kg} kg
        - Mức độ vận động: ${userProfile.activity.level}
        - Mục tiêu chính: ${userProfile.goals.primary_goal}.
        ${conditions}
        ${restrictions}
        ${avoidIngredients}
        ${personalNote}

        Mục tiêu dinh dưỡng cho bữa này:
        - Calo: ${targets.kcal} kcal
        - Đạm: ${targets.protein_g} g
        - Carb: ${targets.carb_g} g
        - Béo: ${targets.fat_g} g
        - Xơ: ${targets.fiber_g} g

        Cung cấp tên món ăn, mô tả ngắn, lý do tại sao món ăn này phù hợp với mục tiêu phục hồi đường ruột, các thành phần chính và ước tính dinh dưỡng chi tiết.
        Phản hồi của bạn nên là một đoạn văn bản mô tả thực đơn, sau đó tôi sẽ phân tích cú pháp nó.
      `;

      const result = await currentModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Phân tích cú pháp phản hồi văn bản thành cấu trúc SuggestionResponse
      // Đây là nơi bạn sẽ cần logic phức tạp hơn để chuyển đổi văn bản thành JSON.
      // Hiện tại, tôi sẽ sử dụng hàm giả định.
      return parseGeminiResponseToSuggestionResponse(text);

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