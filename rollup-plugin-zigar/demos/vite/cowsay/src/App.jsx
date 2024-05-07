import { useCallback, useState } from 'react';
import { __zigar, cowsay } from '../zig/cowsay.zig';
import './App.css';

function App() {
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');

  const onChange = useCallback((e) => {
    const { value } = e.target;
    setText(value);
    const args = (value) ? value.split(/[ \t]+/) : [];
    const lines = [];
    __zigar.connect({ log: line => lines.push(line) });
    cowsay([ 'cowsay', ...args ]);
    setOutput(lines.join('\n'));
  }, []);

  return (
    <>
      <h1>Vite + React + Cow</h1>
      <div className="card">
        <input className="input" value={text} onChange={onChange}/>
      </div>
      <div className="card">
        <textarea className="output" value={output} readOnly />
      </div>
    </>
  )
}

export default App
