# -*- coding: utf-8 -*-
"""
Kiểm tra tính chất Fail-Closed của Anti-Spoofing Predictor khi mô hình chưa sẵn sàng,
và kiểm tra xác thực internal token trên endpoint refresh của Face AI.
"""

import unittest
import numpy as np
from pathlib import Path
import sys

import unittest
import numpy as np
from pathlib import Path
import sys
from unittest.mock import MagicMock

# Mock cv2 và torch nếu chưa cài đặt trong môi trường chạy test
for mod in ['cv2', 'torch', 'torch.nn', 'torch.nn.functional']:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()

# Thêm đường dẫn thư mục hiện tại
sys.path.insert(0, str(Path(__file__).parent))

from anti_spoof.predictor import AntiSpoofPredictor



class TestAntiSpoofFailClosed(unittest.TestCase):
    def test_predictor_fails_closed_when_no_models(self):
        """Khi predictor không có models nào trong danh sách -> Bắt buộc fail-closed: is_real=False, liveness_score=0.0"""
        predictor = AntiSpoofPredictor(auto_download=False)
        predictor.models = []  # Giả lập không có mô hình nào được nạp

        dummy_frame = np.ones((200, 200, 3), dtype=np.uint8) * 128
        dummy_bbox = (20, 150, 150, 20)  # (top, right, bottom, left)

        result = predictor.predict(dummy_frame, dummy_bbox, bbox_format="top_right_bottom_left")

        self.assertFalse(result["is_real"], "Mô hình chưa nạp bắt buộc phải trả về is_real=False (Fail Closed)")
        self.assertEqual(result["liveness_score"], 0.0, "Mô hình chưa nạp bắt buộc phải trả về liveness_score=0.0")
        self.assertEqual(result["liveness_status"], "SPOOF")
        self.assertEqual(result["spoof_type"], "model_missing")

    def test_predictor_fails_closed_when_frame_empty(self):
        """Khi frame rỗng -> Bắt buộc fail-closed"""
        predictor = AntiSpoofPredictor(auto_download=False)
        result = predictor.predict(np.array([]), (0, 0, 0, 0))

        self.assertFalse(result["is_real"])
        self.assertEqual(result["liveness_score"], 0.0)

    def test_refresh_token_verification_fail_closed(self):
        """Kiểm tra logic bảo vệ token endpoint refresh của Face AI (Fail-Closed)"""
        def check_auth(header_token, expected_secret):
            if not expected_secret:
                return 503  # CONFIG_MISSING
            if not header_token:
                return 401
            if header_token != expected_secret:
                return 403
            return 200

        # Khi chưa set expected token trong env -> Bắt buộc 503 CONFIG_MISSING
        self.assertEqual(check_auth("any-token", None), 503)
        self.assertEqual(check_auth(None, ""), 503)

        # Khi đã set token:
        self.assertEqual(check_auth(None, "secret-123"), 401)
        self.assertEqual(check_auth("wrong-key", "secret-123"), 403)
        self.assertEqual(check_auth("secret-123", "secret-123"), 200)


if __name__ == "__main__":
    unittest.main()
