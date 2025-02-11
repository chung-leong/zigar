import { useCallback, useEffect, useState } from 'react'
import { runTest, startThreads } from '../zig/allocation.zig'

const threadCount = navigator.hardwareConcurrency - 1;

function App() {
  const [ counts, setCounts ] = useState(() => {
    const array = [ 0n ];
    for (let i = 0n; i < threadCount; i++) array.push(0n);
    return array;
  });
  const [ controller ] = useState(new AbortController);
  const [ terminated, setTerminated ] = useState(false);
  const [ text, setText ] = useState('');
  const [ pos, setPos ] = useState(0);
  const [ duration, setDuration ] = useState(0);
  const onStop = useCallback(() => controller.abort(), [ controller ]);
  const onPosChange = useCallback(evt => setPos(evt.target.value), []);
  const onTextChange = useCallback(evt => setText(evt.target.value), []);
  useEffect(() => {
    const { signal } = controller;
    const report = (id, count) => {
      setCounts((prevCounts) => {
        const newCounts = prevCounts.slice();
        newCounts[id] = count;
        return newCounts;
      });
    };
    startThreads(threadCount, 5000, report, { signal }).then(() => setTerminated(true));
    var mainCount = 0n;
    const interval = setInterval(() => {
      const start = performance.now();
      mainCount = runTest(mainCount, 200);
      const end = performance.now();
      setDuration(Math.ceil((end - start) * 1000));
      report(0n, mainCount);
    }, 250);
    signal.addEventListener('abort', () => clearInterval(interval));
  }, []);
  return (
    <>
      <ul>
        {
          counts.map((count, id) => {
            const name = (id === 0) ? `Main thread` : `Thread #${id}`;
            const text = (id === 0) ? `${count} (${duration} μs)` : `${count}`;
            return (
              <li key={id}>{name}: {text}</li>
            )
          })
        }
      </ul>
      <div>
        <button onClick={onStop} disabled={terminated}>Stop</button>
      </div>
      <div>
        <input onChange={onPosChange} type="range" min="0" max="5000" value={pos} />
      </div>
      <div>
        <textarea onChange={onTextChange} value={text} width="80" height="40" />
      </div>
    </>
  );
}

export default App
