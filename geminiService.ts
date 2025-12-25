
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "./constants";
import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const suggestMenuFunction: FunctionDeclaration = {
  name: 'suggest_menu',
  description: 'Generate a meal plan suggestion tailored to specific macro targets. Every ingredient must have a calculated weight in grams to meet the targets.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      day_number: { type: Type.INTEGER },
      phase: { type: Type.INTEGER },
      meal_type: { type: Type.STRING },
      meal_slot: { 
        type: Type.STRING, 
        enum: ["breakfast", "lunch", "dinner", "snack"],
        description: "The specific meal slot this suggestion is for." 
      },
      explanation_for_phase: { type: Type.STRING },
      suggested_meals: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            recipe_name: { type: Type.STRING },
            short_description: { type: Type.STRING },
            short_reason: { 
              type: Type.STRING, 
              description: "Concise 1-sentence reason for goal fit." 
            },
            reason: { type: Type.STRING },
            how_it_supports_gut: { type: Type.STRING },
            fit_with_goal: { type: Type.STRING },
            main_ingredients_brief: { type: Type.STRING },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Tên nguyên liệu" },
                  quantity: { type: Type.STRING, description: "Định lượng chính xác tính bằng gram/ml (VD: 185g, 120ml) dựa trên chỉ tiêu macro." }
                },
                required: ["name", "quantity"]
              }
            },
            nutrition_estimate: {
              type: Type.OBJECT,
              properties: {
                kcal: { type: Type.NUMBER },
                protein_g: { type: Type.NUMBER },
                fat_g: { type: Type.NUMBER },
                carb_g: { type: Type.NUMBER },
                fiber_g: { type: Type.NUMBER },
                vegetables_g: { type: Type.NUMBER },
                fruit_g: { type: Type.NUMBER },
                added_sugar_g: { type: Type.NUMBER },
                sodium_mg: { type: Type.NUMBER }
              },
              required: ["kcal", "protein_g", "carb_g", "fiber_g"]
            },
            fit_score: { 
              type: Type.OBJECT,
              properties: {
                overall: { type: Type.NUMBER },
                macro_match: { type: Type.NUMBER },
                symptom_friendliness: { type: Type.NUMBER }
              },
              required: ["overall"]
            },
            warnings_or_notes: { 
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                required: ["code", "message"]
              }
            },
            image_url: { type: Type.STRING, nullable: true }
          },
          required: ["recipe_name", "ingredients", "nutrition_estimate", "fit_score"]
        },
      },
    },
    required: ["day_number", "phase", "suggested_meals"],
  },
};

const tools = [{ functionDeclarations: [suggestMenuFunction] }];

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  try {
    const model = 'gemini-3-pro-preview';
    let phase = 1;
    if (input.day_number >= 4 && input.day_number <= 21) phase = 2;
    if (input.day_number > 21) phase = 3;

    const targets = input.targets || {
      kcal: 0,
      protein_g: 0,
      fat_g: 0,
      carb_g: 0,
      fiber_g: 0,
      vegetables_g: 0,
      fruit_g: 0
    };
    
    const contextPayload = {
      user: {
        sex: input.user_profile?.demographics.sex,
        age: input.user_profile?.demographics.age_years,
        weight: input.user_profile?.anthropometrics.weight_kg,
        height: input.user_profile?.anthropometrics.height_cm,
        goal: input.user_goal,
        conditions: input.conditions
      },
      meal_targets: targets,
      constraints: {
        avoid: input.user_profile?.dietary_preferences.avoid_ingredients || [],
        restrictions: input.dietary_restrictions,
        personal_note: input.personal_note || ""
      }
    };

    const prompt = `CÁ NHÂN HÓA THỰC ĐƠN BỮA ${input.meal_type.toUpperCase()} CHO NGÀY ${input.day_number} (PHA ${phase}).
    
    CHỈ TIÊU DINH DƯỠNG BẮT BUỘC:
    - Calo: ${targets.kcal} kcal
    - Đạm: ${targets.protein_g}g
    - Carb: ${targets.carb_g}g
    - Chất xơ: ${targets.fiber_g}g
    
    YÊU CẦU KIỂM SOÁT THỰC PHẨM CỰC KỲ NGHIÊM NGẶT:
    1. Tuyệt đối KHÔNG dùng bất kỳ thực phẩm nào trong DANH SÁCH ĐEN (nightshades, grains, legumes, industrial meat, dairy).
    2. Nếu dùng chuối, CHỈ ĐƯỢC dùng CHUỐI XANH (hấp/luộc). KHÔNG chuối chín.
    3. Tuyệt đối KHÔNG nước dừa.
    4. Chỉ dùng trái cây ít đường/không ngọt.
    5. Đảm bảo mọi định lượng (gram) khớp với targets.
    6. Lưu ý cá nhân: "${input.personal_note || 'Không có'}".
    
    Dữ liệu ngữ cảnh: ${JSON.stringify(contextPayload)}`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: tools,
        toolConfig: { functionCallingConfig: { mode: "ANY" } },
        temperature: 0.7,
      },
    });

    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const fc = functionCalls[0];
      if (fc.name === 'suggest_menu' && fc.args) {
        return fc.args as unknown as SuggestionResponse;
      }
    }
    throw new Error("Hệ thống không trả về kết quả đúng định dạng.");
  } catch (error) {
    console.error("Error in getMealSuggestions:", error);
    throw error;
  }
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  try {
    const ingredientsList = meal.ingredients.map(i => `${i.quantity} ${i.name}`).join(', ');
    const prompt = `A professional, high-end, photorealistic culinary photograph of the Vietnamese dish: "${meal.recipe_name}". 
    The dish MUST visually accurately represent the following description: "${meal.short_description}". 
    The image MUST clearly show these specific ingredients in the calculated portions: ${ingredientsList}. 
    Style: Top-down or 45-degree angle food photography, clean aesthetic, plated in a minimalist ceramic bowl, natural morning sunlight, vibrant colors.
    Strict prohibition: DO NOT include any text, letters, watermarks. Only the realistic food image in 4k resolution.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};
