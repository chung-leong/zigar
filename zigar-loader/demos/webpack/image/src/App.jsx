import { useCallback, useEffect, useRef, useState } from 'react';
import SampleImage from '../img/sample.png';
import { scale, sepia } from '../zig/process.zig';
import './App.css';

function App() {
  const srcCanvasRef = useRef();
  const dstCanvasRef = useRef();
  const fileInputRef = useRef();
  const [ bitmap, setBitmap ] = useState();
  const [ size, setSize ] = useState(0.8);
  const [ intensity, setIntensity ] = useState(0.3);

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
  const onSizeChange = useCallback((evt) => {
    setSize(parseFloat(evt.target.value));
  }, [])
  const onIntensityChange = useCallback((evt) => {
    setIntensity(parseFloat(evt.target.value));
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
  }, [ SampleImage ]);
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
    // update the result when the bitmap or size parameter changes
    if (bitmap) {
      const srcCanvas = srcCanvasRef.current;
      const dstCanvas = dstCanvasRef.current;
      const srcCTX = srcCanvas.getContext('2d', { willReadFrequently: true });
      const srcImageData = srcCTX.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
      const resizedImageData = new ImageData(srcCanvas.width * size, srcCanvas.height * size);
      scale(srcImageData, resizedImageData);
      const dstImageData = new ImageData(resizedImageData.width, resizedImageData.height);
      sepia(resizedImageData, dstImageData, intensity);
      dstCanvas.width = dstImageData.width;
      dstCanvas.height = dstImageData.height;
      const dstCTX = dstCanvas.getContext('2d');
      dstCTX.putImageData(dstImageData, 0, 0);
    }
  }, [ bitmap, size, intensity ]);
  return (
    <div className="App">
      <div className="nav">
        <span className="button" onClick={onOpenClick}>Open</span>
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={onFileChange}/>
      </div>
      <div className="contents">
        <div className="pane align-right">
          <canvas ref={srcCanvasRef}></canvas>
          <div className="controls">
            Size: <input type="range" min={0.1} max={2} step={0.001} value={size} onChange={onSizeChange}/>
          </div>
          <div className="controls">
            Intensity: <input type="range" min={0} max={1} step={0.0001} value={intensity} onChange={onIntensityChange}/>
          </div>
        </div>
        <div className="pane align-left">
          <canvas ref={dstCanvasRef}></canvas>
        </div>
      </div>
    </div>
  )
}

export default App