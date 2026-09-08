from pathlib import Path
import cv2
from ultralytics import YOLO
from datetime import datetime


def detect_face_v2():
    
    pic_dir = Path(__file__).parent / 'pic'
    # Load model YOLO nhận diện khuôn mặt
    model = YOLO("models/yolov11n-face.pt")

    # Mở webcam
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Khong the mo webcam!")
        exit()

    print("Webcam dang chay...")
    print("Nhan Q de thoat.")

    match = 0
    obj_face = ""

    while True:
        ret, frame = cap.read()

        if not ret:
            print("Khong doc duoc frame tu webcam!")
            break

        # YOLO nhận diện khuôn mặt
        results = model(frame, conf=0.7, verbose=False)
        for result in results:
            confidence = float(result.boxes.conf[0])
            conf = float(confidence)
            # Chup va luu anh co conf > 0.7
            if conf >= 0.7:
                # fram = cv2.resize(frame, (0, 0), None, 0.25, 0.25)
                name = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                save_path = f"{pic_dir}/{name}.jpg"
                obj_face = save_path
                cv2.imwrite(save_path, frame)
                match = 1
                break
            if match == 1: break
        if match == 1: break
                    
    # Giải phóng webcam
    cap.release()
    cv2.destroyAllWindows()

    print("Da luu doi tuong, va thoat chuong trinh.")
    return obj_face