# -*- coding: utf-8 -*-
"""
test_identity_security.py
Bộ kiểm thử bảo mật cho rủi ro định danh chấm công mặt khuôn.

Các kịch bản được kiểm thử:
1. Trùng tên (duplicate fullName): hai người trùng tên phải có mongo_id riêng biệt
   → không bị ghi đè meta, không bị gắn mã sai.
2. face.enrolled=False (explicit): không nạp embedding dù field embedding còn tồn tại.
3. face.enrolled thiếu/None với faceDescriptors hợp lệ: nạp theo schema cũ.
4. isFaceEnrolled=False (schema cũ explicit): bị bỏ qua khi face.enrolled chưa set True.
5. employee_code được truyền đúng trong kết quả recognize_faces_in_frame.
6. Khi DB rỗng / không kết nối: fail-closed, danh bạ rỗng.

Chạy độc lập, không cần MongoDB thật, model AI, hay kết nối mạng.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np

# Mock các thư viện thị giác nặng nếu chưa cài
for mod_name in ("cv2", "face_recognition", "ultralytics"):
    if mod_name not in sys.modules:
        try:
            __import__(mod_name)
        except ImportError:
            sys.modules[mod_name] = MagicMock()

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from face_service import FaceService


class TestIdentitySecurityFixes(unittest.TestCase):
    """Kiểm thử các bản vá bảo mật rủi ro định danh."""

    def _make_service(self):
        """Tạo FaceService với mock hoàn toàn, không gọi mạng hay load model."""
        with patch.object(FaceService, "_init_yolo"), \
             patch.object(FaceService, "_init_anti_spoof"), \
             patch.object(FaceService, "_init_mongo"), \
             patch.object(FaceService, "load_database_from_mongo", return_value=False), \
             patch.object(FaceService, "load_database", return_value=True):
            svc = FaceService()
            svc.mongo_connected = True
            svc.mock_collection = MagicMock()
            svc.users_collection = svc.mock_collection
        return svc

    # =========================================================================
    # 1. TRÙNG TÊN (DUPLICATE FULLNAME)
    # Hai người cùng fullName PHẢI được lưu vào hai meta_key riêng biệt.
    # =========================================================================
    def test_duplicate_name_creates_separate_meta_entries(self):
        """Hai người trùng tên phải có mongo_id riêng và không ghi đè nhau."""
        svc = self._make_service()
        rng = np.random.RandomState(42)
        emb1 = rng.randn(128).tolist()
        emb2 = rng.randn(128).tolist()

        # Hai người trùng tên "Nguyen Van A", mã khác nhau
        doc1 = {
            "_id": "mongo_id_001",
            "fullName": "Nguyen Van A",
            "employeeCode": "NV001",
            "face": {"enrolled": True, "embedding": emb1},
        }
        doc2 = {
            "_id": "mongo_id_002",
            "fullName": "Nguyen Van A",  # cùng tên
            "employeeCode": "NV099",     # khác mã
            "face": {"enrolled": True, "embedding": emb2},
        }

        svc.users_collection.find.return_value = [doc1, doc2]
        success = svc.load_database_from_mongo()

        self.assertTrue(success)
        # Phải có đúng 2 encoding, không bị ghi đè
        self.assertEqual(len(svc.known_encodings), 2)
        # Phải có 2 meta_key riêng biệt (mongo_id)
        self.assertEqual(len(svc.users_meta), 2)
        # Hai mã nhân viên phải khác nhau
        codes = {m["employee_code"] for m in svc.users_meta.values()}
        self.assertIn("NV001", codes)
        self.assertIn("NV099", codes)
        self.assertNotEqual(codes, {"NV001"})  # không bị ghi đè

    def test_duplicate_name_recognition_returns_correct_employee_codes(self):
        """recognize_faces_in_frame phải trả employee_code đúng dù trùng tên."""
        svc = self._make_service()
        rng = np.random.RandomState(99)
        emb1 = rng.randn(128)
        emb2 = rng.randn(128)

        # Nạp thủ công: 2 người trùng tên
        svc.known_encodings = [emb1, emb2]
        svc.known_names = ["mongo_id_001", "mongo_id_002"]
        svc.users_meta = {
            "mongo_id_001": {
                "employee_code": "NV001",
                "full_name": "Nguyen Van A",
                "name": "Nguyen Van A",
            },
            "mongo_id_002": {
                "employee_code": "NV099",
                "full_name": "Nguyen Van A",
                "name": "Nguyen Van A",
            },
        }

        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        fake_enc = emb1  # khớp với mongo_id_001 → NV001

        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[fake_enc]), \
             patch("face_recognition.face_distance",
                   return_value=np.array([0.2, 0.65])):  # 0.2 < threshold → match với index 0
            results = svc.recognize_faces_in_frame(fake_frame)

        self.assertEqual(len(results), 1)
        self.assertTrue(results[0]["is_match"])
        self.assertEqual(results[0]["employee_code"], "NV001",
                         "Phải trả NV001, không phải NV099 dù cùng tên")
        self.assertEqual(results[0]["full_name"], "Nguyen Van A")

    # =========================================================================
    # 2. face.enrolled=False PHẢI THẮNG TUYỆT ĐỐI
    # Không nạp embedding dù field embedding còn tồn tại trong DB.
    # =========================================================================
    def test_face_enrolled_false_blocks_embedding_load(self):
        """face.enrolled=False: không nạp vector dù embedding tồn tại."""
        svc = self._make_service()
        rng = np.random.RandomState(11)
        emb = rng.randn(128).tolist()

        doc = {
            "_id": "id_revoked",
            "fullName": "Nguyen Van B",
            "employeeCode": "NV002",
            "face": {
                "enrolled": False,          # EXPLICIT FALSE → phải bị bỏ qua
                "embedding": emb,           # embedding vẫn còn trong DB
                "sampleCount": 10,
            },
        }
        svc.users_collection.find.return_value = [doc]
        success = svc.load_database_from_mongo()

        self.assertTrue(success)
        self.assertEqual(len(svc.known_encodings), 0,
                         "face.enrolled=False: không được nạp vector dù embedding tồn tại")
        self.assertEqual(len(svc.users_meta), 0)

    def test_face_enrolled_true_loads_embedding(self):
        """face.enrolled=True: nạp embedding bình thường."""
        svc = self._make_service()
        rng = np.random.RandomState(22)
        emb = rng.randn(128).tolist()

        doc = {
            "_id": "id_active",
            "fullName": "Le Van C",
            "employeeCode": "NV003",
            "face": {
                "enrolled": True,
                "embedding": emb,
            },
        }
        svc.users_collection.find.return_value = [doc]
        success = svc.load_database_from_mongo()

        self.assertTrue(success)
        self.assertEqual(len(svc.known_encodings), 1,
                         "face.enrolled=True: phải nạp đúng 1 vector")

    def test_face_enrolled_none_with_new_schema_embedding_loads(self):
        """face.enrolled=None/missing nhưng face.embedding hợp lệ → KHÔNG nạp (không có enrolled=True)."""
        # Lưu ý: query Mongo đã lọc để chỉ trả về doc có face.enrolled=True hoặc cờ cũ.
        # Nếu doc không có enrolled=True nhưng vẫn lọt vào (schema cũ), thì face_enrolled=None.
        # Theo logic: face_enrolled is False → bỏ qua. None → không bỏ qua, tiếp tục.
        svc = self._make_service()
        rng = np.random.RandomState(33)
        emb = rng.randn(128).tolist()

        # enrolled không set (None) nhưng isFaceEnrolled=True (schema cũ)
        doc = {
            "_id": "id_old_schema",
            "fullName": "Pham Thi D",
            "employeeCode": "NV004",
            "isFaceEnrolled": True,
            "face": {
                "embedding": emb,
                # "enrolled" không tồn tại → face_enrolled = None
            },
        }
        svc.users_collection.find.return_value = [doc]
        success = svc.load_database_from_mongo()

        self.assertTrue(success)
        # face_enrolled = None (không phải False) → tiếp tục nạp schema mới nếu có embedding
        self.assertEqual(len(svc.known_encodings), 1,
                         "enrolled=None với embedding hợp lệ: nạp được")

    # =========================================================================
    # 3. SCHEMA CŨ: isFaceEnrolled=False (explicit) → bỏ qua
    # =========================================================================
    def test_is_face_enrolled_false_schema_old_blocks_load(self):
        """isFaceEnrolled=False (schema cũ explicit): không nạp faceDescriptors."""
        svc = self._make_service()
        rng = np.random.RandomState(44)
        desc = rng.randn(128).tolist()

        doc = {
            "_id": "id_old_revoked",
            "name": "Tran Thi E",
            "employeeId": "EMP-005",
            "isFaceEnrolled": False,    # EXPLICIT FALSE schema cũ
            "faceDescriptors": [desc],  # descriptor vẫn còn
        }
        svc.users_collection.find.return_value = [doc]
        success = svc.load_database_from_mongo()

        self.assertTrue(success)
        self.assertEqual(len(svc.known_encodings), 0,
                         "isFaceEnrolled=False: không được nạp faceDescriptors")

    def test_is_face_enrolled_true_schema_old_loads_descriptors(self):
        """isFaceEnrolled=True (schema cũ): nạp faceDescriptors bình thường."""
        svc = self._make_service()
        rng = np.random.RandomState(55)
        desc = rng.randn(128).tolist()

        doc = {
            "_id": "id_old_active",
            "name": "Tran Van F",
            "employeeId": "EMP-006",
            "isFaceEnrolled": True,
            "faceDescriptors": [desc],
        }
        svc.users_collection.find.return_value = [doc]
        success = svc.load_database_from_mongo()

        self.assertTrue(success)
        self.assertEqual(len(svc.known_encodings), 1,
                         "isFaceEnrolled=True: nạp đúng 1 descriptor từ schema cũ")

    # =========================================================================
    # 4. face.enrolled=False THẮNG isFaceEnrolled=True (schema mới ưu tiên)
    # =========================================================================
    def test_face_enrolled_false_wins_over_is_face_enrolled_true(self):
        """face.enrolled=False thắng tuyệt đối ngay cả khi isFaceEnrolled=True."""
        svc = self._make_service()
        rng = np.random.RandomState(66)
        emb = rng.randn(128).tolist()
        desc = rng.randn(128).tolist()

        doc = {
            "_id": "id_conflict",
            "fullName": "Nguyen Van G",
            "employeeCode": "NV007",
            "isFaceEnrolled": True,   # schema cũ nói True
            "faceDescriptors": [desc],
            "face": {
                "enrolled": False,    # schema mới nói False → THẮNG
                "embedding": emb,
            },
        }
        svc.users_collection.find.return_value = [doc]
        success = svc.load_database_from_mongo()

        self.assertTrue(success)
        self.assertEqual(len(svc.known_encodings), 0,
                         "face.enrolled=False phải thắng isFaceEnrolled=True")

    # =========================================================================
    # 5. FAIL-CLOSED KHI MONGO KHÔNG KẾT NỐI
    # =========================================================================
    def test_fail_closed_when_mongo_disconnected(self):
        """Khi Mongo offline: danh bạ rỗng, không fallback encodings.pkl."""
        svc = self._make_service()
        svc.mongo_connected = False
        svc.users_collection = None
        svc.known_encodings = [np.ones(128)]

        with patch.object(svc, "load_database") as mock_pkl:
            result = svc.load_database_from_mongo()

        self.assertFalse(result)
        self.assertEqual(len(svc.known_encodings), 0)
        mock_pkl.assert_not_called()

    # =========================================================================
    # 6. EMPLOYEE_CODE TRUYỀN ĐÚNG QUA PIPELINE NHẬN DIỆN
    # =========================================================================
    def test_recognize_returns_employee_code_and_full_name(self):
        """recognize_faces_in_frame phải trả employee_code và full_name trong result dict."""
        svc = self._make_service()
        rng = np.random.RandomState(77)
        emb = rng.randn(128)

        svc.known_encodings = [emb]
        svc.known_names = ["mongo_id_XYZ"]
        svc.users_meta = {
            "mongo_id_XYZ": {
                "employee_code": "NV_XYZ",
                "full_name": "Phan Van Xyz",
                "name": "Phan Van Xyz",
            }
        }

        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)

        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[emb]), \
             patch("face_recognition.face_distance", return_value=np.array([0.25])):
            results = svc.recognize_faces_in_frame(fake_frame)

        self.assertEqual(len(results), 1)
        face = results[0]

        # Phải có employee_code và full_name trong kết quả
        self.assertIn("employee_code", face,
                      "Result phải chứa trường employee_code")
        self.assertIn("full_name", face,
                      "Result phải chứa trường full_name")
        self.assertEqual(face["employee_code"], "NV_XYZ")
        self.assertEqual(face["full_name"], "Phan Van Xyz")

    def test_recognize_unknown_face_returns_empty_employee_code(self):
        """Khuôn mặt không khớp: employee_code phải rỗng, name='Unknown'."""
        svc = self._make_service()
        svc.known_encodings = []
        svc.known_names = []
        svc.users_meta = {}

        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)

        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[np.zeros(128)]):
            results = svc.recognize_faces_in_frame(fake_frame)

        self.assertEqual(len(results), 1)
        face = results[0]
        self.assertFalse(face["is_match"])
        self.assertEqual(face["name"], "Unknown")
        self.assertEqual(face.get("employee_code", ""), "")

    # =========================================================================
    # 7. L2 NORMALIZATION & RAW-VS-NORMALIZED DISTANCE MISMATCH
    # =========================================================================
    def test_safe_l2_normalize_valid_and_invalid_vectors(self):
        """Kiểm tra hàm safe_l2_normalize lọc vector lỗi (zeros, nan, inf, sai chiều)."""
        from face_service import safe_l2_normalize

        # 1. Vector hợp lệ: norm sau chuẩn hóa = 1.0
        rng = np.random.RandomState(42)
        raw_vec = rng.randn(128) * 3.5  # raw unnormalized
        norm_vec = safe_l2_normalize(raw_vec)
        self.assertIsNotNone(norm_vec)
        self.assertAlmostEqual(float(np.linalg.norm(norm_vec)), 1.0, places=6)

        # 2. Vector all zero: phải reject trả về None
        zero_vec = np.zeros(128)
        self.assertIsNone(safe_l2_normalize(zero_vec))

        # 3. Vector chứa NaN hoặc Inf: phải reject
        nan_vec = np.ones(128)
        nan_vec[10] = np.nan
        self.assertIsNone(safe_l2_normalize(nan_vec))

        inf_vec = np.ones(128)
        inf_vec[20] = np.inf
        self.assertIsNone(safe_l2_normalize(inf_vec))

        # 4. Vector sai số chiều (không phải 128)
        short_vec = np.ones(64)
        self.assertIsNone(safe_l2_normalize(short_vec))

    def test_load_mongo_normalizes_and_rejects_bad_vectors(self):
        """load_database_from_mongo phải chuẩn hóa L2 reference và bỏ qua vector lỗi/zeros/inf."""
        svc = self._make_service()
        rng = np.random.RandomState(88)

        valid_raw = (rng.randn(128) * 2.0).tolist()
        bad_nan = np.ones(128)
        bad_nan[5] = np.nan
        bad_nan = bad_nan.tolist()
        zero_vec = [0.0] * 128

        doc_valid = {
            "_id": "user_valid",
            "fullName": "Le Van Hop Le",
            "employeeCode": "NV001",
            "face": {"enrolled": True, "embedding": valid_raw}
        }
        doc_bad_nan = {
            "_id": "user_nan",
            "fullName": "Tran Van Nan",
            "employeeCode": "NV002",
            "face": {"enrolled": True, "embedding": bad_nan}
        }
        doc_bad_zero = {
            "_id": "user_zero",
            "fullName": "Pham Van Zero",
            "employeeCode": "NV003",
            "face": {"enrolled": True, "embedding": zero_vec}
        }

        svc.users_collection.find.return_value = [doc_valid, doc_bad_nan, doc_bad_zero]
        success = svc.load_database_from_mongo()

        self.assertTrue(success)
        # Chỉ có doc_valid được nạp, hai doc lỗi bị reject
        self.assertEqual(len(svc.known_encodings), 1)
        self.assertEqual(len(svc.known_names), 1)
        self.assertEqual(svc.known_names[0], "user_valid")
        # Vector nạp vào phải có L2 norm == 1.0
        loaded_norm = np.linalg.norm(svc.known_encodings[0])
        self.assertAlmostEqual(float(loaded_norm), 1.0, places=6)

    def test_raw_query_vs_normalized_reference_distance_fixed(self):
        """
        Chứng minh bug mismatch raw dlib face_encoding vs normalized MongoDB embedding:
        Khi raw vector có norm != 1 (dlib encoding thường có norm ~2.0 - 2.5),
        khoảng cách Euclidean giữa raw query và normalized reference bị lệch xa (~1.1 > 0.40 tolerance).
        Khi cả hai được chuẩn hóa L2 an toàn, khoảng cách được đưa về đúng dải so khớp.
        """
        from face_service import safe_l2_normalize
        rng = np.random.RandomState(123)

        base_direction = rng.randn(128)
        base_direction = base_direction / np.linalg.norm(base_direction)

        # MongoDB lưu normalized embedding (norm = 1.0)
        mongo_embedding = base_direction.copy()

        # dlib raw face_encoding cùng một người nhưng chưa chuẩn hóa L2 (norm ~ 2.2)
        # thêm nhiễu nhỏ cùng hướng
        noise = rng.randn(128) * 0.05
        raw_dlib_query = (base_direction + noise) * 2.2

        # 1. Khoảng cách Euclidean thô giữa raw query và normalized DB:
        raw_dist = np.linalg.norm(raw_dlib_query - mongo_embedding)
        # Khoảng cách thô > 1.0 (vượt xa tolerance 0.40 -> Unknown!)
        self.assertGreater(raw_dist, 0.40, "Raw vs Normalized không chuẩn hóa chắc chắn bị lệch khoảng cách")

        # 2. Sau khi chuẩn hóa L2 an toàn cho query vector:
        from face_service import distance_to_confidence_percentage
        from config import MIN_MATCH_CONFIDENCE, TOLERANCE_THRESHOLD

        norm_query = safe_l2_normalize(raw_dlib_query)
        self.assertIsNotNone(norm_query)
        norm_dist = float(np.linalg.norm(norm_query - mongo_embedding))

        # Sau khi chuẩn hóa L2, khoảng cách được kéo giảm đáng kể so với raw_dist thô ban đầu (~1.2 -> ~0.467)
        self.assertLess(norm_dist, raw_dist, "Chuẩn hóa L2 phải cải thiện khoảng cách so với raw query")
        confidence = distance_to_confidence_percentage(norm_dist, TOLERANCE_THRESHOLD)
        # Độ chắc chắn (certainty/confidence) sau chuẩn hóa L2 được cải thiện vượt bậc so với 0% của raw_dist
        self.assertGreater(confidence, 0.0, "Confidence sau chuẩn hóa L2 phải được cải thiện dương")
        # Với khoảng cách ~0.467, confidence đạt ~44.4% (từng vượt ngưỡng cũ 40% nhưng nằm dưới ngưỡng mới 60%)
        # Test chứng minh khoảng cách/certainty được cải thiện rõ rệt nhưng không giả định sẽ match gate 60.0%
        self.assertLess(confidence, MIN_MATCH_CONFIDENCE, "Nhiễu khoảng cách ~0.467 không đạt gate 60.0% match")

    def test_recognize_faces_in_frame_normalizes_query_vector(self):
        """Kiểm tra recognize_faces_in_frame tự động L2 normalize query trước khi gọi face_distance."""
        svc = self._make_service()
        rng = np.random.RandomState(456)
        base_vec = rng.randn(128)
        norm_ref = base_vec / np.linalg.norm(base_vec)

        svc.known_encodings = [norm_ref]
        svc.known_names = ["user_001"]
        svc.users_meta = {
            "user_001": {
                "employee_code": "NV001",
                "full_name": "Nguyen Tien Dung",
                "name": "Nguyen Tien Dung",
            }
        }

        # Query raw có norm lớn (unnormalized dlib encoding)
        raw_query = base_vec * 3.0
        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)

        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[raw_query]), \
             patch("face_recognition.face_distance") as mock_dist:
            # Cho mock face_distance trả về 0.15 (match)
            mock_dist.return_value = np.array([0.15])
            results = svc.recognize_faces_in_frame(fake_frame)

            self.assertEqual(len(results), 1)
            # Đối số truyền vào mock_dist phải có norm = 1.0
            call_args = mock_dist.call_args[0]
            passed_query = call_args[1]
            self.assertAlmostEqual(float(np.linalg.norm(passed_query)), 1.0, places=6)


    def test_safe_l2_normalize_rejects_non_finite_norms_and_extreme_components(self):
        """safe_l2_normalize phải bác bỏ norm không hữu hạn và vector thành phần rất lớn gây overflow."""
        from face_service import safe_l2_normalize
        # 1. Vector có thành phần cực lớn (1e300) gây overflow khi tính bình phương
        huge_vec = np.ones(128, dtype=np.float64) * 1e300
        self.assertIsNone(safe_l2_normalize(huge_vec), "Vector thành phần rất lớn gây norm overflow phải bị reject")

        # 2. Vector có norm bằng 0 hoặc không hữu hạn
        zero_vec = [0.0] * 128
        self.assertIsNone(safe_l2_normalize(zero_vec))

    def test_compute_representative_embedding_admin_compatible(self):
        """compute_representative_embedding mean các vector raw hợp lệ rồi chuẩn hóa L2 một lần duy nhất."""
        from face_service import compute_representative_embedding, safe_l2_normalize

        rng = np.random.RandomState(42)
        v1 = rng.randn(128) * 1.5
        v2 = rng.randn(128) * 2.5
        v_bad_nan = np.ones(128)
        v_bad_nan[0] = np.nan
        v_bad_zero = np.zeros(128)

        # Thuật toán admin mong đợi:
        # Lọc bỏ v_bad_nan và v_bad_zero, mean(v1, v2) raw, sau đó safe_l2_normalize một lần
        expected_raw_mean = np.mean([v1, v2], axis=0)
        expected_norm = safe_l2_normalize(expected_raw_mean)
        expected_result = [round(float(x), 6) for x in expected_norm.tolist()]

        actual_result = compute_representative_embedding([v1, v_bad_nan, v2, v_bad_zero])
        self.assertIsNotNone(actual_result)
        self.assertEqual(actual_result, expected_result)

    def test_recognize_faces_in_frame_confidence_gate_behavior(self):
        """
        Kiểm tra hành vi thực tế của FaceService.recognize_faces_in_frame với mock:
        - Dưới 60% confidence: is_match = False, KHÔNG lộ employee_code / full_name.
        - Đúng 60.0% confidence: is_match = True, lộ employee_code / full_name.
        - Trên 60.0% confidence: is_match = True, lộ employee_code / full_name.
        - Kiểm tra query vector được L2-normalize trước khi so khớp.
        """
        from config import MIN_MATCH_CONFIDENCE, TOLERANCE_THRESHOLD
        self.assertEqual(MIN_MATCH_CONFIDENCE, 60.0)
        self.assertEqual(TOLERANCE_THRESHOLD, 0.40)

        svc = self._make_service()
        rng = np.random.RandomState(789)
        ref_vec = rng.randn(128)
        ref_vec = ref_vec / np.linalg.norm(ref_vec)

        svc.known_encodings = [ref_vec]
        svc.known_names = ["mongo_emp_001"]
        svc.users_meta = {
            "mongo_emp_001": {
                "employee_code": "NV_CONF_001",
                "full_name": "Nguyen Van Test",
                "name": "Nguyen Van Test",
            }
        }

        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        query_raw = rng.randn(128) * 2.0

        # Case 1: Dưới 60% (d = 0.36 -> confidence ~ 59.4% < 60.0%)
        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[query_raw]), \
             patch("face_recognition.face_distance") as mock_dist:
            mock_dist.return_value = np.array([0.36])
            results_below = svc.recognize_faces_in_frame(fake_frame)

            self.assertEqual(len(results_below), 1)
            res = results_below[0]
            self.assertLess(res["confidence"], 60.0)
            self.assertFalse(res["is_match"], "Dưới 60% phải bị từ chối")
            self.assertEqual(res["employee_code"], "", "Dưới 60% tuyệt đối không được lộ employee_code")
            self.assertEqual(res["full_name"], "Unknown", "Dưới 60% full_name phải là Unknown")
            self.assertEqual(res["name"], "Unknown", "Dưới 60% name phải là Unknown")

            # Kiểm tra query vector truyền vào face_distance đã được chuẩn hóa L2
            passed_query = mock_dist.call_args[0][1]
            self.assertAlmostEqual(float(np.linalg.norm(passed_query)), 1.0, places=6)

        # Case 2: Đúng 60.0% (với tolerance=0.40, d = 0.3576 -> confidence làm tròn đúng 60.0%)
        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[query_raw]), \
             patch("face_recognition.face_distance", return_value=np.array([0.3576])):
            results_exact = svc.recognize_faces_in_frame(fake_frame)

            self.assertEqual(len(results_exact), 1)
            res_exact = results_exact[0]
            self.assertEqual(res_exact["confidence"], 60.0)
            self.assertTrue(res_exact["is_match"], "Đúng 60.0% phải được nhận")
            self.assertEqual(res_exact["employee_code"], "NV_CONF_001")
            self.assertEqual(res_exact["full_name"], "Nguyen Van Test")

        # Case 3: Trên 60% (d = 0.35 -> confidence ~ 61.9% > 60.0%)
        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[query_raw]), \
             patch("face_recognition.face_distance", return_value=np.array([0.35])):
            results_above = svc.recognize_faces_in_frame(fake_frame)

            self.assertEqual(len(results_above), 1)
            res_above = results_above[0]
            self.assertGreater(res_above["confidence"], 60.0)
            self.assertTrue(res_above["is_match"], "Trên 60.0% phải được nhận")
            self.assertEqual(res_above["employee_code"], "NV_CONF_001")
            self.assertEqual(res_above["full_name"], "Nguyen Van Test")

    # =========================================================================
    # 8. IDENTITY AMBIGUITY GATE & MULTIPLE SAMPLES TESTS
    # =========================================================================
    def test_ambiguity_gate_rejects_close_competitors_even_with_high_confidence(self):
        """
        Kịch bản a: Best đạt >60% confidence nhưng top1 và top2 quá sát nhau
        (margin < 0.05 hoặc ratio > 0.80) -> reject/anonymize fail-closed.
        Không lộ full_name, employee_code; trả diagnostic không nhạy cảm.
        """
        from config import MIN_IDENTITY_DISTANCE_MARGIN, MAX_IDENTITY_DISTANCE_RATIO
        self.assertEqual(MIN_IDENTITY_DISTANCE_MARGIN, 0.05)
        self.assertEqual(MAX_IDENTITY_DISTANCE_RATIO, 0.80)

        svc = self._make_service()
        rng = np.random.RandomState(101)
        emb1 = rng.randn(128)
        emb2 = rng.randn(128)

        svc.known_encodings = [emb1, emb2]
        svc.known_names = ["user_id_1", "user_id_2"]
        svc.users_meta = {
            "user_id_1": {
                "employee_code": "NV014",
                "full_name": "Do Minh Duc",
                "name": "Do Minh Duc",
            },
            "user_id_2": {
                "employee_code": "NV015",
                "full_name": "Nguyen Van B",
                "name": "Nguyen Van B",
            },
        }

        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        fake_query = rng.randn(128)

        # best_dist = 0.20 (confidence ~ 87% > 60%), second_dist = 0.22
        # margin = 0.02 < 0.05 (vi phạm margin), ratio = 0.20 / 0.22 = 0.909 > 0.80 (vi phạm ratio)
        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[fake_query]), \
             patch("face_recognition.face_distance", return_value=np.array([0.20, 0.22])):
            results = svc.recognize_faces_in_frame(fake_frame)

        self.assertEqual(len(results), 1)
        res = results[0]

        # Phải reject và giấu danh tính tuyệt đối
        self.assertFalse(res["is_match"], "Top 1 và top 2 quá gần nhau phải reject")
        self.assertEqual(res["name"], "Unknown")
        self.assertEqual(res["full_name"], "Unknown")
        self.assertEqual(res["employee_code"], "")
        self.assertTrue(res["is_ambiguous"])

        # Diagnostics không nhạy cảm
        self.assertIsNotNone(res["second_best_distance"])
        self.assertIsNotNone(res["distance_margin"])
        self.assertIsNotNone(res["distance_ratio"])
        self.assertAlmostEqual(res["second_best_distance"], 0.22, places=3)
        self.assertAlmostEqual(res["distance_margin"], 0.02, places=3)
        self.assertAlmostEqual(res["distance_ratio"], 0.20 / 0.22, places=3)

    def test_ambiguity_gate_accepts_when_confidence_margin_ratio_all_pass(self):
        """
        Kịch bản b: Đủ confidence >= 60% + margin >= 0.05 + ratio <= 0.80
        -> accept đúng identity và lộ thông tin nhân sự.
        """
        svc = self._make_service()
        rng = np.random.RandomState(202)
        emb1 = rng.randn(128)
        emb2 = rng.randn(128)

        svc.known_encodings = [emb1, emb2]
        svc.known_names = ["user_id_1", "user_id_2"]
        svc.users_meta = {
            "user_id_1": {
                "employee_code": "NV014",
                "full_name": "Do Minh Duc",
                "name": "Do Minh Duc",
            },
            "user_id_2": {
                "employee_code": "NV015",
                "full_name": "Nguyen Van B",
                "name": "Nguyen Van B",
            },
        }

        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        fake_query = rng.randn(128)

        # best_dist = 0.20 (confidence ~ 87% > 60%), second_dist = 0.35
        # margin = 0.15 >= 0.05 (thỏa mãn), ratio = 0.20 / 0.35 = 0.571 <= 0.80 (thỏa mãn)
        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[fake_query]), \
             patch("face_recognition.face_distance", return_value=np.array([0.20, 0.35])):
            results = svc.recognize_faces_in_frame(fake_frame)

        self.assertEqual(len(results), 1)
        res = results[0]

        self.assertTrue(res["is_match"], "Đủ margin và ratio phải accept")
        self.assertFalse(res["is_ambiguous"])
        self.assertEqual(res["employee_code"], "NV014")
        self.assertEqual(res["full_name"], "Do Minh Duc")
        self.assertEqual(res["name"], "Do Minh Duc")
        self.assertAlmostEqual(res["second_best_distance"], 0.35, places=3)
        self.assertAlmostEqual(res["distance_margin"], 0.15, places=3)

    def test_multiple_samples_of_same_identity_do_not_self_compete(self):
        """
        Kịch bản c: Một người dùng có nhiều mẫu vector (ví dụ 3 mẫu).
        Khoảng cách tới các mẫu của cùng identity (0.20, 0.21, 0.22) không được coi là
        đối thủ cạnh tranh. Identity grouping phải lấy min(0.20) cho user1,
        và chỉ so sánh với identity thứ hai (user2 có dist 0.38).
        """
        svc = self._make_service()
        rng = np.random.RandomState(303)
        u1_s1 = rng.randn(128)
        u1_s2 = rng.randn(128)
        u1_s3 = rng.randn(128)
        u2_s1 = rng.randn(128)

        # 3 mẫu của user_id_1, 1 mẫu của user_id_2
        svc.known_encodings = [u1_s1, u1_s2, u1_s3, u2_s1]
        svc.known_names = ["user_id_1", "user_id_1", "user_id_1", "user_id_2"]
        svc.users_meta = {
            "user_id_1": {
                "employee_code": "NV014",
                "full_name": "Do Minh Duc",
                "name": "Do Minh Duc",
            },
            "user_id_2": {
                "employee_code": "NV015",
                "full_name": "Tran Van Competitor",
                "name": "Tran Van Competitor",
            },
        }

        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        fake_query = rng.randn(128)

        # Distances: user1 mẫu 1=0.20, mẫu 2=0.21, mẫu 3=0.22; user2 mẫu 1=0.38
        # Nếu không group identity, mẫu 2 (0.21) sẽ là second_dist làm margin=0.01 -> reject sai!
        # Khi group đúng: user1 min=0.20, user2 min=0.38 -> margin=0.18 >= 0.05, ratio=0.526 <= 0.80 -> accept!
        mock_dists = np.array([0.20, 0.21, 0.22, 0.38])
        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[fake_query]), \
             patch("face_recognition.face_distance", return_value=mock_dists):
            results = svc.recognize_faces_in_frame(fake_frame)

        self.assertEqual(len(results), 1)
        res = results[0]

        self.assertTrue(res["is_match"], "Nhiều sample cùng identity không được tự cạnh tranh")
        self.assertFalse(res["is_ambiguous"])
        self.assertEqual(res["employee_code"], "NV014")
        self.assertEqual(res["full_name"], "Do Minh Duc")
        self.assertAlmostEqual(res["second_best_distance"], 0.38, places=3)
        self.assertAlmostEqual(res["distance_margin"], 0.18, places=3)

    def test_below_confidence_rejects_regardless_of_margin(self):
        """
        Kịch bản d: Dưới 60% confidence vẫn phải reject, dù margin và ratio có tốt đến đâu.
        """
        svc = self._make_service()
        rng = np.random.RandomState(404)
        emb1 = rng.randn(128)
        emb2 = rng.randn(128)

        svc.known_encodings = [emb1, emb2]
        svc.known_names = ["user_id_1", "user_id_2"]
        svc.users_meta = {
            "user_id_1": {
                "employee_code": "NV014",
                "full_name": "Do Minh Duc",
                "name": "Do Minh Duc",
            },
            "user_id_2": {
                "employee_code": "NV015",
                "full_name": "Nguyen Van B",
                "name": "Nguyen Van B",
            },
        }

        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        fake_query = rng.randn(128)

        # best_dist = 0.42 (confidence ~ 48% < 60%), second_dist = 0.70
        # margin = 0.28 rất lớn, ratio = 0.60 rất nhỏ, nhưng confidence < 60% -> REJECT
        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[fake_query]), \
             patch("face_recognition.face_distance", return_value=np.array([0.42, 0.70])):
            results = svc.recognize_faces_in_frame(fake_frame)

        self.assertEqual(len(results), 1)
        res = results[0]

        self.assertFalse(res["is_match"], "Dưới 60% confidence phải reject dù margin lớn")
        self.assertEqual(res["name"], "Unknown")
        self.assertEqual(res["employee_code"], "")
        self.assertEqual(res["full_name"], "Unknown")

    def test_single_enrolled_identity_unaffected_by_ambiguity_gate(self):
        """
        Kịch bản e: CSDL chỉ có 1 known identity (không có đối thủ cạnh tranh).
        Chỉ kiểm tra absolute confidence gate như cũ, không bị block bởi ambiguity gate.
        second_best_distance, distance_margin, distance_ratio đều là None.
        """
        svc = self._make_service()
        rng = np.random.RandomState(505)
        emb1 = rng.randn(128)

        svc.known_encodings = [emb1]
        svc.known_names = ["user_id_solo"]
        svc.users_meta = {
            "user_id_solo": {
                "employee_code": "NV_SOLO",
                "full_name": "Solo User",
                "name": "Solo User",
            }
        }

        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        fake_query = rng.randn(128)

        # best_dist = 0.20 (confidence > 60%)
        with patch.object(svc, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[fake_query]), \
             patch("face_recognition.face_distance", return_value=np.array([0.20])):
            results = svc.recognize_faces_in_frame(fake_frame)

        self.assertEqual(len(results), 1)
        res = results[0]

        self.assertTrue(res["is_match"], "1 identity duy nhất đạt confidence phải match")
        self.assertEqual(res["employee_code"], "NV_SOLO")
        self.assertEqual(res["full_name"], "Solo User")
        self.assertFalse(res["is_ambiguous"])
        self.assertIsNone(res["second_best_distance"])
        self.assertIsNone(res["distance_margin"])
        self.assertIsNone(res["distance_ratio"])


if __name__ == "__main__":
    unittest.main()
