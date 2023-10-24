import { useState, useCallback } from 'react'
import { sha1 } from './sha1.zig';
import './App.css'

function App() {
  const [ text, setText ] = useState('');
  const [ hash, setHash ] = useState('');
  const onChange = useCallback((evt) => {
    const { value } = evt.target;
    setText(value);
    const hash = sha1(value);
    if (hash instanceof Promise) {
      hash.then(hash => setHash(hash.string));
    } else {
      setHash(hash.string);
    }
  }, []);

  return (
    <div className="App">
      <textarea value={text} onChange={onChange} />
      <div className="Hash">
        SHA1: <input value={hash} readOnly={true} />
      </div>
    </div>
  );
}

export default App
