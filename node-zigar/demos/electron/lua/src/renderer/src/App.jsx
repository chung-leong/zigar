import { useCallback, useState } from 'react';

function App() {
  const [ code, setCode ] = useState('');
  const [ output, setOutput ] = useState('');
  const onCodeChange = useCallback((evt) => {
    setCode(evt.target.value);
  }, []);
  const onRunClick = useCallback((evt) => {
    window.electron.ipcRenderer.send('run', code);
  }, [ code ]);

  return (
    <>
      <div className="code-section">
        <textarea value={code} onChange={onCodeChange}/>
        <button onClick={onRunClick}>Run</button>
      </div>
      <div className="output-section">
        <textarea value={output} readOnly={true} />
      </div>
    </>
  )
}

export default App

