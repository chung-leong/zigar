import { useCallback, useEffect, useRef, useState } from 'react';

function App() {
  const [ code, setCode ] = useState('')
  const [ output, setOutput ] = useState('')
  const lineRefs = useRef([])
  const onCodeChange = useCallback(evt => setCode(evt.target.value), [])
  const onRunClick = useCallback(evt => window.electron.ipcRenderer.send('run', code), [ code ])
  useEffect(() => {
    window.electron.ipcRenderer.on('log', (_, text) => {
      const lines = lineRefs.current
      lines.push(...text.split('\n'))
      while (lines.length > 200) {
        lines.shift()
      }
      setOutput(lines.join('\n') + '\n')
    })
    return () => window.electron.ipcRenderer.removeAllListeners('log');
  }, [])

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

