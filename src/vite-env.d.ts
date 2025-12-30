/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Thêm các biến môi trường khác của bạn vào đây nếu cần
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}