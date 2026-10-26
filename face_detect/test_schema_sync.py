# -*- coding: utf-8 -*-
"""
Test Suite: Schema Synchronization & Legacy Fallback for face_service.py
Kiểm thử tính tương thích schema users.face.embedding/fullName/employeeCode mới,
khả năng fallback dữ liệu cũ mà không mất dữ liệu, và nguyên tắc tránh ghi schema cũ khi sync ngược.
Chạy hoàn toàn độc lập mà không cần model AI lớn, MongoDB thật hay kết nối mạng.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Mock các thư viện thị giác nặng (cv2, face_recognition, ultralytics)
# nếu môi trường kiểm thử nhẹ chưa cài sẵn, đảm bảo chạy test khả thi độc lập
for mod_name in ("cv2", "face_recognition", "ultralytics"):
    if mod_name not in sys.modules:
        try:
            __import__(mod_name)
        except ImportError:
            sys.modules[mod_name] = MagicMock()

import numpy as np

# Thêm thư mục face_detect vào sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from face_service import (
    FaceService,
    normalize_search_name,
    compute_representative_embedding,
)


class TestSearchNameAndEmbedding(unittest.TestCase):
    def test_normalize_search_name(self):
        """Kiểm tra chuẩn hóa tên tiếng Việt không dấu (chuẩn User.searchName)"""
        self.assertEqual(normalize_search_name("Nguyễn Tiến Dũng"), "nguyen tien dung")
        self.assertEqual(normalize_search_name("Phạm Thị Lan"), "pham thi lan")
        self.assertEqual(normalize_search_name("Đặng Văn Lâm"), "dang van lam")
        self.assertEqual(normalize_search_name("Trần Đức Bo"), "tran duc bo")
        self.assertEqual(normalize_search_name(""), "")

    def test_compute_representative_embedding_l2_norm(self):
        """Kiểm tra vector đại diện 128-d chuẩn hóa L2 có độ dài đúng 128 và norm = 1.0"""
        # Tạo 5 vector ngẫu nhiên 128 chiều
        rng = np.random.RandomState(42)
        sample_vectors = [rng.randn(128) for _ in range(5)]

        rep = compute_representative_embedding(sample_vectors)
        self.assertIsNotNone(rep)
        self.assertEqual(len(rep), 128)

        # Tính L2 norm
        norm = np.linalg.norm(np.array(rep))
        self.assertAlmostEqual(norm, 1.0, places=4)


class TestFaceServiceSchemaSync(unittest.TestCase):
    def setUp(self):
        # Khởi tạo FaceService với mock để không gọi mạng hay load model nặng
        with patch.object(FaceService, "_init_yolo"), \
             patch.object(FaceService, "_init_anti_spoof"), \
             patch.object(FaceService, "_init_mongo"), \
             patch.object(FaceService, "load_database_from_mongo", return_value=False), \
             patch.object(FaceService, "load_database", return_value=True):
            self.service = FaceService()
            self.service.mongo_connected = True
            self.mock_collection = MagicMock()
            self.service.users_collection = self.mock_collection

    def test_load_database_from_mongo_both_schemas(self):
        """
        Kiểm tra load_database_from_mongo:
        - Đọc đúng schema mới: fullName, employeeCode, face.embedding (128-d)
        - Đọc đúng schema cũ (fallback): name, employeeId, faceDescriptors (128-d)
        Đảm bảo không làm mất dữ liệu của bất kỳ người dùng nào.
        """
        rng = np.random.RandomState(100)
        emb_new = rng.randn(128).tolist()
        emb_old = rng.randn(128).tolist()

        doc_new_schema = {
            "_id": "id_001",
            "fullName": "Nguyễn Tiến Dũng",
            "employeeCode": "NV002",
            "searchName": "nguyen tien dung",
            "department": "Kỹ thuật AI",
            "email": "dung@company.com",
            "face": {
                "enrolled": True,
                "embedding": emb_new,
                "sampleCount": 20,
            }
        }

        doc_old_schema = {
            "_id": "id_002",
            "name": "Trần Thị Cũ",
            "employeeId": "EMP-009",
            "isFaceEnrolled": True,
            "faceDescriptors": [emb_old],
            "department": "Văn phòng",
        }

        self.mock_collection.find.return_value = [doc_new_schema, doc_old_schema]

        with patch.object(self.service, "save_database", return_value=True):
            success = self.service.load_database_from_mongo()

        self.assertTrue(success)
        self.assertEqual(len(self.service.known_names), 2)
        # Khóa nội bộ là mongo_id để chống va chạm định danh
        self.assertIn("id_001", self.service.known_names)
        self.assertIn("id_002", self.service.known_names)

        # Kiểm tra metadata đã chuẩn hóa
        meta_new = self.service.users_meta.get("id_001")
        self.assertEqual(meta_new["employee_code"], "NV002")
        self.assertEqual(meta_new["full_name"], "Nguyễn Tiến Dũng")

        meta_old = self.service.users_meta.get("id_002")
        self.assertEqual(meta_old["employee_code"], "EMP-009")
        self.assertEqual(meta_old["full_name"], "Trần Thị Cũ")

        # Kiểm tra get_users_list hiển thị full_name từ metadata trong khi giữ khóa nội bộ
        users_list = self.service.get_users_list()
        self.assertEqual(len(users_list), 2)
        names = [u["name"] for u in users_list]
        self.assertIn("Nguyễn Tiến Dũng", names)
        self.assertIn("Trần Thị Cũ", names)
        user_ids = [u["id"] for u in users_list]
        self.assertIn("id_001", user_ids)
        self.assertIn("id_002", user_ids)

    def test_duplicate_name_separate_mongo_ids(self):
        """Kiểm tra hai nhân viên trùng tên nhưng khác mongo_id không bị ghi đè"""
        rng = np.random.RandomState(101)
        emb1 = rng.randn(128).tolist()
        emb2 = rng.randn(128).tolist()

        doc1 = {
            "_id": "id_user_A",
            "fullName": "Nguyễn Văn A",
            "employeeCode": "NV001",
            "face": {"enrolled": True, "embedding": emb1}
        }
        doc2 = {
            "_id": "id_user_B",
            "fullName": "Nguyễn Văn A",
            "employeeCode": "NV002",
            "face": {"enrolled": True, "embedding": emb2}
        }
        self.mock_collection.find.return_value = [doc1, doc2]
        with patch.object(self.service, "save_database", return_value=True):
            success = self.service.load_database_from_mongo()

        self.assertTrue(success)
        self.assertEqual(len(self.service.users_meta), 2)
        self.assertIn("id_user_A", self.service.users_meta)
        self.assertIn("id_user_B", self.service.users_meta)
        self.assertEqual(self.service.users_meta["id_user_A"]["employee_code"], "NV001")
        self.assertEqual(self.service.users_meta["id_user_B"]["employee_code"], "NV002")

        # get_users_list hiển thị cả 2 người cùng tên mà không mất ai
        user_list = self.service.get_users_list()
        self.assertEqual(len(user_list), 2)
        self.assertTrue(all(u["name"] == "Nguyễn Văn A" for u in user_list))

    def test_enrolled_false_ignored_even_with_embedding(self):
        """Kiểm tra khi face.enrolled=false thì bỏ qua hoàn toàn kể cả khi có embedding"""
        rng = np.random.RandomState(102)
        emb = rng.randn(128).tolist()

        doc_enrolled_false = {
            "_id": "id_disabled",
            "fullName": "Lê Bị Khóa",
            "employeeCode": "NV999",
            "face": {
                "enrolled": False,
                "embedding": emb
            }
        }
        self.mock_collection.find.return_value = [doc_enrolled_false]
        with patch.object(self.service, "save_database", return_value=True):
            success = self.service.load_database_from_mongo()

        self.assertTrue(success)
        self.assertEqual(len(self.service.known_encodings), 0)
        self.assertEqual(len(self.service.users_meta), 0)

    def test_no_mongo_writes_in_sync_local(self):
        """Kiểm tra sync_local_to_mongo: Tuyệt đối KHÔNG thực hiện bất kỳ lệnh ghi nào lên MongoDB (Read-Only)"""
        rng = np.random.RandomState(200)
        self.service.known_names = ["Nguyễn Tiến Dũng"]
        self.service.known_encodings = [rng.randn(128)]
        self.service.users_meta = {"Nguyễn Tiến Dũng": {"employee_code": "NV002"}}

        res = self.service.sync_local_to_mongo()
        self.assertFalse(res, "sync_local_to_mongo phải trả về False vì đã bị vô hiệu hóa")
        self.mock_collection.update_one.assert_not_called()
        self.mock_collection.insert_one.assert_not_called()
        self.mock_collection.delete_one.assert_not_called()

    def test_no_mongo_writes_in_register_user_mongo(self):
        """Kiểm tra register_user_mongo: Tuyệt đối KHÔNG ghi vào MongoDB users"""
        rng = np.random.RandomState(300)
        encs = [rng.randn(128)]

        res = self.service.register_user_mongo(
            name="Lê Văn Mới",
            encodings=encs,
            employee_id="NV025"
        )
        self.assertFalse(res, "register_user_mongo phải trả False vì Face AI không có quyền ghi CSDL")
        self.mock_collection.update_one.assert_not_called()
        self.mock_collection.insert_one.assert_not_called()

    def test_no_mongo_writes_in_delete_user(self):
        """Kiểm tra delete_user: Tuyệt đối KHÔNG được gọi delete_one trên MongoDB (bảo vệ hồ sơ nhân sự)"""
        self.service.users_meta = {"Nguyễn Tiến Dũng": {"employee_code": "NV002"}}
        self.service.known_names = ["Nguyễn Tiến Dũng"]
        self.service.known_encodings = [np.zeros(128)]

        res = self.service.delete_user("Nguyễn Tiến Dũng")
        self.assertTrue(res)
        # BẮT BUỘC KHÔNG ĐƯỢC XÓA MONGODB
        self.mock_collection.delete_one.assert_not_called()
        self.mock_collection.delete_many.assert_not_called()

    def test_fail_closed_when_mongo_empty(self):
        """
        Kiểm tra Fail-Closed khi MongoDB rỗng:
        - Không nạp bất kỳ vector nào (known_encodings rỗng)
        - TUYỆT ĐỐI KHÔNG fallback sang file encodings.pkl cục bộ
        - TUYỆT ĐỐI KHÔNG tự động sync local lên MongoDB
        """
        self.mock_collection.find.return_value = []  # DB rỗng

        # Giả lập trước đó có dữ liệu cũ trong RAM
        self.service.known_encodings = [np.ones(128)]
        self.service.known_names = ["Người Cũ"]
        self.service.users_meta = {"Người Cũ": {}}

        with patch.object(self.service, "load_database") as mock_load_pkl, \
             patch.object(self.service, "sync_local_to_mongo") as mock_sync:
            res = self.service.load_database_from_mongo()

            self.assertTrue(res)
            # Danh bạ nhận diện phải rỗng (Fail-Closed)
            self.assertEqual(len(self.service.known_encodings), 0)
            self.assertEqual(len(self.service.known_names), 0)
            self.assertEqual(len(self.service.users_meta), 0)

            # Không bao giờ fallback encodings.pkl hoặc sync local
            mock_load_pkl.assert_not_called()
            mock_sync.assert_not_called()

    def test_fail_closed_when_mongo_disconnected(self):
        """
        Kiểm tra Fail-Closed khi mất kết nối MongoDB:
        - Trả về False
        - known_encodings rỗng, tuyệt đối không dùng encodings.pkl
        """
        self.service.mongo_connected = False
        self.service.users_collection = None
        self.service.known_encodings = [np.ones(128)]

        with patch.object(self.service, "load_database") as mock_load_pkl:
            res = self.service.load_database_from_mongo()

            self.assertFalse(res)
            self.assertEqual(len(self.service.known_encodings), 0)
            self.assertEqual(len(self.service.known_names), 0)
            mock_load_pkl.assert_not_called()

    def test_recognition_fails_closed_when_database_empty(self):
        """
        Kiểm tra nhận diện Fail-Closed khi DB rỗng / không có embedding:
        Mọi khuôn mặt xuất hiện đều phải trả về is_match=False, confidence=0.0, name='Unknown'
        """
        self.service.known_encodings = []
        self.service.known_names = []
        self.service.users_meta = {}

        # Giả lập phát hiện 1 mặt
        fake_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        with patch.object(self.service, "detect_face_boxes", return_value=[(10, 90, 90, 10)]), \
             patch("face_recognition.face_encodings", return_value=[np.zeros(128)]):
            results = self.service.recognize_faces_in_frame(fake_frame)

            self.assertEqual(len(results), 1)
            self.assertFalse(results[0]["is_match"])
            self.assertEqual(results[0]["name"], "Unknown")
            self.assertEqual(results[0]["confidence"], 0.0)


if __name__ == "__main__":
    unittest.main()
