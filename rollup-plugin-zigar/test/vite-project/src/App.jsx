import { useCallback, useState } from 'react';
import './App.css';
import { getLength, sha1 } from './sha1.zig';

function App() {
  const [ text, setText ] = useState('');
  const [ hash, setHash ] = useState('');
  const onChange = useCallback((evt) => {
    const { value } = evt.target;
    const len = getLength(value);
    setText(value);
    setHash(`${sha1(value).string} (${len})`);
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
