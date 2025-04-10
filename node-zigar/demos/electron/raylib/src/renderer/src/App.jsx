import { useCallback, useEffect, useRef, useState } from "react";

function App() {
  const [ open, setOpen ] = useState(false);
  const [ text, setText ] = useState('');
  const [ x, setX ] = useState(0);
  const [ y, setY ] = useState(0);
  const [ textSize, setTextSize ] = useState(0);
  const [ textColor, setTextColor ] = useState('#000000');
  const [ bkColor, setBkColor ] = useState('#ffffff');
  const [ lastKey, setLastKey ] = useState();
  const settings = useRef();
  const updateRaylibText = (s) => window.electron.ipcRenderer.invoke('raylib:set-text', s);
  const updateRaylibSettings = (s) => {
    Object.assign(settings.current, s);
    window.electron.ipcRenderer.invoke('raylib:set-settings', settings.current);
  };

  const onLaunchClick = useCallback(async () => {
    try {
      setOpen(true);
      await window.electron.ipcRenderer.invoke('raylib:launch');
    } finally {
      setOpen(false);
    }
  }, []);
  const onTextChange = useCallback((evt) => {
    const s = evt.target.value;
    setText(s);
    updateRaylibText(s);
  }, []);
  const onXChange = useCallback((evt) => {
    const x = parseInt(evt.target.value);
    setX(x);
    updateRaylibSettings({ x });
  }, []);
  const onYChange = useCallback((evt) => {
    const y = parseInt(evt.target.value);
    setY(y);
    updateRaylibSettings({ y });
  }, []);
  const onTextSizeChange = useCallback((evt) => {
    const size = parseInt(evt.target.value);
    setTextSize(size);
    updateRaylibSettings({ font_size: size });
  }, []);
  const onTextColorChange = useCallback((evt) => {
    const color = evt.target.value;
    setTextColor(color);
    updateRaylibSettings({ text_color: parseColor(color) });
  }, []);
  const onBkColorChange = useCallback((evt) => {
    const color = evt.target.value;
    setBkColor(color);
    updateRaylibSettings({ background_color: parseColor(color) });
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.invoke('raylib:get-settings').then((obj) => {
      settings.current = obj;
      setX(obj.x);
      setY(obj.y);
      setTextSize(obj.font_size);
      setTextColor(stringifyColor(obj.text_color));
      setBkColor(stringifyColor(obj.background_color));
    });
    window.electron.ipcRenderer.invoke('raylib:get-text').then((str) => {
      setText(str);
    });
    window.electron.ipcRenderer.on('raylib:key-pressed', (evt, keyCode) => setLastKey(keyCode));
  }, []);

  return (
    <>
      <div>
        <button disabled={open} onClick={onLaunchClick}>Launch</button>
      </div>
      <div>
        Text: <input type="text" value={text} onChange={onTextChange} />
      </div>
      <div>
        X: <input type="range" value={x} min="0" max="1000" onChange={onXChange} />
      </div>
      <div>
        Y: <input type="range" value={y} min="0" max="1000" onChange={onYChange} />
      </div>
      <div>
        Text size: <input type="range" value={textSize} min="4" max="128" onChange={onTextSizeChange} />
      </div>
      <div>
        Text color: <input type="color" value={textColor} onChange={onTextColorChange} />
      </div>
      <div>
        Background color: <input type="color" value={bkColor} onChange={onBkColorChange} />
      </div>
      <div>
        Last key: <input type="text" value={lastKey} readOnly />
      </div>
      </>
  )
}

function hex2(n) {
  return n.toString(16).padStart(2, '0')
}

function stringifyColor(c) {
  return `#${hex2(c.r)}${hex2(c.r)}${hex2(c.r)}`;
}

function parseColor(s) {
  return { 
    a: 255, 
    r: parseInt(s.slice(1, 3), 16), 
    g: parseInt(s.slice(3, 5), 16), 
    b: parseInt(s.slice(5, 7), 16), 
  };
}

export default App