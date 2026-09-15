import os
import sys
import time
import threading
import warnings
from datetime import datetime
from typing import Tuple, Optional
import requests

# Tắt các cảnh báo không cần thiết từ thư viện nền tảng
warnings.filterwarnings("ignore", category=UserWarning)

import cv2
import numpy as np

from config import (
    CAMERA_INDEX,
    REGISTRATION_SAMPLES_COUNT,
    SAMPLE_INTERVAL_SECONDS,
    TOLERANCE_THRESHOLD,
    FRAME_SCALE,
    LEGACY_PIC_DIR,
    CHECKIN_CONFIDENCE_THRESHOLD,
    CHECKIN_HOLD_SECONDS,
    ATTENDANCE_FILE,
    CHECKIN_DIR,
    FACES_DIR
)
from face_service import FaceService


def draw_corner_rect(img, bbox, color, thickness=2, corner_length=20, corner_thickness=4):
    """
    Vẽ khung viền khuôn mặt phong cách hiện đại với các góc nổi bật (Corner Brackets)
    """
    top, right, bottom, left = bbox
    cv2.rectangle(img, (left, top), (right, bottom), color, thickness)

    # 4 Góc dày tạo điểm nhấn công nghệ
    # Góc trên - trái
    cv2.line(img, (left, top), (left + corner_length, top), color, corner_thickness)
    cv2.line(img, (left, top), (left, top + corner_length), color, corner_thickness)

    # Góc trên - phải
    cv2.line(img, (right, top), (right - corner_length, top), color, corner_thickness)
    cv2.line(img, (right, top), (right, top + corner_length), color, corner_thickness)

    # Góc dưới - trái
    cv2.line(img, (left, bottom), (left + corner_length, bottom), color, corner_thickness)
    cv2.line(img, (left, bottom), (left, bottom - corner_length), color, corner_thickness)

    # Góc dưới - phải
    cv2.line(img, (right, bottom), (right - corner_length, bottom), color, corner_thickness)
    cv2.line(img, (right, bottom), (right, bottom - corner_length), color, corner_thickness)


