import { supabase } from '../lib/supabaseClient';

export async function registerUser(name: string, phoneNumber: string) {
  try {
    // Check if 'users' table exists and create if not.
    // In a real-world scenario, you'd typically manage schema via migrations or Supabase dashboard.
    // For this exercise, we'll assume the table exists or will be created.
    // The 'start_date' column should be of type 'date' in Supabase.

    const { data, error } = await supabase
      .from('users')
      .insert([
        { 
          name: name,
          phone_number: phoneNumber,
          start_date: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
        },
      ])
      .select();

    if (error) {
      console.error('Lỗi khi đăng ký người dùng vào Supabase:', error);
      throw error;
    }

    console.log('Người dùng đã được đăng ký thành công:', data);
    return data;

  } catch (error) {
    console.error('Lỗi trong hàm registerUser:', error);
    throw error;
  }
}