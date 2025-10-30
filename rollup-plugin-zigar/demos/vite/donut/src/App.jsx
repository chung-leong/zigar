import { useDeferredValue, useEffect, useState } from 'react';
import { __zigar, spawn } from '../zig/donut.zig';
import './App.css';

function App() {
  const [ lines, setLines ] = useState([]);
  const deferredLines = useDeferredValue(lines);
  useEffect(() => {
    const lines = [];
    let r = 0;
    __zigar.on('log', ({ source, message }) => {
      if (source === 'stdout') {
        const newLines = message.split('\n');
        for (let line of newLines) {
          if (line.startsWith('\x1b[2J')) {
            line = line.slice(4);
          }
          if (line.startsWith('\x1b[H')) {
            r = 0;
            line = line.slice(3);
          }
          if (line) {
            lines[r++] = line;
          }
        }
        setLines([ ...lines ]);
        return true;
      }
    });
    spawn();
  }, []);
  return (
    <>
      <h1 id="title">
        <span id="homer">~(_8^(I)</span>
        Mmm, donut
      </h1>
      <div className="display">
        {deferredLines.map((s, i) => <div key={i}>{s}</div>)}
      </div>
    </>
  )
}

export default App
