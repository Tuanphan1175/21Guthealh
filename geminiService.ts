import { GoogleGenerativeAI } from "@google/generative-ai";
import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// --- QUAN TRỌNG: DÁN API KEY MỚI CỦA BẠN VÀO DÒNG DƯỚI ---
const API_KEY = "DÁN_KEY_MỚI_CỦA_BẠN_VÀO_ĐÂY"; 
// Ví dụ: const API_KEY = "AIzaSyDxxxxxxxxxxxx...";

if (!API_KEY || API_KEY.includes("DÁN_KEY")) {
  console.error("CHƯA NHẬP API KEY MỚI!");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// --- HÀM TẠO ẢNH GIẢ LẬP AN TOÀN (Sửa lỗi via.placeholder) ---
function getSafeImageUrl(text: string): string {
    const encodedText = encodeURIComponent(text);
    // Dùng placehold.co: Server cực nhanh, không bị chặn
    return `https://placehold.co/800x600/f8fafc/475569.png?text=${encodedText}&font=roboto`;
}

function cleanGeminiResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

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
            how_it_supports_gut: "Dễ tiêu hóa.",
            fit_with_goal: "Hỗ trợ phục hồi.",
            main_ingredients_brief: meal.ingredients,
            ingredients: meal.ingredients 
                ? String(meal.ingredients).split(/,|;/).map((ing: string) => ({ name: ing.trim(), quantity: "Tùy ý" })) 
                : [],
            nutrition_estimate: {
                kcal: calVal,
                protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0, vegetables_g: 0, fruit_g: 0, added_sugar_g: 0, sodium_mg: 0,
            },
            fit_score: 95, 
            warnings_or_notes: [],
            // Gán ảnh ngay lập tức
            image_url: getSafeImageUrl(mealName), 
        };
    });

    return {
      day_number: input.day_number,
      phase: 1, 
      meal_type: input.meal_type,
      explanation_for_phase: parsedJson.advice || "Thực đơn lành mạnh.",
      suggested_meals: suggestedMeals,
    };
  } catch (e) {
    console.error("Lỗi xử lý dữ liệu Gemini:", e);
    throw e;
  }
}

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  // Thử model flash trước
  const modelsToTry = ["gemini-1.5-flash", "gemini-pro"]; 
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    console.log(`📡 Đang kết nối Model: ${modelName}...`);
    try {
      const currentModel = genAI.getGenerativeModel({ model: modelName });
      
      const jsonStructure = `{ "advice": "Lời khuyên", "meals": [{ "name": "Tên món", "ingredients": "Nguyên liệu", "calories": "500" }] }`;
      const prompt = `Gợi ý 1 món ăn cho bữa ${input.meal_type}. Trả về JSON: ${jsonStructure}`;

      const result = await currentModel.generateContent(prompt);
      const text = result.response.text();
      return parseGeminiResponseToSuggestionResponse(text, input);

    } catch (error: any) {
      console.warn(`⚠️ Lỗi model ${modelName}:`, error.message);
      lastError = error;
    }
  }
  throw new Error(`Không thể kết nối AI (Kiểm tra lại API Key): ${lastError?.message}`);
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  // Trả về ảnh ngay lập tức, không gọi API ngoài
  return getSafeImageUrl(meal.recipe_name);
};