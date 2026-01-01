import { GoogleGenerativeAI } from "@google/generative-ai";

// Lấy API Key từ biến môi trường
const API_KEY = process.env.GEMINI_API_KEY; // Sử dụng process.env cho môi trường Node.js/Vercel

if (!API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable for API endpoint.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" }); // Sử dụng model Vision cho việc tạo ảnh

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { mealName, description } = req.body;

  if (!mealName) {
    return res.status(400).json({ message: 'Missing mealName in request body.' });
  }

  try {
    const prompt = `Generate a high-quality, realistic image of a "${mealName}" dish. The dish should look appetizing and healthy. Focus on the main ingredients: ${description}.`;

    // Gọi Gemini Vision API để tạo ảnh
    // Lưu ý: Gemini Vision API không trực tiếp tạo ảnh từ text.
    // Để tạo ảnh từ text, bạn cần sử dụng một API tạo ảnh khác (ví dụ: DALL-E, Midjourney)
    // hoặc một model Gemini có khả năng tạo ảnh (nếu có trong tương lai).
    // Hiện tại, tôi sẽ giả lập việc tạo ảnh bằng cách trả về một URL placeholder.
    // Nếu bạn có một dịch vụ tạo ảnh AI thực sự, bạn sẽ tích hợp nó ở đây.

    // Để đơn giản, tôi sẽ trả về một URL Unsplash ngẫu nhiên dựa trên tên món ăn.
    const unsplashKeyword = mealName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, ",");
    
    const imageUrl = `https://source.unsplash.com/featured/?food,healthy,${unsplashKeyword}`;

    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('Error generating meal image:', error);
    res.status(500).json({ message: 'Failed to generate meal image.', error: error.message });
  }
}