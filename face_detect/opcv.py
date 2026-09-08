from pathlib import Path

import cv2
import face_recognition
import os

import test232
import detect
import numpy as np

pic_dir = Path(__file__).parent / 'pic'

images = []
classNames =[]
myList = os.listdir(pic_dir)

for cl in myList:
    curImg = cv2.imread(f'{pic_dir}/{cl}')
    images.append(curImg)
    classNames.append(os.path.splitext(cl)[0])

def encode_faces(images):
    encode_list = []
    for img in images:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        encode = face_recognition.face_encodings(img)[0]
        encode_list.append(encode)
    return encode_list


def capture_faces():
    camera = cv2.VideoCapture(0)
    while True:
        ret, frame = camera.read()
        if not ret:
            print("Camera bi loi")
        cv2.imshow("Camera", frame)

        if(cv2.waitKey(1) == ord("q")):
            name = input("Nhap ten: ")
            save_path = f"{pic_dir}/{name}.jpg"
            cv2.imwrite(save_path, frame)

            print("Da khoi tao doi tuong thanh cong!")
            break
    camera.release()
    cv2.destroyAllWindows()

def recognition():
    cap = cv2.VideoCapture(0)

    while True:
        ret, frame = cap.read()
        fram = cv2.resize(frame, (0, 0), None, 0.25, 0.25)
        fram = cv2.cvtColor(fram, cv2.COLOR_BGR2RGB)

        fram_locations = face_recognition.face_locations(fram)
        encode_fram = face_recognition.face_encodings(fram)

        for encodeFace, faceLoc in zip(encode_fram, fram_locations):
            matches = face_recognition.compare_faces(encodeListKnow, encodeFace)
            faceDis = face_recognition.face_distance(encodeListKnow, encodeFace)
            matchIndex = np.argmin(faceDis)

            if faceDis[0] < 0.50:
                name = classNames[matchIndex].upper()
            else:
                name = "Unknown"

            print(matchIndex)
            y1, x2, y2, x1 = faceLoc
            y1, x2, y2, x1 = y1 * 4, x2 * 4, y2 * 4, x1 * 4

            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, f"{name} - {round(faceDis[matchIndex], 2)}", (x1 + 6, y2 - 6), cv2.FONT_HERSHEY_COMPLEX, 1, (255, 255, 255), 2)

        cv2.imshow('Webcam', frame)
        if(cv2.waitKey(1) == ord('q')):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    while True:
        print("Chao mung den voi he thong cham cong V1")
        print("1. Tao doi tuong")
        print("2. Nhan dien doi tuong bang webcam")
        print("3. Nhan dien doi tuong bang yolo")
        print("4. Nhan dien nhanh doi tuong bang Yolo")
        choose = input("Vui long dua ra lua chon cua ban: ")
        if choose == "1":
            capture_faces()
        if choose == "2":
            encodeListKnow = encode_faces(images)
            print("Ma hoa khuon mat thanh cong")
            recognition()
        if choose == "3":
            detect.detect_face()
        if choose == "4":
            test232.detect_face_v2()
        if choose == "q":
            break

