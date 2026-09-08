import cv2
from ultralytics import YOLO

def detect_face():

    # Load model YOLO nhận diện khuôn mặt
    model = YOLO("models/yolov11n-face.pt")

    # Mở webcam
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Khong the mo webcam!")
        exit()

    print("Webcam dang chay...")
    print("Nhan Q de thoat.")

    while True:
        ret, frame = cap.read()

        if not ret:
            print("Khong doc duoc frame tu webcam!")
            break

        # YOLO nhận diện khuôn mặt
        results = model(frame, conf=0.5, verbose=False)

        # Vẽ khung quanh khuôn mặt
        for result in results:
            boxes = result.boxes

            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                confidence = float(box.conf[0])

                # Vẽ khung
                cv2.rectangle(
                    frame,
                    (x1, y1),
                    (x2, y2),
                    (0, 255, 0),
                    2
                )

                # Hiển thị độ chính xác
                text = f"Face: {confidence:.2f}"

                cv2.putText(
                    frame,
                    text,
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )

        # Hiển thị webcam
        cv2.imshow("YOLO Face Detection - OpenCV", frame)

        # Nhấn Q để thoát
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    # Giải phóng webcam
    cap.release()
    cv2.destroyAllWindows()

    print("Da thoat chuong trinh.")