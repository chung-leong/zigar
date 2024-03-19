import { useCallback, useState } from 'react';
import { sha1 } from '../zig/sha1.zig';
import './App.css';

function App() {
  const [ digest, setDigest ] = useState('-')
  const onChange = useCallback(async (evt) => {
    const [ file ] = evt.target.files;
    if (file) {
      const buffer = await file.arrayBuffer();
      const { string } = sha1(buffer);
      setDigest(string); 
    } else {
      setDigest('-'); 
    }
  }, []);

  return (
    <>
      <div className="card">
        <input type="file" onChange={onChange} />
        <h2>{digest}</h2>
      </div>
    </>
  )
}

export default App
