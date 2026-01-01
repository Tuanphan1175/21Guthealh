import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

/**
 * Dyad/Vite env
 * - Set trong Dyad:
 *   VITE_API_BASE_URL = https://<backend-vercel>.vercel.app
 */
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";

// --- KHO ẢNH CỐ ĐỊNH CHẤT LƯỢNG CAO (UNSPLASH) ---
const FIXED_IMAGES: Record<string, string> = {
  smoothie: "https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=900&q=80",
  fish: "https://images.unsplash.com/photo-1467003909585-2f8a7270028d?auto=format&fit=crop&w=900&q=80",
  chicken: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80",
  meat: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=80",
  rice: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
  potato: "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?auto=format&fit=crop&w=900&q=80",
  soup: "https://images.unsplash.com/photo-1547592166-23acbe3a624b?auto=format&fit=crop&w=900&q=80",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  oats: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=900&q=80",
  fruit: "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=900&q=80",
  default: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80",
};

function getSafeImage(category?: string): string {
  const key = String(category || "").trim().toLowerCase();
  return FIXED_IMAGES[key] || FIXED_IMAGES.default;
}

// --- THỰC ĐƠN DỰ PHÒNG (KHI AI BẬN / HẾT QUOTA / BACKEND LỖI) ---
const BACKUP_MENU_DATA = (day: number) => {
  const isPhase1 = day <= 3;
  return {
    phase: isPhase1 ? 1 : 2,
    explanation_for_phase: isPhase1 ? "Giai đoạn 1: Thanh Lọc" : "Giai đoạn 2: Phục Hồi",
    advice: "Hệ thống AI đang bận hoặc hết quota. Đây là thực đơn mẫu an toàn, dễ áp dụng.",
    meals: [
      {
        name: isPhase1 ? "Sinh Tố Xanh GutHealth (Thanh Lọc)" : "Cá Hồi Áp Chảo & Khoai Lang Tím",
        image_category: isPhase1 ? "smoothie" : "fish",
        ingredients: isPhase1
          ? "Xà lách, rau dền non, bạc hà, bơ, táo, cà chua, chanh (xay nhuyễn)."
          : "Phi lê cá hồi, khoai lang tím hấp, măng tây, dầu oliu, tỏi.",
        calories: isPhase1 ? "350" : "450",
      },
    ],
  };
};

// --- JSON CLEAN/PARSE ---
function extractJsonCandidate(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return t;

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence?.[1]) return fence[1].trim();

  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return t.slice(first, last + 1).trim();

  return t;
}

function safeJsonParse(s: string) {
  try {
    return { ok: true as const, value: JSON.parse(s) };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Invalid JSON" };
  }
}

/**
 * Chuẩn hóa output về đúng SuggestionResponse app đang dùng:
 * - nhận meals[] hoặc suggested_meals[]
 * - map thành suggested_meals[] kiểu SuggestionMeal
 */
function normalizeToSuggestionResponse(parsed: any, input: UserInput): SuggestionResponse {
  const mealsData = Array.isArray(parsed?.meals)
    ? parsed.meals
    : Array.isArray(parsed?.suggested_meals)
      ? parsed.suggested_meals
      : Array.isArray(parsed)
        ? parsed
        : [];

  if (!Array.isArray(mealsData) || mealsData.length === 0) {
    throw new Error("Không tìm thấy danh sách món ăn trong phản hồi.");
  }

  const suggestedMeals: SuggestionMeal[] = mealsData.map((meal: any, index: number) => {
    const mealName = meal?.name || meal?.recipe_name || "Món ăn dinh dưỡng";
    const category = meal?.image_category || meal?.imageCategory || "default";

    const kcalRaw = meal?.calories ?? meal?.kcal ?? meal?.macros?.kcal ?? 0;
    const kcal =
      typeof kcalRaw === "number" ? kcalRaw : parseInt(String(kcalRaw).replace(/[^0-9]/g, ""), 10) || 0;

    const ingredientsText = meal?.ingredients || meal?.main_ingredients_brief || meal?.short_description || "";

    return {
      recipe_id: `meal-${input.day_number}-${index}-${Date.now()}`,
      recipe_name: mealName,
      short_description: meal?.description || meal?.short_description || ingredientsText || "Công thức an toàn cho đường ruột.",
      reason: parsed?.advice || parsed?.explanation_for_phase || "Hỗ trợ phục hồi.",
      how_it_supports_gut: meal?.how_it_supports_gut || "Dễ tiêu, ít kích ứng.",
      fit_with_goal: meal?.fit_with_goal || "Phù hợp mục tiêu.",
      main_ingredients_brief: ingredientsText,
      ingredients: Array.isArray(meal?.ingredients_list) ? meal.ingredients_list : [],
      cooking_instructions: Array.isArray(meal?.cooking_instructions) ? meal.cooking_instructions : [],
      nutrition_estimate: meal?.nutrition_estimate || {
        kcal: kcal || 400,
        protein_g: 20,
        fat_g: 10,
        carb_g: 40,
        fiber_g: 8,
        vegetables_g: 200,
        fruit_g: 50,
        added_sugar_g: 0,
        sodium_mg: 0,
      },
      fit_score: typeof meal?.fit_score === "number" ? meal.fit_score : 99,
      warnings_or_notes: Array.isArray(meal?.warnings_or_notes) ? meal.warnings_or_notes : [],
      image_url: getSafeImage(category),
    } as any;
  });

  const phase = Number(parsed?.phase ?? (input.day_number <= 3 ? 1 : 2));

  return {
    day_number: input.day_number,
    phase,
    meal_type: input.meal_type,
    explanation_for_phase: parsed?.explanation_for_phase || parsed?.advice || (input.day_number <= 3 ? "Giai đoạn 1: Thanh Lọc" : "Giai đoạn 2: Phục Hồi"),
    suggested_meals: suggestedMeals,
  };
}

