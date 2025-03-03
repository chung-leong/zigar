import { useEffect, useState } from 'react'
import { __zigar, spawn } from '../zig/donut.zig';
import './App.css'

function App() {
  const [ lines, setLines ] = useState([]);
  useEffect(() => {
    const lines = [];
    let r = 0;  
    __zigar.connect({
      log(s) {
        const newLines = s.split('\n');
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
        {lines.map((s, i) => <div key={i}>{s}</div>)}
      </div>
    </>
  )
}

export default App
