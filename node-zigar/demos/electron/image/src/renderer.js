const srcCanvas = document.getElementById('srcCanvas');
const dstCanvas = document.getElementById('dstCanvas');
const sizeInput = document.getElementById('sizeInput');
const intensityInput = document.getElementById('intensityInput');

window.electronAPI.onLoadImage(loadImage);
window.electronAPI.onSaveImage(saveImage);

sizeInput.oninput = () => changeImage();
intensityInput.oninput = () => changeImage();

async function loadImage(url) {
  const img = new Image;
  img.src = url;
  await img.decode();
  const bitmap = await createImageBitmap(img);
  srcCanvas.width = bitmap.width;
  srcCanvas.height = bitmap.height;
  const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  changeImage();
}

async function changeImage() {
  const srcCTX = srcCanvas.getContext('2d', { willReadFrequently: true });
  const srcImageData = srcCTX.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const params = {
    size: parseFloat(sizeInput.value),
    intensity: parseFloat(intensityInput.value),
  };
  // ImageData's width and height aren't enumerable for some reason and wouldn't appear
  // on the Node side if we pass srcImageData directly
  const src = {
    data: srcImageData.data,
    width: srcImageData.width,
    height: srcImageData.height,
  };
  const dst = await window.electronAPI.processImage(src, params);
  const dstImageData = new ImageData(dst.data, dst.width, dst.height);
  dstCanvas.width = dstImageData.width;
  dstCanvas.height = dstImageData.height;
  const dstCTX = dstCanvas.getContext('2d');
  dstCTX.putImageData(dstImageData, 0, 0);
}

async function saveImage(path, type) {
  const blob = await new Promise((resolve, reject) => {
    const callback = (result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Unable to encode image'));
      }
    };
    dstCanvas.toBlob(callback, type);
  });
  const buffer = await blob.arrayBuffer();
  await window.electronAPI.writeFile(path, buffer);
}
