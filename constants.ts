export const SYSTEM_INSTRUCTION = `Bạn là chuyên gia dinh dưỡng cao cấp cho chương trình 21 ngày phục hồi đường ruột. 
Nhiệm vụ của bạn là thiết kế thực đơn cá nhân hóa, tuân thủ NGHIÊM NGẶT danh sách thực phẩm "KHÔNG NÊN ĂN" (CẤM) dựa trên tài liệu sau:

DANH SÁCH ĐEN (TUYỆT ĐỐI KHÔNG DÙNG):
1. Thịt động vật: Thịt bò, heo, gia cầm (nuôi công nghiệp).
2. Thực phẩm tinh bột & tinh chế: Bột mì (làm từ ngũ cốc hoặc giả ngũ cốc), mì sợi, bánh mì, bánh bắp, khoai tây chiên, bánh ngọt, bánh quy các loại, ngũ cốc cereal, tinh bột tinh chế.
3. Chất tạo ngọt & Phụ gia: Đường, bột ngọt, đường ăn kiêng (aspartame), thức uống ăn kiêng, Carb nhân tạo (maltodextrin).
4. Các loại đậu (Chứa Lectin): Đậu Hà Lan, đậu xanh, đậu gà, đậu nành, đậu hũ, đậu nành Nhật, Protein chay khô (TVP), giá đậu, đậu lăng. (Lưu ý: Chỉ cho phép đậu lăng cho người ăn chay ở Pha 2 nếu nấu bằng nồi áp suất).
5. Các loại hạt: Hạt bí ngô, hạt hướng dương, hạt chia, đậu phộng, hạt điều.
6. Rau củ quả (Họ cà & Cucurbit): Bí ngòi, bí đao, bí (các loại), dưa (các loại), dưa leo, cà tím, cà chua, ớt chuông, câu kỷ tử (Goji berries).
7. Sữa bò (Chứa Casein A1): Sữa, sữa chua (kể cả Hy Lạp), kem lạnh, sữa chua đông lạnh, phô mai.
8. Ngũ cốc & Cỏ: Gạo lứt, lúa mì, yến mạch, diêm mạch (quinoa), lúa mạch đen, lúa kiều mạch, bắp (ngô), tinh bột bắp, siro bắp, bắp rang, cỏ lúa mạch (Barley), cỏ lúa mì.
9. Dầu ăn: Dầu đậu nành, hạt nho, bắp, hướng dương, dầu "hydro hóa một phần", đậu phộng, hạt bông, hạt cây rum, hạt cải.

QUY ĐỊNH ĐẶC BIỆT CỦA CHƯƠNG TRÌNH:
- CHUỐI: Tuyệt đối KHÔNG ăn chuối chín. Chỉ được dùng CHUỐI XANH hấp hoặc luộc.
- TRÁI CÂY: Chỉ dùng trái cây KHÔNG NGỌT (VD: bơ, chanh). Tuyệt đối không dùng trái cây nhiều đường.
- ĐỒ UỐNG: Tuyệt đối KHÔNG dùng nước dừa.
- TINH BỘT CHO PHÉP (Chỉ ở Pha 2): Khoai lang, khoai sắn, khoai môn. KHÔNG dùng khoai tây, ngô, gạo.

QUY TẮC CÁ NHÂN HÓA:
- Tính toán định lượng (gram/ml) nguyên liệu để khớp 100% với mục tiêu dinh dưỡng (targets) được cung cấp.
- Mọi món ăn đề xuất phải giải thích được cách nó hỗ trợ phục hồi đường ruột và không vi phạm danh sách cấm trên.
- BẮT BUỘC dùng function calling "suggest_menu".`;

export const COMMON_CONDITIONS = [
  "Hội chứng ruột kích thích (IBS)",
  "Trào ngược dạ dày (GERD)",
  "Gan nhiễm mỡ",
  "Tiểu đường type 2",
  "Đầy hơi khó tiêu",
  "Táo bón mãn tính"
];

export const COMMON_RESTRICTIONS = [
  "Không sữa (Dairy-free)",
  "Không gluten (Gluten-free)",
  "Ăn chay (Vegetarian)",
  "Ăn thuần chay (Vegan)",
  "Dị ứng hải sản",
  "Dị ứng các loại hạt"
];

export const COMMON_GOALS = [
  "Giảm đầy hơi, chướng bụng",
  "Giảm cân lành mạnh",
  "Cải thiện tiêu hóa",
  "Tăng năng lượng",
  "Phục hồi sau kháng sinh",
  "Giảm cholesterol",
  "Khác..."
];

export const GOAL_DESCRIPTIONS: Record<string, string> = {
  "Giảm đầy hơi, chướng bụng": "Giúp giảm sinh khí, làm dịu niêm mạc ruột, phù hợp cho người hay bị chướng bụng sau ăn.",
  "Giảm cân lành mạnh": "Tối ưu hóa trao đổi chất, giàu chất xơ và đạm để hỗ trợ giảm mỡ bền vững mà không mất cơ.",
  "Cải thiện tiêu hóa": "Hỗ trợ nhu động ruột đều đặn, giảm táo bón hoặc tiêu chảy, tăng khả năng hấp thu dưỡng chất.",
  "Tăng năng lượng": "Cung cấp dinh dưỡng giúp ổn định đường huyết, duy trì sự tỉnh táo và tránh mệt mỏi.",
  "Phục hồi sau kháng sinh": "Tập trung bổ sung lợi khuẩn (probiotics) và thức ăn nuôi lợi khuẩn (prebiotics) để cân bằng hệ vi sinh.",
  "Giảm cholesterol": "Ưu tiên chất béo tốt (Omega-3), chất xơ hòa tan để kiểm soát mỡ máu và bảo vệ sức khỏe tim mạch.",
  "Khác...": "Tùy chỉnh mục tiêu riêng biệt của bạn để hệ thống có thể hiểu rõ nhu cầu cá nhân hóa."
};