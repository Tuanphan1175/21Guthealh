import { UserProfile, ComputedTargets, ActivityLevel, Sex, MealType } from './types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,      // Little or no exercise
  light: 1.375,        // Light exercise 1-3 days/week
  moderate: 1.55,      // Moderate exercise 3-5 days/week
  active: 1.725,       // Hard exercise 6-7 days/week
  very_active: 1.9     // Very hard exercise & physical job
};

const GOAL_MODIFIERS: Record<string, number> = {
  "Giảm cân lành mạnh": -400,
  "Tăng năng lượng": 100,
  "default": 0
};

export function calculateDailyNeeds(profile: UserProfile): ComputedTargets {
  const { weight_kg, height_cm } = profile.anthropometrics;
  const { age_years, sex } = profile.demographics;
  const activityLevel = profile.activity.level;

  // 1. Calculate BMR using Mifflin-St Jeor Equation
  let bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years);
  
  if (sex === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }

  // 2. Calculate TDEE
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.2;
  let tdee = bmr * multiplier;

  // 3. Adjust for Goal
  const goalAdjustment = GOAL_MODIFIERS[profile.goals.primary_goal] || GOAL_MODIFIERS['default'];
  const targetKcal = Math.round(tdee + goalAdjustment);

  // 4. Calculate Macros (Gut Health Balance: Moderate Carb, High Fiber, Adequate Protein)
  // Standard ratios for general health/maintenance: Protein 20-25%, Fat 30%, Carb 45-50%
  // Adjusted for gut repair: Slightly higher protein for repair, focus on fiber.
  
  const proteinRatio = 0.25;
  const fatRatio = 0.30;
  const carbRatio = 0.45;

  const protein_g = Math.round((targetKcal * proteinRatio) / 4);
  const fat_g = Math.round((targetKcal * fatRatio) / 9);
  const carb_g = Math.round((targetKcal * carbRatio) / 4);

  // Fiber: 14g per 1000kcal
  const fiber_g = Math.round((targetKcal / 1000) * 14);

  // Vegetables & Fruits (Estimates)
  // ~400g veg and ~200g fruit for a 2000kcal diet
  const vegetables_g = Math.round((targetKcal / 2000) * 400);
  const fruit_g = Math.round((targetKcal / 2000) * 200);

  return {
    kcal: targetKcal,
    protein_g,
    fat_g,
    carb_g,
    fiber_g,
    vegetables_g,
    fruit_g
  };
}

export function distributeTargetsByMeal(daily: ComputedTargets): Record<MealType, ComputedTargets> {
    // Distribution: Breakfast 25%, Lunch 35%, Dinner 25%, Snack 15%
    const ratios: Record<MealType, number> = {
        breakfast: 0.25,
        lunch: 0.35,
        dinner: 0.25,
        snack: 0.15
    };

    const result = {} as Record<MealType, ComputedTargets>;

    (Object.keys(ratios) as MealType[]).forEach(meal => {
        const r = ratios[meal];
        result[meal] = {
            kcal: Math.round(daily.kcal * r),
            protein_g: Math.round(daily.protein_g * r),
            fat_g: Math.round(daily.fat_g * r),
            carb_g: Math.round(daily.carb_g * r),
            fiber_g: Math.round(daily.fiber_g * r),
            vegetables_g: Math.round(daily.vegetables_g * r),
            fruit_g: Math.round(daily.fruit_g * r)
        };
    });

    return result;
}
