import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

// Hàm tạo ảnh placeholder (Giữ nguyên)
function getSafeImageUrl(text: string): string {
    return `https://placehold.co/800x600/f8fafc/475569.png?text=${encodeURIComponent(text)}&font=roboto`;
}

// Hàm làm sạch JSON (Giữ nguyên)
function cleanGeminiResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

// Hàm phân tích JSON (Giữ nguyên logic)
function parseGeminiResponseToSuggestionResponse(geminiText: string, input: UserInput): SuggestionResponse {
  try {
    const cleanedText = cleanGeminiResponse(geminiText);
    const parsedJson = JSON.parse(cleanedText);

    if (!parsedJson.meals || !Array.isArray(parsedJson.meals)) {
      throw new Error("Dữ liệu trả về thiếu danh sách món ăn (meals)");
    }

    const suggestedMeals: SuggestionMeal[] = parsedJson.meals.map((meal: any, index: number) => {
        let calVal = 0;
        if (meal.calories) calVal = parseInt(String(meal.calories).replace(/[^0-9]/g, '')) || 0;
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
                kcal: calVal, protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0, 
                vegetables_g: 0, fruit_g: 0, added_sugar_g: 0, sodium_mg: 0,
            },
            fit_score: 95, 
            warnings_or_notes: [],
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

// --- MAIN SERVICE (GỌI VỀ VERCEL FUNCTION) ---
export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  const userProfile = input.user_profile;
  const jsonStructure = `{ "advice": "Lời khuyên", "meals": [{ "name": "Tên món", "ingredients": "Nguyên liệu", "calories": "500" }] }`;
  
  const promptText = `
    Đóng vai chuyên gia dinh dưỡng. Tạo thực đơn 1 món cho bữa ${input.meal_type}.
    Khách hàng: ${userProfile?.demographics?.sex}, ${userProfile?.goals?.primary_goal}.
    Ghi chú: ${input.personal_note || "Không có"}.
    BẮT BUỘC trả về JSON đúng định dạng: ${jsonStructure}
  `;

  try {
    // GỌI VỀ SERVER CỦA CHÍNH MÌNH (/api/gemini)
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Lỗi khi gọi Server");
    }

    const data = await response.json();
    
    // Server Vercel trả về đúng cấu trúc của Google, ta chỉ việc lấy dùng
    if (data.candidates && data.candidates.length > 0) {
       return parseGeminiResponseToSuggestionResponse(data.candidates[0].content.parts[0].text, input);
    } else {
       throw new Error("Server không trả về nội dung.");
    }
  } catch (error: any) {
    console.error("Lỗi:", error);
    throw new Error(`Không thể tạo thực đơn: ${error.message}`);
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  return getSafeImageUrl(meal.recipe_name);
};