const { writeFile } = require('fs/promises');
const { resolve } = require('path');
const { pathToFileURL } = require('url');
require('node-zigar/cjs');
const { createOutput } = require('./lib/sepia.zigar');

const isMac = process.platform === 'darwin'

nw.Window.open('./src/index.html', { width: 800, height: 600, x: 10, y: 10 }, (browser) => {
  // handle menu click
  const onOpenClick = () => {
    const { window: { document } } = browser;
    document.getElementById('fileOpen').click();
  };
  const onSaveClick = () => {
    const { window: { document } } = browser;
    document.getElementById('fileSave').click(); 
  };
  const onCloseClick = () => {
    browser.close();
  };
  // create menu bar
  const menuBar = new nw.Menu({ type: 'menubar' });
  const fileMenu = new nw.Menu();
  fileMenu.append(new nw.MenuItem({ label: 'Open', click: onOpenClick }));
  fileMenu.append(new nw.MenuItem({ label: 'Save', click: onSaveClick }));
  fileMenu.append(new nw.MenuItem({ type: 'separator' }));
  fileMenu.append(new nw.MenuItem({ label: (isMac) ? 'Close' : 'Quit', click: onCloseClick }));
  menuBar.append(new nw.MenuItem({ label: 'File', submenu: fileMenu }));
  browser.menu = menuBar;    

  browser.window.onload = async () => {
    // find page elements
    const { window: { document } } = browser;
    const fileOpen = document.getElementById('fileOpen'); 
    const fileSave = document.getElementById('fileSave');
    const srcCanvas = document.getElementById('srcCanvas');
    const dstCanvas = document.getElementById('dstCanvas');
    const intensity = document.getElementById('intensity');

    // attach event handlers
    fileOpen.onchange = async (evt) => {
      const { target: { files: [ file ] } } = evt;
      if (file) {
        await loadImage(file.path);
      }
    };
    fileSave.onchange = async (evt) => {
      const { target: { files: [ file ] } } = evt;
      if (file) {
        await saveImage(file.path, file.type);
        // clear value so onchange is fired again when the same file is selected
        evt.target.value = '';
      }
    };
    intensity.oninput = (evt) => {
      const { target: { value } } = evt;
      applyFilter();
    };

    // load sample image
    const path = resolve(__dirname, './src/img/sample.png');
    await loadImage(path);

    async function loadImage(path) {
      const url = pathToFileURL(path);
      const img = new Image;
      img.src = url;
      // img.decode() doesn't work for some reason
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject; 
      });
      const bitmap = await createImageBitmap(img);
      srcCanvas.width = bitmap.width;
      srcCanvas.height = bitmap.height;
      const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0);
      applyFilter();
    }
  
    function applyFilter() {
      const srcCTX = srcCanvas.getContext('2d', { willReadFrequently: true });
      const { width, height } = srcCanvas;
      const params = { intensity: parseFloat(intensity.value) };
      const srcImageData = srcCTX.getImageData(0, 0, width, height);
      const dstImageData = createImageData(width, height, srcImageData, params);
      dstCanvas.width = width;
      dstCanvas.height = height;
      const dstCTX = dstCanvas.getContext('2d');
      dstCTX.putImageData(dstImageData, 0, 0);  
    }

    function createImageData(width, height, source, params) {
      const input = { src: source };
      const output = createOutput(width, height, input, params);
      const ta = output.dst.data.typedArray;
      const clampedArray = new Uint8ClampedArray(ta.buffer, ta.byteOffset, ta.byteLength);
      return new ImageData(clampedArray, width, height);
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
        dstCanvas.toBlob(callback, type)
      });   
      const buffer = await blob.arrayBuffer();
      await writeFile(path, new DataView(buffer)); 
    }
  };
});
