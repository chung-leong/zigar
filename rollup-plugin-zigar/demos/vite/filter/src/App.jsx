import { useCallback, useEffect, useRef, useState } from 'react';
import SampleImage from '../img/sample.png';
import { createOutputAsync, startThreadPool } from '../zig/sepia.zig';
import './App.css';

startThreadPool(navigator.hardwareConcurrency);

function App() {
  const srcCanvasRef = useRef();
  const dstCanvasRef = useRef();
  const fileInputRef = useRef();
  const [ bitmap, setBitmap ] = useState();
  const [ intensity, setIntensity ] = useState(0.3);
  const [ am ] = useState(new AbortManager());

  const onOpenClick = useCallback(() => {
    fileInputRef.current.click();
  }, []);
  const onFileChange = useCallback(async (evt) => {
    const [ file ] = evt.target.files;
    if (file) {
      const bitmap = await createImageBitmap(file);
      setBitmap(bitmap);
    }
  }, []);
  const onRangeChange = useCallback((evt) => {
    setIntensity(evt.target.value);
  }, [])
  useEffect(() => {
    // load initial sample image
    (async () => {
      const img = new Image();
      img.src = SampleImage;
      await img.decode();
      const bitmap = await createImageBitmap(img);
      setBitmap(bitmap);
    })();
  }, []);
  useEffect(() => {
    // update bitmap after user has selected a different one
    if (bitmap) {
      const srcCanvas = srcCanvasRef.current;
      srcCanvas.width = bitmap.width;
      srcCanvas.height = bitmap.height;
      const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0);
    }
  }, [ bitmap ]);
  useEffect(() => {
    // update the result when the bitmap or intensity parameter changes
    (async() => {
      try {
        if (bitmap) {
          const srcCanvas = srcCanvasRef.current;
          const dstCanvas = dstCanvasRef.current;
          const srcCTX = srcCanvas.getContext('2d', { willReadFrequently: true });
          const { width, height } = srcCanvas;
          const srcImageData = srcCTX.getImageData(0, 0, width, height);
          const input = { src: srcImageData };
          const params = { intensity };
          const output = await am.call(signal => createOutputAsync(width, height, input, params, { signal }));
          const dstImageData = new ImageData(output.dst.data.clampedArray, width, height);
          dstCanvas.width = width;
          dstCanvas.height = height;
          const dstCTX = dstCanvas.getContext('2d');
          dstCTX.putImageData(dstImageData, 0, 0);
        }
      } catch (err) {
        if (err.message != 'Aborted') {
          console.error(err);
        }
      }
    })();
  }, [ bitmap, intensity ]);
  return (
    <div className="App">
      <div className="nav">
        <span className="button" onClick={onOpenClick}>Open</span>
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={onFileChange}/>
      </div>
      <div className="contents">
        <div className="pane align-right">
          <canvas ref={srcCanvasRef}></canvas>
        </div>
        <div className="pane align-left">
          <canvas ref={dstCanvasRef}></canvas>
          <div className="controls">
            Intensity: <input type="range" min={0} max={1} step={0.0001} value={intensity} onChange={onRangeChange}/>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

class AbortManager {
  currentOp = null;

  async call(cb) {
    const controller = new AbortController;
    const { signal } = controller;
    const prevOp = this.currentOp;
    const thisOp = this.currentOp = { controller, promise: null };
    if (prevOp) {
      // abort previous call and wait for promise rejection
      prevOp.controller.abort();
      await prevOp.promise?.catch(() => {});
    }
    if (signal.aborted) {
      // throw error now if the operation was aborted,
      // before the function is even called
      throw new Error('Aborted');
    }
    const result = await (this.currentOp.promise = cb?.(signal));
    if (thisOp === this.currentOp) {
      this.currentOp = null;
    }
    return result;
  }

  async stop() {
    await this.call(null);
  }
}
