/**
 * kioskCrop.js
 * Helper tính toán toạ độ và vùng cắt ảnh camera kiosk theo khung reticle hình oval.
 * Hỗ trợ video với CSS objectFit: 'cover' và mirror scaleX(-1).
 */

/**
 * Tính toạ độ cắt (source crop coordinates) từ boundingClientRect của video và reticle
 * trên khung hình gốc của video (videoWidth x videoHeight).
 *
 * @param {Object} params
 * @param {DOMRect|Object} params.videoRect - BoundingClientRect của phần tử <video>
 * @param {DOMRect|Object} params.reticleRect - BoundingClientRect của phần tử reticle nét đứt
 * @param {number} params.videoWidth - Chiều rộng thực của luồng video (video.videoWidth)
 * @param {number} params.videoHeight - Chiều cao thực của luồng video (video.videoHeight)
 * @returns {Object|null} { sx, sy, sWidth, sHeight } hoặc null nếu không hợp lệ
 */
export function calculateKioskCrop({ videoRect, reticleRect, videoWidth, videoHeight }) {
  if (!videoRect || !reticleRect || !videoWidth || !videoHeight) return null;
  if (videoRect.width <= 0 || videoRect.height <= 0 || videoWidth <= 0 || videoHeight <= 0) return null;
  if (reticleRect.width <= 0 || reticleRect.height <= 0) return null;

  // Tỷ lệ scale của object-fit: cover
  const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
  if (!scale || !isFinite(scale) || scale <= 0) return null;

  // Kích thước của nội dung video hiển thị trên viewport (sau khi scale cover)
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;

  // Phần bị cắt (clipping offset) của video trong viewport container
  const offsetX = (renderedWidth - videoRect.width) / 2;
  const offsetY = (renderedHeight - videoRect.height) / 2;

  // Vị trí tương đối của reticle so với mép container video
  const reticleLeftInContainer = reticleRect.left - videoRect.left;
  const reticleTopInContainer = reticleRect.top - videoRect.top;

  // Video được hiển thị với CSS transform: scaleX(-1) (mirror effect).
  // Do đó, pixel ở bên trái của màn hình (reticleLeftInContainer) tương ứng với
  // pixel ở bên phải của nội dung video chưa lật.
  // Khoảng cách từ mép phải của container video đến reticle:
  const reticleRightInContainer = videoRect.width - (reticleLeftInContainer + reticleRect.width);

  // Toạ độ reticle trên vùng hiển thị video (bao gồm phần offsetX/offsetY bị cover ẩn đi)
  const displayedX = reticleRightInContainer + offsetX;
  const displayedY = reticleTopInContainer + offsetY;

  // Quy đổi về toạ độ pixel gốc của luồng video
  let sx = displayedX / scale;
  let sy = displayedY / scale;
  let sWidth = reticleRect.width / scale;
  let sHeight = reticleRect.height / scale;

  // Giới hạn trong kích thước thực của video gốc (clamp)
  if (sx < 0) {
    sWidth += sx;
    sx = 0;
  }
  if (sy < 0) {
    sHeight += sy;
    sy = 0;
  }

  if (sx + sWidth > videoWidth) {
    sWidth = videoWidth - sx;
  }
  if (sy + sHeight > videoHeight) {
    sHeight = videoHeight - sy;
  }

  if (sWidth <= 0 || sHeight <= 0) return null;

  return {
    sx,
    sy,
    sWidth,
    sHeight,
  };
}

/**
 * Cắt và che vùng ngoài oval của khung reticle lên canvas đích.
 * Canvas được vẽ vùng hình ảnh bên trong oval, vùng 4 góc ngoài oval được tô màu đen.
 *
 * @param {HTMLVideoElement} video - Phần tử video nguồn
 * @param {HTMLCanvasElement} canvas - Phần tử canvas để render
 * @param {Object} crop - { sx, sy, sWidth, sHeight }
 * @param {number} [maxDimension=480] - Kích thước cạnh lớn tối đa để tránh upscale quá mức
 * @returns {boolean} true nếu vẽ thành công, false nếu lỗi/không hợp lệ
 */
export function drawOvalCroppedFrame(video, canvas, crop, maxDimension = 480) {
  if (!video || !canvas || !crop) return false;
  const { sx, sy, sWidth, sHeight } = crop;
  if (sWidth <= 0 || sHeight <= 0) return false;

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // Tính tỷ lệ canvas đích đủ cho Face AI, không upscale quá mức
  const aspect = sWidth / sHeight;
  let targetWidth;
  let targetHeight;

  if (sWidth >= sHeight) {
    targetWidth = Math.min(Math.round(sWidth), maxDimension);
    targetHeight = Math.max(1, Math.round(targetWidth / aspect));
  } else {
    targetHeight = Math.min(Math.round(sHeight), maxDimension);
    targetWidth = Math.max(1, Math.round(targetHeight * aspect));
  }

  // Đảm bảo kích thước tối thiểu cho AI model nhận diện
  if (targetWidth < 120 || targetHeight < 120) {
    const scaleUp = Math.max(120 / targetWidth, 120 / targetHeight);
    targetWidth = Math.round(targetWidth * scaleUp);
    targetHeight = Math.round(targetHeight * scaleUp);
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // 1. Tô toàn bộ canvas màu đen
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 2. Tạo đường dẫn clip dạng oval (ellipse) chính xác
  ctx.save();
  ctx.beginPath();
  const radiusX = targetWidth / 2;
  const radiusY = targetHeight / 2;
  ctx.ellipse(radiusX, radiusY, radiusX, radiusY, 0, 0, 2 * Math.PI);
  ctx.clip();

  // 3. Vẽ phần ảnh video đã crop vào bên trong oval.
  // Lưu ý: Vì video hiển thị ở Kiosk có transform scaleX(-1) (mirror effect),
  // người dùng nhìn thấy khuôn mặt như trong gương. Để ảnh chụp giống góc nhìn thực tế
  // hoặc thuận tiện cho AI (AI nhận diện khuôn mặt bình thường hoặc lật),
  // ta vẽ phần ảnh gốc sx, sy, sWidth, sHeight.
  // Nếu muốn giữ đúng hướng người dùng thấy trên màn hình:
  // Lật ngang ảnh khi vẽ để match với trải nghiệm camera selfie/mirror:
  ctx.translate(targetWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

  ctx.restore();
  return true;
}
