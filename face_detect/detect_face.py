from pathlib import Path

import cv2
import face_recognition
import os

import test232
import numpy as np

pic_dir = Path(__file__).parent / 'pic'

images = []
classNames = []
myList = os.listdir(pic_dir)

for cl in myList:
    img = cv2.imread(f'{pic_dir}/{cl}')
    images.append(img)
    classNames.append(os.path.splitext(cl)[0])

def encode_faces(images):
    encode_list = []
    for img in images:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        encode = face_recognition.face_encodings(img)[0]
        encode_list.append(encode)
    return encode_list

def recog():
    # Ma hoa anh dau vao
    face_one = test232.detect_face_v2()
    cur_img = cv2.imread(face_one)
    
    fram = cv2.resize(cur_img, (0, 0), None, 0.25, 0.25)
    fram = cv2.cvtColor(cur_img, cv2.COLOR_BGR2RGB)

    fram_loc = face_recognition.face_locations(fram)
    encode_fram = face_recognition.face_encodings(fram)

    encodeListKnow = encode_faces(images)

    for encode in encodeListKnow:
        matches = face_recognition.compare_faces(encode, encode_fram)
        faceDis = face_recognition.face_distance(encode, encode_fram)
        matchIndex = np.argmin(faceDis)

        if faceDis < 0.5:
            name = classNames[matchIndex].upper()
        else:
            name = "unknow"

    print(fram_loc)
    y1, x2, y2, x1 = fram_loc
    y1, x2, y2, x1 = y1 * 4, x2 * 4, y2 * 4, x1 * 4


    cv2.rectangle(fram, (x1, y1), (x2, y2), (0, 255, 0), 2)
    cv2.putText(fram, f"{name} - {round(faceDis[matchIndex], 2)}", (x1 + 6, y2 - 6), cv2.FONT_HERSHEY_COMPLEX, 1, (255, 255, 255), 2)
    cv2.imshow("Result", fram)

    if cv2.waitKey(1) == ord("q"):
        cv2.destroyAllWindows()

if __name__ == "__main__":
    recog()