def draw_top_hud(frame, title: str, subtitle: str = ""):
    """Vẽ thanh tiêu đề HUD ở đỉnh màn hình"""
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 55), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    cv2.putText(frame, title, (15, 28), cv2.FONT_HERSHEY_DUPLEX, 0.75, (0, 255, 255), 2)
    if subtitle:
        cv2.putText(frame, subtitle, (15, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)


def draw_enrollment_progress(frame, current: int, total: int, instruction: str):
    """Vẽ thanh tiến độ và chỉ dẫn quét góc mặt ở dưới cùng màn hình khi đăng ký"""
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h - 70), (w, h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.8, frame, 0.2, 0, frame)

    bar_x = 20
    bar_y = h - 50
    bar_w = w - 40
    bar_h = 16
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (80, 80, 80), 2)

    progress = min(1.0, current / max(1, total))
    fill_w = int(bar_w * progress)
    cv2.rectangle(frame, (bar_x + 2, bar_y + 2), (bar_x + fill_w - 2, bar_y + bar_h - 2), (0, 215, 0), -1)

    percent_text = f"Tien do: {current}/{total} ({int(progress * 100)}%)"
    cv2.putText(frame, percent_text, (bar_x, bar_y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
    cv2.putText(frame, f"GOC QUET: {instruction}", (bar_x, h - 12), cv2.FONT_HERSHEY_DUPLEX, 0.55, (255, 255, 255), 1)


def draw_checkin_hold_bar(frame, name: str, elapsed: float, total: float, conf: float):
    """
    Vẽ thanh tiến độ đếm ngược giữ khuôn mặt liên tục 5 giây trên 90%
    """
    h, w = frame.shape[:2]
    bar_w = min(500, w - 80)
    bar_h = 16
    bar_x = (w - bar_w) // 2
    bar_y = h - 68

    overlay = frame.copy()
    cv2.rectangle(overlay, (bar_x - 12, bar_y - 30), (bar_x + bar_w + 12, bar_y + bar_h + 10), (10, 25, 10), -1)
    cv2.addWeighted(overlay, 0.8, frame, 0.2, 0, frame)

    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (80, 120, 80), 2)
    progress = min(1.0, elapsed / max(0.1, total))
    fill_w = int(bar_w * progress)
    cv2.rectangle(frame, (bar_x + 2, bar_y + 2), (bar_x + fill_w - 2, bar_y + bar_h - 2), (0, 230, 120), -1)

    text_info = f"DANG XAC THUC: [{name}] ({conf:.1f}%)"
    time_info = f"{elapsed:.1f}s / {total:.0f}s"
    cv2.putText(frame, text_info, (bar_x, bar_y - 10), cv2.FONT_HERSHEY_DUPLEX, 0.50, (0, 255, 120), 1, cv2.LINE_AA)
    cv2.putText(frame, time_info, (bar_x + bar_w - 75, bar_y - 10), cv2.FONT_HERSHEY_DUPLEX, 0.50, (255, 255, 255), 1, cv2.LINE_AA)


def get_registered_face_avatar(name: str) -> Optional[np.ndarray]:
    """Tìm ảnh mẫu khuôn mặt đã đăng ký của người dùng để làm ảnh đại diện (avatar)"""
    user_face_dir = FACES_DIR / name
    if user_face_dir.exists():
        # Ưu tiên lấy sample_01.jpg (ảnh góc trực diện)
        sample_01 = user_face_dir / "sample_01.jpg"
        if sample_01.exists():
            img = cv2.imread(str(sample_01))
            if img is not None:
                return img

        # Nếu không có sample_01 thì lấy bất kỳ ảnh mẫu nào có trong thư mục
        samples = sorted(list(user_face_dir.glob("sample_*.jpg")))
        if samples:
            img = cv2.imread(str(samples[0]))
            if img is not None:
                return img

    # Fallback kiểm tra trong thư mục pic/ cũ nếu có
    for ext in [".jpg", ".jpeg", ".png"]:
        pic_file = LEGACY_PIC_DIR / f"{name}{ext}"
        if pic_file.exists():
            img = cv2.imread(str(pic_file))
            if img is not None:
                return img

    return None


def draw_checkin_success_modal(frame, name: str, confidence: float, time_str: str):
    """
    Vẽ bảng thông báo Chấm công Thành công trên màn hình đứng yên (Freeze Frame).
    Bao gồm hình ảnh khuôn mặt đã đăng ký ở góc phải của bảng.
    """
    h, w = frame.shape[:2]

    # Phủ lớp tối toàn màn hình
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, h), (10, 20, 10), -1)
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)

    # Lấy ảnh đại diện đã đăng ký của người dùng
    avatar = get_registered_face_avatar(name)

    # Thẻ thông báo trung tâm
    card_w = min(620, w - 40)
    card_h = 250
    card_x = (w - card_w) // 2
    card_y = (h - card_h) // 2

    # Nền thẻ
    cv2.rectangle(frame, (card_x, card_y), (card_x + card_w, card_y + card_h), (25, 32, 25), -1)
    # Viền xanh công nghệ
    cv2.rectangle(frame, (card_x, card_y), (card_x + card_w, card_y + card_h), (0, 220, 100), 3)
    draw_corner_rect(frame, (card_y, card_x + card_w, card_y + card_h, card_x), (0, 255, 120), thickness=3, corner_length=25, corner_thickness=5)

    # Tiêu đề biểu ngữ xanh đậm
    cv2.rectangle(frame, (card_x + 3, card_y + 3), (card_x + card_w - 3, card_y + 50), (0, 140, 0), -1)
    cv2.putText(frame, "[V] CHAM CONG THANH CONG!", (card_x + 30, card_y + 36),
                cv2.FONT_HERSHEY_DUPLEX, 0.85, (255, 255, 255), 2, cv2.LINE_AA)

    # VẼ HÌNH KHUÔN MẶT ĐĂNG KÝ Ở GÓC PHẢI THẺ
    if avatar is not None:
        avatar_w = 100
        avatar_h = 110
        avatar_x = card_x + card_w - avatar_w - 25
        avatar_y = card_y + 68

        # Khung viền và dán ảnh avatar
        cv2.rectangle(frame, (avatar_x - 3, avatar_y - 3), (avatar_x + avatar_w + 3, avatar_y + avatar_h + 3), (0, 220, 100), 2)
        avatar_resized = cv2.resize(avatar, (avatar_w, avatar_h), interpolation=cv2.INTER_AREA)
        frame[avatar_y:avatar_y + avatar_h, avatar_x:avatar_x + avatar_w] = avatar_resized

        # Nhãn chú thích nhỏ dưới ảnh
        label_text = "ANH DANG KY"
        cv2.putText(frame, label_text, (avatar_x + 5, avatar_y + avatar_h + 18),
                    cv2.FONT_HERSHEY_DUPLEX, 0.40, (0, 255, 120), 1, cv2.LINE_AA)

    # Thông tin chi tiết bên trái
    start_y = card_y + 92
    spacing = 34

    cv2.putText(frame, f"Nhan vien : {name}", (card_x + 30, start_y),
                cv2.FONT_HERSHEY_DUPLEX, 0.65, (255, 255, 255), 1, cv2.LINE_AA)

    cv2.putText(frame, f"Thoi gian : {time_str}", (card_x + 30, start_y + spacing),
                cv2.FONT_HERSHEY_SIMPLEX, 0.56, (200, 240, 200), 1, cv2.LINE_AA)

    cv2.putText(frame, f"Do tin cay: {confidence:.1f}% (Giu 5s tren 90%)", (card_x + 30, start_y + spacing * 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 120), 1, cv2.LINE_AA)

    # Đường kẻ phân cách & Chỉ dẫn
    cv2.line(frame, (card_x + 20, card_y + card_h - 40), (card_x + card_w - 20, card_y + card_h - 40), (60, 90, 60), 1)
    cv2.putText(frame, "Man hinh da khoa tai thoi diem nay. Nhan phim bat ky de quay lai...",
                (card_x + 30, card_y + card_h - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (190, 190, 190), 1, cv2.LINE_AA)


def _send_to_mern_api(name: str, confidence: float, snap_path_str: str = ""):
    """Gửi dữ liệu điểm danh sang MERN Backend (Port 5000) qua luồng ngầm (non-blocking)"""
    try:
        url = "http://localhost:5000/api/attendance"
        payload = {
            "userName": name,
            "confidence": round(confidence, 1),
            "checkInType": "Check-in",
            "snapshotUrl": snap_path_str
        }
        res = requests.post(url, json=payload, timeout=2.0)
        if res.status_code == 201:
            print(f"[*] [MERN Sync] Da dong bo diem danh '{name}' vao CSDL MongoDB.")
    except Exception:
        # Nếu backend chưa chạy thì bỏ qua nhẹ nhàng, không làm gián đoạn camera
        pass


def log_attendance(name: str, confidence: float, time_str: str, frame: Optional[np.ndarray] = None):
    """Ghi nhật ký chấm công vào file attendance.csv, lưu ảnh minh chứng và đồng bộ MERN Stack"""
    is_new = not ATTENDANCE_FILE.exists()
    try:
        with open(ATTENDANCE_FILE, "a", encoding="utf-8") as f:
            if is_new:
                f.write("Thoi gian,Ten nhan vien,Do tin cay (%)\n")
            f.write(f"{time_str},{name},{confidence:.1f}%\n")
    except Exception as e:
        print(f"[!] Lỗi khi ghi log điểm danh: {e}")

    snap_path_str = ""
    if frame is not None:
        try:
            safe_name = name.replace(" ", "_")
            snap_time = datetime.now().strftime("%Y%m%d_%H%M%S")
            snap_path = CHECKIN_DIR / f"{safe_name}_{snap_time}.jpg"
            cv2.imwrite(str(snap_path), frame)
            snap_path_str = str(snap_path)
        except Exception:
            pass

    # Kích hoạt gửi sang MERN API trong luồng ngầm
    threading.Thread(
        target=_send_to_mern_api,
        args=(name, confidence, snap_path_str),
        daemon=True
    ).start()


class FaceApp:
    def __init__(self):
        self.service = FaceService()

    def run_menu(self):
        while True:
            print("\n" + "=" * 55)
            print("       HE THONG NHAN DIEN & XAC THUC KHUON MAT")
            print("=" * 55)
            engine = "YOLOv11 Face + dlib ResNet" if self.service.yolo_model is not None else "dlib HOG + ResNet"
            print(f"[*] Cong nghe AI: {engine}")
            user_count = len(self.service.users_meta)
            print(f"[*] So nguoi dung hien co trong CSDL: {user_count}")
            print(f"[*] Co che cham cong: Giu >={CHECKIN_CONFIDENCE_THRESHOLD:.0f}% trong {CHECKIN_HOLD_SECONDS:.0f}s de khoa man hinh")
            print("-" * 55)
            print("1. Dang ky khuon mat moi (Hoc da goc do qua Webcam)")
            print("2. Xac thuc / Diem danh cham cong qua Webcam")
            print("3. Xem danh sach nguoi dung da dang ky")
            print("4. Xoa du lieu nguoi dung")
            print("5. Import anh co san tu thu muc pic/")
            print("6. Thoat chuong trinh")
            print("=" * 55)

            try:
                choice = input(">> Nhap lua chon cua ban (1-6): ").strip()
            except (KeyboardInterrupt, EOFError):
                print("\n\n[+] Da thoat chuong trinh. Tam biet!")
                break

            if choice == "1":
                self.enroll_user()
            elif choice == "2":
                self.recognize_live()
            elif choice == "3":
                self.list_users()
            elif choice == "4":
                self.delete_user()
            elif choice == "5":
                self.import_legacy_photos()
            elif choice == "6" or choice.lower() == "q":
                print("\n[+] Cam on ban da su dung chuong trinh. Tam biet!")
                break
            else:
                print("[!] Lua chon khong hop le, vui long thu lai.")

    def enroll_user(self):
        """Chức năng 1: Quét và học nhiều góc mặt của người dùng"""
        print("\n" + "-" * 50)
        print("   DANG KY KHUON MAT MOI (HOC DA GOC DO)")
        print("-" * 50)
        name = input("Nhap ten nguoi dung can dang ky: ").strip()
        if not name:
            print("[!] Ten khong duoc de trong!")
            return

        if name in self.service.users_meta:
            confirm = input(f"[?] Nguoi dung '{name}' da co trong he thong. Ban co muon quet de cap nhat lai khong? (y/n): ").strip().lower()
            if confirm not in ["y", "yes", "dong y"]:
                print("[*] Da huy thao tac.")
                return

        cap = cv2.VideoCapture(CAMERA_INDEX)
        if not cap.isOpened():
            print("[!] Khong the mo Webcam. Vui long kiem tra lai ket noi camera!")
            return

        print(f"\n[*] Dang khoi dong camera...")
        print("[*] Vui long di chuyen mat theo cac huong dan tren man hinh.")
        print("[*] Nhan 'Q' hoac 'ESC' tren cua so camera de huy.")

        collected_encodings = []
        collected_images = []
        last_sample_time = 0.0

        window_name = f"Dang Ky Khuon Mat - {name}"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

        stages = [
            (0.25, "1. Nhin THANG truc dien vao camera"),
            (0.50, "2. Nghieng nhe mat sang ben TRAI"),
            (0.75, "3. Nghieng nhe mat sang ben PHAI"),
            (1.00, "4. Hoi NGUA len / CUI nhe / Cuoi tu nhien")
        ]

        try:
            while len(collected_encodings) < REGISTRATION_SAMPLES_COUNT:
                ret, frame = cap.read()
                if not ret:
                    print("[!] Khong doc duoc frame tu Webcam!")
                    break

                frame = cv2.flip(frame, 1)
                display_frame = frame.copy()

                progress = len(collected_encodings) / REGISTRATION_SAMPLES_COUNT
                current_instruction = stages[-1][1]
                for threshold, instr in stages:
                    if progress < threshold:
                        current_instruction = instr
                        break

                face_loc, encoding, status = self.service.detect_single_face_for_enrollment(frame)

                now = time.time()
                is_valid = face_loc is not None and encoding is not None

                if is_valid:
                    top, right, bottom, left = face_loc
                    draw_corner_rect(display_frame, (top, right, bottom, left), (0, 255, 0), thickness=2)

                    if now - last_sample_time >= SAMPLE_INTERVAL_SECONDS:
                        collected_encodings.append(encoding)
                        margin = 20
                        h, w = frame.shape[:2]
                        crop_top = max(0, top - margin)
                        crop_bottom = min(h, bottom + margin)
                        crop_left = max(0, left - margin)
                        crop_right = min(w, right + margin)
                        crop_img = frame[crop_top:crop_bottom, crop_left:crop_right]
                        if crop_img.size > 0:
                            collected_images.append(crop_img)

                        last_sample_time = now
                        cv2.rectangle(display_frame, (left, top), (right, bottom), (255, 255, 255), 4)

                    cv2.putText(display_frame, "Mat hop le - Giu yen...", (left, top - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)
                else:
                    cv2.putText(display_frame, status, (30, 80),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

                draw_top_hud(display_frame, f"DANG KY: {name.upper()}", "Di chuyen nhe mat theo huong dan | Nhan 'Q' de huy")
                draw_enrollment_progress(display_frame, len(collected_encodings), REGISTRATION_SAMPLES_COUNT, current_instruction)

                cv2.imshow(window_name, display_frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == 27:
                    print("\n[*] Nguoi dung da huy thao tac dang ky.")
                    return

            print(f"\n[+] Da thu thap du {REGISTRATION_SAMPLES_COUNT} mau goc mat! Dang luu du lieu...")
            
            overlay = display_frame.copy()
            cv2.rectangle(overlay, (0, 0), (display_frame.shape[1], display_frame.shape[0]), (0, 100, 0), -1)
            cv2.addWeighted(overlay, 0.7, display_frame, 0.3, 0, display_frame)
            cv2.putText(display_frame, "DANG KY THANH CONG!", (60, display_frame.shape[0] // 2),
                        cv2.FONT_HERSHEY_DUPLEX, 1.1, (255, 255, 255), 2)
            cv2.imshow(window_name, display_frame)
            cv2.waitKey(1200)

            success = self.service.register_user(name, collected_encodings, collected_images)
            if success:
                print(f"[+] DANG KY THANH CONG!")
                print(f"[+] Da luu {len(collected_encodings)} vector dac trung vao file encodings.pkl cho nguoi dung '{name}'.")
            else:
                print(f"[!] Co loi xay ra khi luu du lieu!")

        finally:
            cap.release()
            cv2.destroyAllWindows()

    def recognize_live(self):
        """
        Chức năng 2: Xác thực & Điểm danh chấm công qua Webcam
        - Nếu tỷ lệ nhận diện >= 90% liên tục trong 5 giây:
          -> Tự động dừng quay camera
          -> Giữ nguyên màn hình tại thời điểm đó (Freeze Screen)
          -> Hiển thị bảng 'CHẤM CÔNG THÀNH CÔNG!'
          -> Lưu log vào data/attendance.csv
        """
        if len(self.service.known_encodings) == 0:
            print("\n[!] Co so du lieu dang trong! Vui long dang ky khuon mat truoc (Chon 1).")
            return

        cap = cv2.VideoCapture(CAMERA_INDEX)
        if not cap.isOpened():
            print("[!] Khong the mo Webcam!")
            return

        print("\n" + "-" * 55)
        print("   XAC THUC & DIEM DANH CHAM CONG QUA WEBCAM")
        print("-" * 55)
        print(f"[*] Yeu cau: Giu mat tren {CHECKIN_CONFIDENCE_THRESHOLD:.0f}% trong {CHECKIN_HOLD_SECONDS:.0f}s lien tuc.")
        print("[*] Nhan 'Q' hoac 'ESC' tren cua so camera de thoat.")
        print("[*] Nhan 'S' de chup luu frame anh hien tai.")

        window_name = "Diem Danh Cham Cong - Webcam"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

        process_this_frame = True
        current_results = []
        prev_time = time.time()
        fps = 0.0

        # Trạng thái theo dõi chuỗi điểm danh liên tục 5 giây
        streak_user = None
        streak_start_time = None
        streak_last_confidence = 0.0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("[!] Khong doc duoc frame tu Webcam!")
                    break

                frame = cv2.flip(frame, 1)

                curr_time = time.time()
                time_diff = curr_time - prev_time
                if time_diff > 0:
                    fps = 0.9 * fps + 0.1 * (1.0 / time_diff)
                prev_time = curr_time

                if process_this_frame:
                    current_results = self.service.recognize_faces_in_frame(
                        frame,
                        tolerance=TOLERANCE_THRESHOLD,
                        scale=FRAME_SCALE
                    )
                process_this_frame = not process_this_frame

                display_frame = frame.copy()

                # Tìm xem có khuôn mặt nào đạt >= 90% VÀ ĐÃ XÁC THỰC LÀ NGƯỜI THẬT (is_real == True)
                qualified_face = None
                has_spoof_face = False
                for res in current_results:
                    if not res.get("is_real", True):
                        has_spoof_face = True
                    elif res["is_match"] and res["confidence"] >= CHECKIN_CONFIDENCE_THRESHOLD:
                        qualified_face = res
                        break

                # Cập nhật chuỗi giữ liên tục 5 giây (Bị reset ngay lập tức nếu là ảnh giả)
                hold_elapsed = 0.0
                if qualified_face is not None:
                    target_name = qualified_face["name"]
                    target_conf = qualified_face["confidence"]

                    if streak_user == target_name:
                        hold_elapsed = time.time() - streak_start_time
                    else:
                        streak_user = target_name
                        streak_start_time = time.time()
                        hold_elapsed = 0.0

                    streak_last_confidence = target_conf
                else:
                    # Bị ngắt quãng, < 90% hoặc phát hiện giả mạo -> reset lại chuỗi
                    streak_user = None
                    streak_start_time = None
                    streak_last_confidence = 0.0
                    hold_elapsed = 0.0

                # Vẽ bounding box và nhãn trạng thái Anti-Spoofing cho mọi khuôn mặt
                for res in current_results:
                    top, right, bottom, left = res["box"]
                    name = res["name"]
                    confidence = res["confidence"]
                    is_match = res["is_match"]
                    is_real = res.get("is_real", True)
                    liveness = res.get("liveness_score", 100.0)
                    spoof_type = res.get("spoof_type", "real")

                    if not is_real:
                        # CẢNH BÁO GIẢ MẠO: Màu đỏ rực rỡ
                        box_color = (0, 0, 255)
                        type_str = "ANH IN" if spoof_type == "print_attack" else "MAN HINH"
                        label = f"[!] GIA MAO ({type_str}) - {liveness:.0f}% LIVE"
                    elif is_match:
                        # Người thật đã đăng ký: Màu xanh lá công nghệ
                        if name == streak_user and confidence >= CHECKIN_CONFIDENCE_THRESHOLD:
                            box_color = (0, 255, 100)
                        else:
                            box_color = (0, 220, 0)
                        label = f"{name} ({confidence:.1f}% | LIVE: {liveness:.0f}%)"
                    else:
                        # Người thật nhưng chưa đăng ký: Màu vàng cam
                        box_color = (0, 180, 255)
                        label = f"Unknown ({confidence:.1f}% | LIVE: {liveness:.0f}%)"

                    draw_corner_rect(display_frame, (top, right, bottom, left), box_color, thickness=2)

                    label_w = max(140, len(label) * 11)
                    label_h = 28
                    label_top = max(0, top - label_h - 4)

                    sub_img = display_frame[label_top:label_top + label_h, left:left + label_w]
                    if sub_img.shape[0] == label_h and sub_img.shape[1] == label_w:
                        color_rect = np.full_like(sub_img, box_color)
                        cv2.addWeighted(color_rect, 0.85, sub_img, 0.15, 0, sub_img)
                        display_frame[label_top:label_top + label_h, left:left + label_w] = sub_img
                    else:
                        cv2.rectangle(display_frame, (left, label_top), (left + label_w, label_top + label_h), box_color, -1)

                    cv2.putText(
                        display_frame,
                        label,
                        (left + 6, label_top + 20),
                        cv2.FONT_HERSHEY_DUPLEX,
                        0.52,
                        (255, 255, 255),
                        1,
                        cv2.LINE_AA
                    )

                # Nếu đang duy trì >= 90%, vẽ thanh tiến độ 5s
                if streak_user is not None and hold_elapsed > 0:
                    draw_checkin_hold_bar(display_frame, streak_user, hold_elapsed, CHECKIN_HOLD_SECONDS, streak_last_confidence)

                # Kiểm tra điều kiện: ĐÃ ĐẠT ĐỦ 5 GIÂY LIÊN TỤC TRÊN 90% VÀ LÀ NGƯỜI THẬT
                if streak_user is not None and hold_elapsed >= CHECKIN_HOLD_SECONDS:
                    # 1. NGAY LẬP TỨC GIẢI PHÓNG CAMERA ĐỂ DỪNG QUAY
                    cap.release()

                    # 2. GIỮ NGUYÊN MÀN HÌNH TẠI THỜI ĐIỂM NÀY (FREEZE FRAME)
                    freeze_frame = display_frame.copy()
                    now_str = datetime.now().strftime("%H:%M:%S - %d/%m/%Y")
                    
                    # 3. VẼ BẢNG THÔNG BÁO CHẤM CÔNG THÀNH CÔNG TRÊN FRAME ĐÓ
                    draw_checkin_success_modal(freeze_frame, streak_user, streak_last_confidence, now_str)
                    
                    # 4. LƯU VÀO NHẬT KÝ ATTENDANCE.CSV
                    log_attendance(streak_user, streak_last_confidence, now_str, frame)

                    # 5. HIỂN THỊ MÀN HÌNH KHÓA TẠI THỜI ĐIỂM ĐÓ VÀ ĐỢI BẤM PHÍM
                    cv2.imshow(window_name, freeze_frame)

                    print("\n" + "*" * 60)
                    print(f"[+] >>> CHẤM CÔNG THÀNH CÔNG: {streak_user} <<<")
                    print(f"[*] Thời gian: {now_str}")
                    print(f"[*] Độ chính xác: {streak_last_confidence:.1f}% (Xác thực Liveness Người Thật)")
                    print("[*] Màn hình cv2 đang được giữ nguyên tại thời điểm chấm công.")
                    print("[*] Vui lòng nhấn phím bất kỳ trên bàn phím để quay về Menu...")
                    print("*" * 60)

                    # Giữ nguyên màn hình cho đến khi người dùng bấm phím bất kỳ
                    try:
                        cv2.waitKey(0)
                    except KeyboardInterrupt:
                        pass
                    cv2.destroyAllWindows()
                    return

                # Vẽ HUD trên cùng
                hud_sub = f"FPS: {fps:.1f} | Giu >=90% & LIVE 5s de cham cong | 'Q': Thoat"
                if has_spoof_face:
                    hud_sub = "CANH BAO: Phat hien khuon mat gia mao (Spoof Attack)!"
                draw_top_hud(
                    display_frame,
                    "HE THONG NHAN DIEN (YOLOv11 + MiniFASNet Liveness)",
                    hud_sub
                )


                cv2.imshow(window_name, display_frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == 27:
                    break
                elif key == ord('s'):
                    save_name = f"snapshot_{int(time.time())}.jpg"
                    cv2.imwrite(save_name, frame)
                    print(f"[*] Da luu anh chup: {save_name}")

        finally:
            cap.release()
            cv2.destroyAllWindows()

    def list_users(self):
        """Chức năng 3: Liệt kê người dùng đã đăng ký"""
        users = self.service.get_users_list()
        print("\n" + "=" * 65)
        print("             DANH SACH NGUOI DUNG DA DANG KY")
        print("=" * 65)
        if not users:
            print("  (Chua co nguoi dung nao duoc dang ky)")
        else:
            print(f"{'STT':<5} | {'Ten nguoi dung':<20} | {'So mau goc':<12} | {'Ngay dang ky':<20}")
            print("-" * 65)
            for idx, u in enumerate(users, 1):
                print(f"{idx:<5} | {u['name']:<20} | {u['sample_count']:<12} | {u['registered_at']:<20}")
        print("=" * 65)

    def delete_user(self):
        """Chức năng 4: Xóa người dùng"""
        self.list_users()
        users = self.service.get_users_list()
        if not users:
            return

        name = input("\nNhap ten nguoi dung muon xoa: ").strip()
        if not name:
            return

        confirm = input(f"[?] Ban co chac chan muon xoa nguoi dung '{name}' khong? (y/n): ").strip().lower()
        if confirm in ["y", "yes", "dong y"]:
            if self.service.delete_user(name):
                print(f"[+] Da xoa thanh cong nguoi dung '{name}'!")
            else:
                print(f"[!] Khong tim thay nguoi dung co ten '{name}'!")
        else:
            print("[*] Da huy thao tac xoa.")

    def import_legacy_photos(self):
        """Chức năng 5: Nhập dữ liệu từ thư mục pic/"""
        print("\n[*] Dang quet va nap anh tu thu muc pic/...")
        count = self.service.import_legacy_pic_folder()
        print(f"[+] Da import them {count} nguoi dung tu thu muc pic/ vao co so du lieu.")


if __name__ == "__main__":
    app = FaceApp()
    app.run_menu()
