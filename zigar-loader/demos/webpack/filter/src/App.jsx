import { useCallback, useEffect, useRef, useState } from 'react';
import SampleImage from '../img/sample.png';
import './App.css';

function App() {
  const srcCanvasRef = useRef();
  const dstCanvasRef = useRef();
  const fileInputRef = useRef();
  const [ bitmap, setBitmap ] = useState();
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
      if (bitmap) {      
        const srcCanvas = srcCanvasRef.current;
        const dstCanvas = dstCanvasRef.current;
        const srcCTX = srcCanvas.getContext('2d', { willReadFrequently: true });
        const { width, height } = srcCanvas;
        const srcImageData = srcCTX.getImageData(0, 0, width, height);
        purgeQueue();
        const dstImageData = await createImageData(width, height, srcImageData, { intensity });
        dstCanvas.width = width;
        dstCanvas.height = height;
        const dstCTX = dstCanvas.getContext('2d');
        dstCTX.putImageData(dstImageData, 0, 0);
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

async function createImageData(width, height, source, params) {
  const args = [ width, height, source, params ];
  const transfer = [ source.data.buffer ];
  return startJob('createImageData', args, transfer);
}

function purgeQueue() {
  pendingRequests.splice(0);
}

let keepAlive = true;
let maxCount = navigator.hardwareConcurrency;

const activeWorkers = [];
const idleWorkers = [];
const pendingRequests = [];
const jobs = [];

let nextJobId = 1;

async function acquireWorker() {
  let worker = idleWorkers.shift();
  if (!worker) {
    if (maxCount < 1) {
      throw new Error(`Unable to start worker because maxCount is ${maxCount}`);
    }
    if (activeWorkers.length < maxCount) {
      // start a new one
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      // wait for start-up message from worker
      await new Promise((resolve, reject) => {
        worker.onmessage = resolve;
        worker.onerror = reject;
      });     
      worker.onmessage = handleMessage;
      worker.onerror = (evt) => console.error(evt);
    } else {
      // wait for the next worker to become available again
      return new Promise(resolve => pendingRequests.push(resolve));
    }
  }
  activeWorkers.push(worker);
  return worker;
}

async function startJob(name, args = [], transfer = []) {
  const worker = await acquireWorker();
  const job = {
    id: nextJobId++,
    promise: null,
    resolve: null,
    reject: null,
    worker,
  };
  job.promise = new Promise((resolve, reject) => {
    job.resolve = resolve;
    job.reject = reject;
  });
  jobs.push(job);
  worker.onmessageerror = () => reject(new Error('Message error'));
  worker.postMessage([ name, job.id, ...args], { transfer });
  return job.promise;
}

function handleMessage(evt) {
  const [ name, jobId, result ] = evt.data;
  const jobIndex = jobs.findIndex(j => j.id === jobId);
  const job = jobs[jobIndex];
  jobs.splice(jobIndex, 1);
  const { worker, resolve, reject } = job;
  if (name !== 'error') {
    resolve(result);
  } else {
    reject(result);
  }
  // work on pending request if any
  const next = pendingRequests.shift();
  if (next) {
    next(worker);
  } else {
    const workerIndex = activeWorkers.indexOf(worker);
    if (workerIndex !== -1) {
      activeWorkers.splice(workerIndex, 1);
    }
    if (keepAlive && idleWorkers.length < maxCount) {
      idleWorkers.push(worker);
    }
  }
}
