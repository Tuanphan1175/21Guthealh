export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealSlot = MealType;
export type SnackTiming = 'before_meal' | 'after_meal';

export interface Ingredient {
  name: string;
  quantity: string;
}

export interface NutritionEstimate {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  vegetables_g: number;
  fruit_g: number;
  added_sugar_g: number;
  sodium_mg: number;
}

export interface SuggestionMeal {
  recipe_id: string | null;
  recipe_name: string;
  short_description: string;
  short_reason?: string; 
  reason: string;
  how_it_supports_gut: string;
  fit_with_goal: string;
  main_ingredients_brief: string;
  ingredients: Ingredient[];
  nutrition_estimate: NutritionEstimate;
  fit_score: number | {
    overall?: number;
    macro_match?: number;
    symptom_friendliness?: number;
  };
  warnings_or_notes: string | { code: string; message: string }[];
  image_url?: string;
}

export interface SuggestionResponse {
  day_number: number;
  phase: number;
  meal_type: string;
  explanation_for_phase: string;
  suggested_meals: SuggestionMeal[];
}

export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface UserProfile {
  demographics: {
    sex: Sex;
    age_years: number;
  };
  anthropometrics: {
    height_cm: number;
    weight_kg: number;
    waist_cm?: number;
  };
  activity: { level: ActivityLevel };
  goals: { primary_goal: string };
  health_conditions: { flags: Record<string, boolean> };
  dietary_preferences: {
    restrictions: Record<string, boolean>;
    avoid_ingredients: string[];
    preferred_ingredients: string[];
  };
  personal_note?: string; 
}

export interface ComputedTargets {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  vegetables_g: number;
  fruit_g: number;
}

export interface PersistRequest {
  run_id: string;
  day_index: number;
  phase: string | number;
  suggestion_groups: {
    meal_slot: string;
    items: { title: string; description: string }[];
  }[];
  replace_existing?: boolean;
  replace_scope?: "all" | "meal_slot";
  meal_slot?: MealSlot;
}

export interface UserInput {
  day_number: number;
  meal_type: MealType;
  user_goal: string;
  conditions: string[];
  dietary_restrictions: string[];
  user_profile?: UserProfile; 
  targets?: ComputedTargets;
  max_items?: number;
  exclude_titles?: string[];
  personal_note?: string; 
  snack_timing?: SnackTiming;
}