// --- MAIN: getMealSuggestions ---
export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  // Nếu chưa set backend => dùng menu mẫu luôn (an toàn)
  if (!API_BASE) {
    console.warn("⚠️ Thiếu VITE_API_BASE_URL -> dùng thực đơn mẫu.");
    return normalizeToSuggestionResponse(BACKUP_MENU_DATA(input.day_number), input);
  }

  try {
    const res = await fetch(`${API_BASE}/api/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const text = await res.text();

    // Backend lỗi / quota => fallback
    if (!res.ok) {
      console.warn(`⚠️ Backend gemini lỗi ${res.status} -> dùng thực đơn mẫu.`);
      return normalizeToSuggestionResponse(BACKUP_MENU_DATA(input.day_number), input);
    }

    // Backend trả JSON
    const parsed = safeJsonParse(text);
    if (parsed.ok) {
      // Nếu backend đã trả đúng schema SuggestionResponse thì return thẳng
      if (parsed.value?.suggested_meals) return parsed.value as SuggestionResponse;
      // Nếu backend trả schema {advice, meals:[...]} thì normalize
      return normalizeToSuggestionResponse(parsed.value, input);
    }

    // Backend trả text (hiếm): cố gắng trích JSON rồi parse
    const candidate = extractJsonCandidate(text);
    const parsed2 = safeJsonParse(candidate);
    if (!parsed2.ok) throw new Error(`Parse JSON thất bại: ${parsed2.error}`);
    return normalizeToSuggestionResponse(parsed2.value, input);
  } catch (e) {
    console.warn("⚠️ Không gọi được backend -> dùng thực đơn mẫu.", e);
    return normalizeToSuggestionResponse(BACKUP_MENU_DATA(input.day_number), input);
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  // Reroll ảnh chỉ thay category an toàn
  return getSafeImage("default");
};

const GUT_HEALTH_RULES = `
QUY TẮC DINH DƯỠNG "GUT HEALTH 21 NGÀY":
1. GIAI ĐOẠN 1 (Ngày 1-3): THANH LỌC. CẤM TINH BỘT. Bắt buộc Sinh Tố Xanh sáng.
2. GIAI ĐOẠN 2 (Ngày 4-21): PHỤC HỒI. Ăn tinh bột tốt.
`;
const SINH_TO_XANH_RECIPE = `1 cup xà lách, 1/2 cup rau dền, 1 cây bạc hà, 1/2 bơ, 1/2 táo, 1 cà chua, chanh.`;

function getSafeImage(category: string): string {
    const key = category.trim().toLowerCase();
    // Lấy ảnh trực tiếp từ kho Unsplash xịn, không random nữa
    return FIXED_IMAGES[key] || FIXED_IMAGES["default"];
}

function cleanGeminiResponse(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) return text.substring(firstBrace, lastBrace + 1);
  return text;
}

function processResponseData(parsedJson: any, input: UserInput): SuggestionResponse {
    const mealsData = Array.isArray(parsedJson) ? parsedJson : (parsedJson.meals || []);
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
                kcal: parseInt(meal.calories) || 400, protein_g: 20, fat_g: 10, carb_g: 40, fiber_g: 10, vegetables_g: 200, fruit_g: 50, added_sugar_g: 0, sodium_mg: 0 
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
      explanation_for_phase: input.day_number <= 3 ? "Giai đoạn 1: Thanh Lọc" : "Giai đoạn 2: Phục Hồi",
      suggested_meals: suggestedMeals,
    };
}

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  const promptText = `
    Bạn là Chuyên gia Dinh dưỡng GutHealth21.
    Khách: ${input.user_profile?.demographics?.sex}, Mục tiêu: ${input.user_profile?.goals?.primary_goal}.
    NGÀY: ${input.day_number}. Bữa: ${input.meal_type}.
    QUY TẮC: ${GUT_HEALTH_RULES}
    SÁNG GĐ1 BẮT BUỘC: Sinh Tố Xanh (${SINH_TO_XANH_RECIPE}).
    ẢNH: BẮT BUỘC CHỌN 1 TRONG CÁC TỪ KHÓA SAU: "smoothie", "fish", "chicken", "meat", "rice", "potato", "soup", "salad", "oats", "fruit".
    JSON Mẫu: { "advice": "...", "meals": [{ "name": "...", "image_category": "...", "ingredients": "...", "calories": "..." }] }
  `;

  if (API_KEY.includes("DÁN_KEY") || API_KEY.length < 20) {
      return processResponseData(BACKUP_MENU_DATA(input.day_number), input);
  }

  try {
    const response = await fetch(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    if (!response.ok) {
        console.warn(`⚠️ Google bận/hết quota (${response.status}) -> Dùng thực đơn mẫu.`);
        return processResponseData(BACKUP_MENU_DATA(input.day_number), input);
    }

    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
       return parseGeminiResponseToSuggestionResponse(data.candidates[0].content.parts[0].text, input);
    }
    throw new Error("No data");

  } catch (error) {
    console.error("⚠️ Hệ thống AI bận, chuyển sang thực đơn mẫu.");
    return processResponseData(BACKUP_MENU_DATA(input.day_number), input);
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  return getSafeImage("healthy"); 
};