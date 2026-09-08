import cv2
from pathlib import Path
import face_recognition

pic_dir = Path(__file__).parent / "pic"

# =========================
# Đọc ảnh cần kiểm tra
# =========================
img_path = pic_dir / "20260907_170942_526249.jpg"
img = cv2.imread(str(img_path))

if img is None:
    print("Không đọc được ảnh:", img_path)
    exit()

img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


# =========================
# Đọc ảnh Dung
# =========================
comp_path = pic_dir / "Dung.jpg"
img_comp = cv2.imread(str(comp_path))

if img_comp is None:
    print("Không đọc được ảnh:", comp_path)
    exit()

img_comp = cv2.cvtColor(img_comp, cv2.COLOR_BGR2RGB)


# =========================
# Tìm khuôn mặt
# =========================
frame_loc = face_recognition.face_locations(img)
frame_comp_loc = face_recognition.face_locations(img_comp)

print("Khuôn mặt ảnh cần kiểm tra:", frame_loc)
print("Khuôn mặt ảnh Dung:", frame_comp_loc)


# Kiểm tra có tìm thấy mặt không
if len(frame_loc) == 0:
    print("Không tìm thấy khuôn mặt trong ảnh cần kiểm tra!")
    exit()

if len(frame_comp_loc) == 0:
    print("Không tìm thấy khuôn mặt trong ảnh Dung!")
    exit()


# =========================
# Encode khuôn mặt
# =========================
frame_en = face_recognition.face_encodings(img, frame_loc)
frame_comp_en = face_recognition.face_encodings(img_comp, frame_comp_loc)

if len(frame_en) == 0:
    print("Không encode được khuôn mặt ảnh cần kiểm tra!")
    exit()

if len(frame_comp_en) == 0:
    print("Không encode được khuôn mặt Dung!")
    exit()


# =========================
# So sánh
# =========================
matches = face_recognition.compare_faces(
    frame_comp_en,
    frame_en[0]
)

face_dis = face_recognition.face_distance(
    frame_comp_en,
    frame_en[0]
)

print("Matches:", matches)
print("Distance:", face_dis)


# =========================
# Lấy vị trí khuôn mặt Dung
# =========================
y1, x2, y2, x1 = frame_comp_loc[0]


# =========================
# Vẽ khung
# =========================
cv2.rectangle(
    img_comp,
    (x1, y1),
    (x2, y2),
    (0, 255, 0),
    2
)

cv2.putText(
    img_comp,
    f"Distance: {round(face_dis[0], 2)}",
    (x1 + 6, y2 - 6),
    cv2.FONT_HERSHEY_COMPLEX,
    1,
    (255, 255, 255),
    2
)


# =========================
# Hiển thị
# =========================
# img_comp đang là RGB -> đổi lại BGR để OpenCV hiển thị đúng màu
img_comp = cv2.cvtColor(img_comp, cv2.COLOR_RGB2BGR)

cv2.imshow("Test", img_comp)

while True:
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cv2.destroyAllWindows()
