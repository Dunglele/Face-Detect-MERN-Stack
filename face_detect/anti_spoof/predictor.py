# -*- coding: utf-8 -*-
"""
AntiSpoofPredictor: Ensemble Face Anti-Spoofing Inference Engine using MiniFASNet.
Part of Face-Detect-MERN-Stack.
"""

import os
import sys
import time
import urllib.request
from collections import OrderedDict
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional, Union

import cv2
import numpy as np
import torch
import torch.nn.functional as F

from .mini_fasnet import MODEL_MAPPING
from .crop_image import CropImage

# URLs download trọng số mô hình chuẩn từ Silent-Face-Anti-Spoofing
DEFAULT_MODELS = [
    {
        "filename": "2.7_80x80_MiniFASNetV2.pth",
        "url": "https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/master/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth",
        "scale": 2.7,
        "width": 80,
        "height": 80,
        "model_type": "MiniFASNetV2",
    },
    {
        "filename": "4_0_0_80x80_MiniFASNetV1SE.pth",
        "url": "https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/master/resources/anti_spoof_models/4_0_0_80x80_MiniFASNetV1SE.pth",
        "scale": 4.0,
        "width": 80,
        "height": 80,
        "model_type": "MiniFASNetV1SE",
    },
]


def _get_kernel(height: int, width: int) -> Tuple[int, int]:
    return ((height + 15) // 16, (width + 15) // 16)


class AntiSpoofPredictor:
    """
    Bộ suy luận Anti-Spoofing đa mô hình MiniFASNet.
    Tải sẵn weights vào RAM 1 lần duy nhất, hỗ trợ CPU / CUDA.
    """

    def __init__(
        self,
        models_dir: Optional[Union[str, Path]] = None,
        device: Optional[str] = None,
        threshold: float = 0.85,
        auto_download: bool = True
    ):
        if models_dir is None:
            models_dir = Path(__file__).resolve().parent.parent / "models" / "anti_spoof"
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)

        self.threshold = threshold
        self.cropper = CropImage()
        self.models: List[Dict[str, Any]] = []

        # Cấu hình thiết bị tính toán
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        if auto_download:
            self._ensure_models_exist()

        self._load_models()

    def is_ready(self) -> bool:
        """Kiểm tra xem ít nhất 1 mô hình đã được nạp sẵn sàng chưa"""
        return len(self.models) > 0

    def _ensure_models_exist(self):
        """Tự động tải các file weights .pth nếu chưa có trên máy"""
        for m_cfg in DEFAULT_MODELS:
            target_path = self.models_dir / m_cfg["filename"]
            if not target_path.exists() or target_path.stat().st_size < 100000:
                print(f"[*] Đang tải mô hình Anti-Spoofing '{m_cfg['filename']}'...")
                try:
                    req = urllib.request.Request(
                        m_cfg["url"],
                        headers={"User-Agent": "Mozilla/5.0"}
                    )
                    with urllib.request.urlopen(req, timeout=30) as resp, open(target_path, "wb") as f:
                        f.write(resp.read())
                    print(f"[+] Tải thành công: {m_cfg['filename']} ({target_path.stat().st_size // 1024} KB)")
                except Exception as e:
                    print(f"[!] Lỗi khi tải mô hình {m_cfg['filename']}: {e}")
                    if target_path.exists():
                        try:
                            target_path.unlink()
                        except Exception:
                            pass

    def _load_models(self):
        """Nạp tất cả file mô hình MiniFASNet trong thư mục models_dir"""
        self.models.clear()

        # Quét các file .pth trong thư mục
        pth_files = list(self.models_dir.glob("*.pth"))
        if not pth_files:
            print(f"[!] Cảnh báo: Không tìm thấy file trọng số MiniFASNet nào tại '{self.models_dir}'")
            return

        for pth_path in pth_files:
            file_name = pth_path.name
            matched_cfg = next((c for c in DEFAULT_MODELS if c["filename"] == file_name), None)

            if matched_cfg:
                model_type = matched_cfg["model_type"]
                scale = matched_cfg["scale"]
                w_in = matched_cfg["width"]
                h_in = matched_cfg["height"]
            else:
                # Phân tích theo quy tắc đặt tên: scale_heightxwidth_modelType.pth
                try:
                    parts = file_name.replace(".pth", "").split("_")
                    scale = float(parts[0])
                    dim_str = parts[1]
                    h_in, w_in = [int(x) for x in dim_str.split("x")]
                    model_type = parts[-1]
                except Exception:
                    scale = 2.7
                    w_in, h_in = 80, 80
                    model_type = "MiniFASNetV2"

            if model_type not in MODEL_MAPPING:
                print(f"[!] Bỏ qua mô hình không rõ kiểu kiến trúc: {model_type} ({file_name})")
                continue

            try:
                kernel_size = _get_kernel(h_in, w_in)
                net = MODEL_MAPPING[model_type](conv6_kernel=kernel_size).to(self.device)

                # Nạp state_dict an toàn (xử lý DataParallel module. prefix nếu có)
                state_dict = torch.load(str(pth_path), map_location=self.device)
                if any(k.startswith("module.") for k in state_dict.keys()):
                    new_sd = OrderedDict()
                    for k, v in state_dict.items():
                        new_key = k[7:] if k.startswith("module.") else k
                        new_sd[new_key] = v
                    state_dict = new_sd

                net.load_state_dict(state_dict)
                net.eval()

                self.models.append({
                    "name": file_name,
                    "net": net,
                    "scale": scale,
                    "w": w_in,
                    "h": h_in,
                    "type": model_type,
                })
                print(f"[*] Đã nạp thành công mô hình Anti-Spoofing: {file_name} (Scale {scale}x, Device: {self.device})")
            except Exception as e:
                print(f"[!] Không thể nạp mô hình {file_name}: {e}")

    def predict(
        self,
        frame: np.ndarray,
        bbox: Union[Tuple[int, int, int, int], List[int]],
        bbox_format: str = "xyxy"
    ) -> Dict[str, Any]:
        """
        Dự đoán tính xác thực khuôn mặt (Liveness Detection).
        
        Tham số:
        - frame: Ảnh OpenCV BGR (H, W, 3)
        - bbox: Tọa độ bounding box
          + Nếu bbox_format == "top_right_bottom_left" hoặc "yxyx": (top, right, bottom, left)
          + Nếu bbox_format == "xywh": [x, y, w, h]
          + Nếu bbox_format == "xyxy": [x1, y1, x2, y2]
        
        Trả về dictionary:
        - is_real: bool (True: người thật, False: giả mạo ảnh in/màn hình)
        - liveness_score: float (% xác suất người thật 0.0 -> 100.0%)
        - liveness_status: str ("REAL" | "SPOOF")
        - spoof_type: str ("real" | "print_attack" | "replay_attack")
        """
        if frame is None or frame.size == 0 or not self.models:
            return {
                "is_real": True,
                "liveness_score": 100.0,
                "liveness_status": "REAL",
                "spoof_type": "real",
                "real_prob": 1.0,
                "note": "Anti-spoofing not active or frame empty",
            }

        # Chuyển đổi định dạng bbox về [x, y, w, h] chuẩn cho cropper
        if bbox_format in ("top_right_bottom_left", "trbl"):
            top, right, bottom, left = bbox
            x, y = int(left), int(top)
            w, h = int(right - left), int(bottom - top)
        elif bbox_format == "xyxy":
            x1, y1, x2, y2 = bbox
            x, y = int(x1), int(y1)
            w, h = int(x2 - x1), int(y2 - y1)
        else:
            x, y, w, h = [int(v) for v in bbox[:4]]

        # Kiểm tra tính hợp lệ của box
        if w <= 5 or h <= 5:
            return {
                "is_real": False,
                "liveness_score": 0.0,
                "liveness_status": "SPOOF",
                "spoof_type": "unknown",
                "real_prob": 0.0,
            }

        total_probs = np.zeros(3, dtype=np.float32)

        with torch.no_grad():
            for m_info in self.models:
                net = m_info["net"]
                scale = m_info["scale"]
                target_w = m_info["w"]
                target_h = m_info["h"]

                # 1. Cắt patch theo tỷ lệ scale của mô hình
                patch = self.cropper.crop(
                    frame,
                    bbox=[x, y, w, h],
                    scale=scale,
                    out_w=target_w,
                    out_h=target_h,
                    crop=True
                )

                # 2. Chuyển sang PyTorch Tensor BGR [0, 1]
                tensor = torch.from_numpy(patch.transpose((2, 0, 1))).float().div(255.0)
                tensor = tensor.unsqueeze(0).to(self.device)

                # 3. Suy luận Softmax
                output = net(tensor)
                probs = F.softmax(output, dim=1).cpu().numpy()[0]
                total_probs += probs[:3]

        # Tính trung bình kết quả các mô hình (Ensemble)
        avg_probs = total_probs / float(len(self.models))
        score_print = float(avg_probs[0])
        score_real = float(avg_probs[1])
        score_replay = float(avg_probs[2])

        pred_label = int(np.argmax(avg_probs))
        is_real = bool(pred_label == 1 and score_real >= self.threshold)
        liveness_score = round(score_real * 100.0, 1)

        if is_real:
            spoof_type = "real"
            status_str = "REAL"
        else:
            status_str = "SPOOF"
            spoof_type = "print_attack" if score_print >= score_replay else "replay_attack"

        return {
            "is_real": is_real,
            "liveness_score": liveness_score,
            "liveness_status": status_str,
            "spoof_type": spoof_type,
            "real_prob": round(score_real, 4),
            "details": {
                "label": pred_label,
                "print_score": round(score_print, 4),
                "real_score": round(score_real, 4),
                "replay_score": round(score_replay, 4),
                "models_count": len(self.models),
            },
        }
