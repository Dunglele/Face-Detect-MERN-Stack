import axios from 'axios';

const CENTRAL_BACKEND_URL = process.env.CENTRAL_BACKEND_URL || 'http://localhost:4000';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function handleChat(req, res) {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    const token = req.headers.authorization;

    // 1. Ưu tiên gọi sang Central Backend của AIAttendanceWeb3 (Port 4000)
    // Nơi đây có đầy đủ PhoBERT NLU + Business Database queries
    try {
      const response = await axios.post(
        `${CENTRAL_BACKEND_URL}/api/chat`,
        { message: message.trim() },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: token } : {}),
          },
          timeout: 6000,
        }
      );

      return res.json({
        success: true,
        source: 'central_backend',
        ...response.data,
      });
    } catch (centralErr) {
      // 2. Fallback: Nếu backend 4000 bận hoặc không kết nối, thử gọi thẳng sang AI Service (Port 8000)
      try {
        const aiRes = await axios.post(
          `${AI_SERVICE_URL}/nlu/predict`,
          { text: message.trim() },
          { timeout: 4000 }
        );

        const { intent, confidence } = aiRes.data;
        let fallbackAnswer = `[AI PhoBERT] Dự đoán ý định: ${intent} (Độ tin cậy: ${(confidence * 100).toFixed(1)}%).`;
        if (intent === 'greeting') {
          fallbackAnswer = 'Xin chào bạn! Mình là Trợ lý ảo AI của hệ thống chấm công. Bạn cần hỗ trợ gì hôm nay?';
        } else if (intent === 'my_leave_status') {
          fallbackAnswer = 'Bạn có thể xem chi tiết số ngày phép còn lại tại tab "Đơn Nghỉ Phép" ở Cổng nhân viên nhé!';
        } else if (intent === 'check_attendance_status') {
          fallbackAnswer = 'Bạn có thể theo dõi chi tiết giờ vào/ra tại tab "Bảng Chấm Công" bên cạnh.';
        }

        return res.json({
          success: true,
          source: 'ai_service_direct',
          answer: fallbackAnswer,
          intent,
          confidence,
        });
      } catch (aiErr) {
        // Fallback nhẹ nếu cả 2 chưa bật
        return res.json({
          success: true,
          source: 'local_fallback',
          answer: `Xin chào ${req.user?.fullName || 'bạn'}! Tôi đã ghi nhận câu hỏi: "${message}". Hiện Central AI Service (Port 4000/8000) đang khởi động. Bạn có thể tra cứu thông tin trực tiếp tại các tab Báo cáo chấm công hoặc Đơn nghỉ phép!`,
        });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi xử lý chatbot: ' + err.message });
  }
}
