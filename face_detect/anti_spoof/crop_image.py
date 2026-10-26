# -*- coding: utf-8 -*-
"""
Face Crop Utility for Anti-Spoofing (Silent-Face-Anti-Spoofing).
Crops multi-scale patches around the detected face bounding box.
"""

import cv2
import numpy as np
from typing import Tuple, Union, List


class CropImage:
    """
    Trích xuất patch khuôn mặt đa tỷ lệ (scale 2.7x, 4.0x) xung quanh tâm bounding box.
    Xử lý an toàn khi vùng crop chạm hoặc vượt mép ảnh (zero/clamp padding).
    """

    @staticmethod
    def _get_new_box(
        src_w: int,
        src_h: int,
        bbox: Union[List[int], Tuple[int, int, int, int]],
        scale: float
    ) -> Tuple[int, int, int, int]:
        """
        Tính toán tọa độ box mới theo scale mở rộng.
        bbox định dạng [x, y, w, h] (left, top, width, height).
        """
        x, y, box_w, box_h = bbox[:4]

        # Đảm bảo box_w, box_h > 0
        box_w = max(1, int(box_w))
        box_h = max(1, int(box_h))

        # Giới hạn scale tối đa không vượt quá viền ảnh
        max_scale_h = (src_h - 1) / box_h if box_h > 0 else scale
        max_scale_w = (src_w - 1) / box_w if box_w > 0 else scale
        effective_scale = min(max_scale_h, max_scale_w, scale)

        new_width = box_w * effective_scale
        new_height = box_h * effective_scale
        center_x = (box_w / 2.0) + x
        center_y = (box_h / 2.0) + y

        left_top_x = center_x - (new_width / 2.0)
        left_top_y = center_y - (new_height / 2.0)
        right_bottom_x = center_x + (new_width / 2.0)
        right_bottom_y = center_y + (new_height / 2.0)

        if left_top_x < 0:
            right_bottom_x -= left_top_x
            left_top_x = 0

        if left_top_y < 0:
            right_bottom_y -= left_top_y
            left_top_y = 0

        if right_bottom_x > src_w - 1:
            left_top_x -= (right_bottom_x - src_w + 1)
            right_bottom_x = src_w - 1

        if right_bottom_y > src_h - 1:
            left_top_y -= (right_bottom_y - src_h + 1)
            right_bottom_y = src_h - 1

        # Đảm bảo không bị âm sau khi dịch
        left_top_x = max(0, int(round(left_top_x)))
        left_top_y = max(0, int(round(left_top_y)))
        right_bottom_x = min(src_w - 1, int(round(right_bottom_x)))
        right_bottom_y = min(src_h - 1, int(round(right_bottom_y)))

        return left_top_x, left_top_y, right_bottom_x, right_bottom_y

    def crop(
        self,
        org_img: np.ndarray,
        bbox: Union[List[int], Tuple[int, int, int, int]],
        scale: float,
        out_w: int = 80,
        out_h: int = 80,
        crop: bool = True
    ) -> np.ndarray:
        """
        Cắt và resize vùng mặt từ ảnh gốc.
        Trả về ảnh numpy BGR kích thước (out_h, out_w, 3).
        """
        if org_img is None or org_img.size == 0:
            return np.zeros((out_h, out_w, 3), dtype=np.uint8)

        if not crop:
            return cv2.resize(org_img, (out_w, out_h), interpolation=cv2.INTER_LINEAR)

        src_h, src_w = org_img.shape[:2]
        x1, y1, x2, y2 = self._get_new_box(src_w, src_h, bbox, scale)

        if x2 <= x1 or y2 <= y1:
            # Fallback nếu box không hợp lệ
            return cv2.resize(org_img, (out_w, out_h), interpolation=cv2.INTER_LINEAR)

        cropped = org_img[y1 : y2 + 1, x1 : x2 + 1]
        if cropped.size == 0:
            return cv2.resize(org_img, (out_w, out_h), interpolation=cv2.INTER_LINEAR)

        return cv2.resize(cropped, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
