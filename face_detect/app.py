import os
import sys
import time
import warnings
from typing import Tuple

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
    LEGACY_PIC_DIR
)
from face_service import FaceService


def draw_corner_rect(img, bbox, color, thickness=2, corner_length=20, corner_thickness=4):
    """
    Vẽ khung viền khuôn mặt phong cách hiện đại với các góc nổi bật (Corner Brackets)
    """
    top, right, bottom, left = bbox
    # Khung chính mỏng
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
    # Dải nền đen mờ phía trên
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 55), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    cv2.putText(frame, title, (15, 28), cv2.FONT_HERSHEY_DUPLEX, 0.75, (0, 255, 255), 2)
    if subtitle:
        cv2.putText(frame, subtitle, (15, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)


def draw_enrollment_progress(frame, current: int, total: int, instruction: str):
    """Vẽ thanh tiến độ và chỉ dẫn quét góc mặt ở dưới cùng màn hình"""
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h - 70), (w, h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.8, frame, 0.2, 0, frame)

    # Thanh tiến trình
    bar_x = 20
    bar_y = h - 50
    bar_w = w - 40
    bar_h = 16
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (80, 80, 80), 2)

    progress = min(1.0, current / max(1, total))
    fill_w = int(bar_w * progress)
    cv2.rectangle(frame, (bar_x + 2, bar_y + 2), (bar_x + fill_w - 2, bar_y + bar_h - 2), (0, 215, 0), -1)

    # Hiển thị thông số
    percent_text = f"Tien do: {current}/{total} ({int(progress * 100)}%)"
    cv2.putText(frame, percent_text, (bar_x, bar_y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

    # Hướng dẫn góc mặt
    cv2.putText(frame, f"GOC QUET: {instruction}", (bar_x, h - 12), cv2.FONT_HERSHEY_DUPLEX, 0.55, (255, 255, 255), 1)


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
            print("-" * 55)
            print("1. Dang ky khuon mat moi (Hoc da goc do qua Webcam)")
            print("2. Xac thuc / Nhan dien nguoi dung qua Webcam")
            print("3. Xem danh sach nguoi dung da dang ky")
            print("4. Xoa du lieu nguoi dung")
            print("5. Import anh co san tu thu muc pic/")
            print("6. Thoat chuong trinh")
            print("=" * 55)

            choice = input(">> Nhap lua chon cua ban (1-6): ").strip()

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

        # Danh sách các giai đoạn hướng dẫn theo tiến độ
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

                # Lật gương frame để người dùng nhìn tự nhiên như soi gương
                frame = cv2.flip(frame, 1)
                display_frame = frame.copy()

                # Xác định hướng dẫn hiện tại
                progress = len(collected_encodings) / REGISTRATION_SAMPLES_COUNT
                current_instruction = stages[-1][1]
                for threshold, instr in stages:
                    if progress < threshold:
                        current_instruction = instr
                        break

                # Kiểm tra khuôn mặt trong khung hình
                face_loc, encoding, status = self.service.detect_single_face_for_enrollment(frame)

                now = time.time()
                is_valid = face_loc is not None and encoding is not None

                if is_valid:
                    # Đang có đúng 1 khuôn mặt hợp lệ
                    top, right, bottom, left = face_loc
                    draw_corner_rect(display_frame, (top, right, bottom, left), (0, 255, 0), thickness=2)

                    # Đủ khoảng thời gian nghỉ giữa 2 mẫu để đổi góc
                    if now - last_sample_time >= SAMPLE_INTERVAL_SECONDS:
                        collected_encodings.append(encoding)
                        # Lưu ảnh mẫu mặt phóng to nhẹ
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
                        # Hiệu ứng chớp sáng báo đã chụp mẫu thành công
                        cv2.rectangle(display_frame, (left, top), (right, bottom), (255, 255, 255), 4)

                    cv2.putText(display_frame, "Mat hop le - Giu yen...", (left, top - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)
                else:
                    # Không hợp lệ (không thấy mặt hoặc nhiều mặt)
                    cv2.putText(display_frame, status, (30, 80),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

                # Vẽ thanh HUD đỉnh và thanh tiến trình đáy
                draw_top_hud(display_frame, f"DANG KY: {name.upper()}", "Di chuyen nhe mat theo huong dan | Nhan 'Q' de huy")
                draw_enrollment_progress(display_frame, len(collected_encodings), REGISTRATION_SAMPLES_COUNT, current_instruction)

                cv2.imshow(window_name, display_frame)

                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == 27:
                    print("\n[*] Nguoi dung da huy thao tac dang ky.")
                    return

            # Khi đã thu thập đủ mẫu
            print(f"\n[+] Da thu thap du {REGISTRATION_SAMPLES_COUNT} mau goc mat! Dang luu du lieu...")
            
            # Hiển thị thông báo thành công trên màn hình camera
            overlay = display_frame.copy()
            cv2.rectangle(overlay, (0, 0), (display_frame.shape[1], display_frame.shape[0]), (0, 100, 0), -1)
            cv2.addWeighted(overlay, 0.7, display_frame, 0.3, 0, display_frame)
            cv2.putText(display_frame, "DANG KY THANH CONG!", (60, display_frame.shape[0] // 2),
                        cv2.FONT_HERSHEY_DUPLEX, 1.1, (255, 255, 255), 2)
            cv2.imshow(window_name, display_frame)
            cv2.waitKey(1200)

            # Lưu vào cơ sở dữ liệu
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
        """Chức năng 2: Xác thực khuôn mặt thời gian thực qua Webcam"""
        if len(self.service.known_encodings) == 0:
            print("\n[!] Co so du lieu dang trong! Vui long dang ky khuon mat truoc (Chon 1).")
            return

        cap = cv2.VideoCapture(CAMERA_INDEX)
        if not cap.isOpened():
            print("[!] Khong the mo Webcam!")
            return

        print("\n" + "-" * 50)
        print("   XAC THUC & NHAN DIEN KHUON MAT THOI GIAN THUC")
        print("-" * 50)
        print("[*] Nhan 'Q' hoac 'ESC' tren cua so camera de tro ve menu.")
        print("[*] Nhan 'S' de chup luu lai frame anh hien tai.")

        window_name = "Xac Thuc Khuon Mat - Webcam"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

        process_this_frame = True
        current_results = []
        prev_time = time.time()
        fps = 0.0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("[!] Khong doc duoc frame tu Webcam!")
                    break

                # Lật gương để hiển thị tự nhiên
                frame = cv2.flip(frame, 1)

                # Tính toán FPS
                curr_time = time.time()
                time_diff = curr_time - prev_time
                if time_diff > 0:
                    fps = 0.9 * fps + 0.1 * (1.0 / time_diff)
                prev_time = curr_time

                # Xử lý nhận diện xen kẽ các frame để camera đạt 30+ FPS siêu mượt
                if process_this_frame:
                    current_results = self.service.recognize_faces_in_frame(
                        frame,
                        tolerance=TOLERANCE_THRESHOLD,
                        scale=FRAME_SCALE
                    )
                process_this_frame = not process_this_frame

                display_frame = frame.copy()

                # Vẽ bounding box và nhãn tên + tỷ lệ %
                for res in current_results:
                    top, right, bottom, left = res["box"]
                    name = res["name"]
                    confidence = res["confidence"]
                    is_match = res["is_match"]

                    if is_match:
                        # Trùng khớp: Màu xanh lá cây
                        box_color = (0, 220, 0)
                        label = f"{name} ({confidence:.1f}%)"
                    else:
                        # Không xác định: Màu đỏ / cam
                        box_color = (0, 80, 255)
                        label = f"Unknown ({confidence:.1f}%)"

                    # Vẽ khung viền bo góc hiện đại
                    draw_corner_rect(display_frame, (top, right, bottom, left), box_color, thickness=2)

                    # Vẽ thanh nhãn hiển thị tên và phần trăm
                    label_w = max(130, len(label) * 11)
                    label_h = 28
                    label_top = max(0, top - label_h - 4)
                    
                    # Nền mờ cho nhãn
                    sub_img = display_frame[label_top:label_top + label_h, left:left + label_w]
                    if sub_img.shape[0] == label_h and sub_img.shape[1] == label_w:
                        color_rect = np.full_like(sub_img, box_color)
                        cv2.addWeighted(color_rect, 0.85, sub_img, 0.15, 0, sub_img)
                        display_frame[label_top:label_top + label_h, left:left + label_w] = sub_img
                    else:
                        cv2.rectangle(display_frame, (left, label_top), (left + label_w, label_top + label_h), box_color, -1)

                    # Chữ nhãn
                    cv2.putText(
                        display_frame,
                        label,
                        (left + 6, label_top + 20),
                        cv2.FONT_HERSHEY_DUPLEX,
                        0.55,
                        (255, 255, 255),
                        1,
                        cv2.LINE_AA
                    )

                # Vẽ HUD trên cùng kèm FPS
                draw_top_hud(
                    display_frame,
                    "HE THONG NHAN DIEN (YOLO + Face Recognition)",
                    f"FPS: {fps:.1f} | Nhan 'Q' de thoat | Nhan 'S' de chup anh"
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
