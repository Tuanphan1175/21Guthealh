import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';

export async function ensureUsersTableAndSaveProfile(profile: UserProfile) {
  try {
    // Check if 'users' table exists and create if not.
    // Supabase's `from().insert()` will create the table if it doesn't exist
    // when using the RLS policies correctly, but for explicit schema management
    // and ensuring 'start_date', we might need a more robust check or rely on
    // Supabase migrations/dashboard for table creation.
    // For this exercise, we'll assume the table is created via dashboard or migration
    // and focus on inserting data.
    // In a real-world scenario, you'd typically manage schema via migrations.

    // For demonstration, we'll just insert. If the table doesn't exist,
    // this insert will likely fail unless RLS is configured to allow table creation,
    // which is not standard.
    // A more robust solution would involve checking metadata or using a server-side function
    // to create the table if it doesn't exist.
    // For now, we'll proceed with insert and assume 'users' table exists with 'start_date'.

    const { data, error } = await supabase
      .from('users')
      .insert([
        { 
          ...profile.demographics,
          ...profile.anthropometrics,
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