import { useCallback, useEffect, useState } from 'react'
import { lock, unlock, getCounts, startThreads } from '../zig/mutex.zig'

const threadCount = 8;

function App() {
  const [ mainCount, setMainCount ] = useState(0);
  const [ workerCount, setWorkerCount ] = useState(0);
  const [ controller ] = useState(new AbortController);
  const [ terminated, setTerminated ] = useState(false);
  const onStop = useCallback(() => controller.abort(), [ controller ]);
  useEffect(() => {
    const { signal } = controller;
    startThreads(threadCount, { signal }).then(() => setTerminated(true));
    const interval = setInterval(() => {
      for (let i = 0; i < 100; i++) {
        lock();
        unlock();
      }
      const [ mainCount, workerCount ] = getCounts();
      setMainCount(mainCount);
      setWorkerCount(workerCount);
    }, 25);
    signal.addEventListener('abort', () => clearInterval(interval));
  }, []);
  return (
    <>
      <h3>Main thread lock/unlock: {mainCount}</h3>
      <h3>Worker thread lock/unlock: {workerCount}</h3>
      <div>
        <button onClick={onStop} disabled={terminated}>Stop</button>
      </div>
    </>
  );
}

export default App
