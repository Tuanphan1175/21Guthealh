import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../../types'; // Adjust path to types.ts

export async function ensureUsersTableAndSaveProfile(profile: UserProfile) {
  try {
    // In a real-world scenario, you'd typically manage schema via migrations or Supabase dashboard.
    // For this exercise, we'll assume the 'users' table exists with the necessary columns.
    // The 'start_date' column should be of type 'date' in Supabase.

    const { data, error } = await supabase
      .from('users')
      .insert([
        { 
          sex: profile.demographics.sex,
          age_years: profile.demographics.age_years,
          height_cm: profile.anthropometrics.height_cm,
          weight_kg: profile.anthropometrics.weight_kg,
          activity_level: profile.activity.level,
          primary_goal: profile.goals.primary_goal,
          health_conditions_flags: profile.health_conditions.flags,
          dietary_restrictions: profile.dietary_preferences.restrictions,
          avoid_ingredients: profile.dietary_preferences.avoid_ingredients,
          preferred_ingredients: profile.dietary_preferences.preferred_ingredients,
          personal_note: profile.personal_note,
          start_date: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
        },
      ])
      .select();

    if (error) {
      console.error('Lỗi khi lưu hồ sơ người dùng vào Supabase:', error);
      throw error;
    }

    console.log('Hồ sơ người dùng đã được lưu thành công:', data);
    return data;

  } catch (error) {
    console.error('Lỗi trong hàm ensureUsersTableAndSaveProfile:', error);
    throw error;
  }
}

export async function getUserProfile(phoneNumber: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('start_date', { ascending: false }) // Lấy hồ sơ gần đây nhất
      .limit(1);

    if (error) {
      console.error('Lỗi khi lấy hồ sơ người dùng từ Supabase:', error);
      throw error;
    }

    if (data && data.length > 0) {
      const rawProfile = data[0];
      // Chuyển đổi dữ liệu từ Supabase thành định dạng UserProfile
      const userProfile: UserProfile = {
        demographics: {
          sex: rawProfile.sex,
          age_years: rawProfile.age_years,
        },
        anthropometrics: {
          height_cm: rawProfile.height_cm,
          weight_kg: rawProfile.weight_kg,
          waist_cm: rawProfile.waist_cm,
        },
        activity: {
          level: rawProfile.activity_level,
        },
        goals: {
          primary_goal: rawProfile.primary_goal,
        },
        health_conditions: {
          flags: rawProfile.health_conditions_flags || {},
        },
        dietary_preferences: {
          restrictions: rawProfile.dietary_restrictions || {},
          avoid_ingredients: rawProfile.avoid_ingredients || [],
          preferred_ingredients: rawProfile.preferred_ingredients || [],
        },
        personal_note: rawProfile.personal_note,
      };
      return userProfile;
    }

    return null;
  } catch (error) {
    console.error('Lỗi trong hàm getUserProfile:', error);
    throw error;
  }
}