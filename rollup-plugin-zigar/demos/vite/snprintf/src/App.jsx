import { useCallback, useMemo, useState } from 'react';
import {
  CStr, F64, I16, I32, I64, I8, U16, U32, U64, U8, Usize, snprintf
} from '../zig/snprintf.zig';
import './App.css';

function App() {
  const [format, setFormat] = useState('')
  const [argStr, setArgStr] = useState('')
  const argTypes = useMemo(() => {
    const list = [];
    const re = /%(.*?)([diuoxfegacspn%])/gi
    let m
    while (m = re.exec(format)) {
      let type
      switch (m[2].toLowerCase()) {
        case 'n':
        case 'i':
        case 'd': {
          if (m[1].includes('hh')) {
            type = I8
          } else if (m[1].includes('h')) {
            type = I16
          } else if (m[1].includes('ll') || m[1].includes('j')) {
            type = I64
          } else if (m[1].includes('z')) {
            type = Usize
          } else {
            type = I32
          }
        } break
        case 'u':
        case 'x':
        case 'o': {
          if (m[1].includes('hh')) {
            type = U8
          } else if (m[1].includes('h')) {
            type = U16
          } else if (m[1].includes('ll') || m[1].includes('j')) {
            type = U64
          } else if (m[1].includes('z')) {
            type = Usize
          } else {
            type = U32
          }
        } break
        case 'f':
        case 'e':
        case 'g': {
          type = F64;
        } break;
        case 'c': type = U8; break
        case 'z': type = U8; break
        case 's': type = CStr; break
        case 'p': type = Usize; break
      }
      if (type) {
        list.push(type)
      }
    }
    return list
  }, [format])
  const args = useMemo(() => {
    try {
      return eval(`[${argStr}]`)
    } catch (err) {
      return err
    }
  }, [argStr])
  const result = useMemo(() => {
    try {
      if (args instanceof Error) throw args
      const vargs = []
      for (const [ index, arg ] of args.entries()) {
        const type = argTypes[index]
        if (!type) throw new Error(`No specifier for argument #${index + 1}: ${arg}`);
        vargs.push(new type(arg))
      }
      const len = snprintf(null, 0, format, ...vargs);
      if (len < 0) {
        throw new Error('Invalid format string');
      }
      const buffer = new CStr(len + 1);
      snprintf(buffer, buffer.length, format, ...vargs);
      return buffer.string;
    } catch (err) {
      return err
    }
  }, [args, format, argTypes])
  const onFormatChange = useCallback((evt) => {
    setFormat(evt.target.value)
  }, [])
  const onArgStrChange = useCallback((evt) => {
    setArgStr(evt.target.value)
  }, [])
  const categorize = function(t) {
    if (t.name.startsWith('i')) {
      return 'signed';
    } else if (t.name.startsWith('u')) {
      return 'unsigned';
    } else if (t.name.startsWith('f')) {
      return 'float';
    } else {
      return 'other';
    }
  }

  return (
    <>
      <div id="call">
        snprintf(buffer, size,
          <input id="format" value={format} onChange={onFormatChange} />,
          <div id="arg-container">
            <input id="arg-str" value={argStr} onChange={onArgStrChange} />
            <div id="arg-types">
              {
                argTypes.map((t) =>
                  <label className={categorize(t)}>
                    {t.name}
                  </label>
                )
              }

            </div>
          </div>
        );
      </div>
      <div id="result" className={result instanceof Error ? 'error' : ''}>
        {result.toString()}
      </div>
    </>
  )
}

export default App
