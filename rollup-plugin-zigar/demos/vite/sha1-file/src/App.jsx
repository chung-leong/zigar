import { useCallback, useEffect, useState } from 'react';
import { sha1, startup } from '../zig/sha1.zig';
import './App.css';

function App() {
  const [ digest, setDigest ] = useState('-')
  const onChange = useCallback(async (evt) => {
    const [ file ] = evt.target.files;
    setDigest(file ? await sha1(file) : '-'); 
  }, [ sha1 ]);
  useEffect(() => startup(), [ startup ]);
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
