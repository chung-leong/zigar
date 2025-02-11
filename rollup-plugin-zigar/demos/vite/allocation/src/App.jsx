import { useCallback, useEffect, useState } from 'react'
import { getCounts, startThreads, testMain } from '../zig/allocation.zig'

const threadCount = 16;

function App() {
  const [ mainCount, setMainCount ] = useState(0);
  const [ workerCount, setWorkerCount ] = useState(0);
  const [ controller ] = useState(new AbortController);
  const [ terminated, setTerminated ] = useState(false);
  const [ duration, setDuration ] = useState(0);
  const onStop = useCallback(() => controller.abort(), [ controller ]);
  useEffect(() => {
    const { signal } = controller;
    startThreads(threadCount, 1000, { signal }).then(() => setTerminated(true));
    const interval = setInterval(() => {
      const start = performance.now();
      testMain(100);
      const end = performance.now();
      setDuration(Math.ceil((end - start) * 1000));
      const [ mainCount, workerCount ] = getCounts();
      setMainCount(mainCount);
      setWorkerCount(workerCount);
    }, 250);
    signal.addEventListener('abort', () => clearInterval(interval));
  }, []);
  return (
    <>
      <h3>Main thread alloc/free: {mainCount}</h3>
      <h4>(duration of blocking call = {duration} μs)</h4>
      <h3>Worker thread alloc/free: {workerCount}</h3>
      <div>
        <button onClick={onStop} disabled={terminated}>Stop</button>
      </div>
    </>
  );
}

export default App
