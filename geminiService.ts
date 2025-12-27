import { UserInput, SuggestionResponse, SuggestionMeal } from "./types";
import { invokeGutHealth } from "./src/apiService";
type GutHealthResponse = {
  ok: boolean;
  meta: any;
  data: any;
  safety: any;
  error?: { code: string; message: string };
};

export const getMealSuggestions = async (input: UserInput): Promise<SuggestionResponse> => {
  const res = (await invokeGutHealth({
    mode: "suggest_menu",
    locale: "vi",
    input,
  })) as GutHealthResponse;

  if (!res.ok) throw new Error(res.error?.message || "suggest_menu failed");
  return res.data as SuggestionResponse;
};

export const generateMealImage = async (meal: SuggestionMeal): Promise<string> => {
  const res = (await invokeGutHealth({
    mode: "generate_image",
    locale: "vi",
    meal,
    aspectRatio: "3:4",
  })) as GutHealthResponse;

  if (!res.ok) throw new Error(res.error?.message || "generate_image failed");
  return res.data.imageData as string;
};
