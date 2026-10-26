import axios from 'axios';

const CENTRAL_BACKEND_URL = process.env.CENTRAL_BACKEND_URL || 'http://localhost:4000';

export async function handleChat(req, res) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Dữ liệu yêu cầu không hợp lệ' });
    }

    const { message } = body;
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống và phải là chuỗi hợp lệ' });
    }

    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: 'Yêu cầu đăng nhập' });
    }

    const trimmedText = message.trim();

    try {
      const response = await axios.post(
        `${CENTRAL_BACKEND_URL}/api/chat`,
        { text: trimmedText },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: token,
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      if (!data || typeof data !== 'object') {
        return res.status(502).json({ error: 'Phản hồi từ Central Backend không hợp lệ' });
      }

      if (data.success === false) {
        return res.status(502).json({ error: data.error || data.message || 'Central AI Hub xử lý thất bại' });
      }

      if (typeof data.answer !== 'string' || !data.answer.trim()) {
        return res.status(502).json({ error: 'Central AI Hub trả về câu trả lời rỗng hoặc không đúng định dạng' });
      }

      return res.status(response.status || 200).json({
        answer: data.answer.trim(),
        intent: data.intent || null,
        intentConfidence: typeof data.intentConfidence === 'number' ? data.intentConfidence : null,
      });
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        const errorMsg =
          (typeof errorData === 'object' && errorData !== null ? errorData.error || errorData.message : null) ||
          `Lỗi từ Central Backend (${status})`;

        if (status === 401) {
          return res.status(401).json({ error: errorMsg || 'Phiên làm việc hết hạn hoặc token không hợp lệ' });
        }
        if (status === 403) {
          return res.status(403).json({ error: errorMsg || 'Bạn không có quyền thực hiện thao tác này' });
        }

        return res.status(status).json({
          error: errorMsg,
        });
      }

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return res.status(504).json({
          error: 'Central AI Hub phản hồi quá hạn (timeout). Vui lòng thử lại sau.',
        });
      }

      return res.status(503).json({
        error: 'Không thể kết nối tới Central AI Hub (offline hoặc không thể truy cập).',
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi xử lý chatbot: ' + err.message });
  }
}
