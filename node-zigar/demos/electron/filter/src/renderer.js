const srcCanvas = document.getElementById('srcCanvas');
const dstCanvas = document.getElementById('dstCanvas');
const intensity = document.getElementById('intensity');

window.electronAPI.onLoadImage(loadImage);
window.electronAPI.onSaveImage(saveImage);

intensity.oninput = () => applyFilter();

async function loadImage(url) {
  const img = new Image;
  img.src = url;
  await img.decode();
  const bitmap = await createImageBitmap(img);
  srcCanvas.width = bitmap.width;
  srcCanvas.height = bitmap.height;
  const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  applyFilter();
}

async function applyFilter() {
  const srcCTX = srcCanvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = srcCanvas;
  const params = { intensity: parseFloat(intensity.value) };
  const srcImageData = srcCTX.getImageData(0, 0, width, height);
  const dstImageData = await createImageData(width, height, srcImageData, params);
  dstCanvas.width = width;
  dstCanvas.height = height;
  const dstCTX = dstCanvas.getContext('2d');
  dstCTX.putImageData(dstImageData, 0, 0);  
}

async function createImageData(width, height, source, params) {  
  const outputData = await window.electronAPI.filterImage(width, height, source.data, params);
  return new ImageData(outputData, width, height);
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
