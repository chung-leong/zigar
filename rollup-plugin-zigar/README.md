# rollup-plugin-zigar

Rollup plugin that lets you use code written in [the Zig language](https://ziglang.org/) in a
JavaScript project.

## Installation

```sh
npm install rollup-plugin-zigar
```

You must install the Zig compiler onto your computer separately. Follow the instructions outlined in
the official [Getting Started](https://ziglang.org/learn/getting-started/) guide. This library
assumes that the compiler is in the search path.

## Usage

Rollup configuration example:
```js
import Zigar from 'rollup-plugin-zigar';

export default {
  input: './sha1.zig',
  plugins: [
    Zigar({ useReadFile: true }),
  ],
  output: {
    file: './sha1.js',
    format: 'esm',
  },
};
```

Vite configuration example:
```js
import { defineConfig } from 'vite'
import React from '@vitejs/plugin-react-swc'
import Zigar from 'rollup-plugin-zigar';

export default defineConfig({
  plugins: [
    React(),
    Zigar({ topLevelAwait: false }),
  ],
})
```

## Options

* optimize - Optimization level (default: `ReleaseSmall` when building for production, `Debug` otherwise)
* topLevelAwait - Use top-level await to wait for compilation of WASM code (default: `true`)
* embedWASM - Embed WASM binary as base64 in JavaScript code (default: `false` in build mode, `true` in server mode)
* omitFunctions - Exclude all functions and produce no WASM code (default: `false`)
* stripWASM - Remove extraneous code from WASM binary, including debugging information (default: false when `optimize` is `Debug`, `true` otherwise)
* keepNames - Keep names of function in WASM binary when stripping (default: `false`)
* useReadFile - Enable the use of readFile() to Load WASM file when library is used in Node.js (default: `false`)
* clean - Remove temporary build folder after building (default: `false`)
* zigCmd - Zig build command (default: `zig build -Doptimize=${optimize}`)
* cacheDir - Directory where compiled shared libraries are placed (default: `${CWD}/zigar-cache`)
* buildDir - Root directory where temporary build folder are placed (default: `${os.tmpdir()}`)
* staleTime - Maximum amount of time to wait or a file lock in milliseconds (default: `60000`)

## Awaiting WASM compilation

By default, the plugin uses top-level await to wait for compilation of WASM binary. As of writing, this JavaSCript feature is not yet universally available. Moreover, its use can significantly delay the initiation of your app when the WASM code is large, degrading the user experience. There are thus good reasons to set `topLevelAwait` to false.

There are two ways you can await WASM compilation when `topLevelAwait` is false. The first way is to await the `__init` promise that is exported by every Zig module. The second way is to use await on one of your own Zig functions. Prior to the completion of WASM compilation, every function will return a promise of its eventual result. You can therefore define your own async init function, that both waits for compilation process and set certain operational parameters at the same time.

## Example app

```js
import { defineConfig } from 'vite'
import React from '@vitejs/plugin-react-swc'
import Zigar from 'rollup-plugin-zigar'; // <-- importing plugin

export default defineConfig({
  plugins: [
    React(),
    Zigar(), // <-- adding plugin
  ],
})
```

```js
import { useState, useCallback } from 'react'
import { sha1 } from './sha1.zig'; // <-- importing Zig function
import './App.css'

function App() {
  const [ text, setText ] = useState('');
  const [ hash, setHash ] = useState('');
  const onChange = useCallback((evt) => {
    const { value } = evt.target;
    setText(value);
    const hash = sha1(value);
    setHash(hash.string);
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
```

```zig
const std = @import("std");

pub fn sha1(bytes: []const u8) [std.crypto.hash.Sha1.digest_length * 2]u8 {
    var digest: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
    std.crypto.hash.Sha1.hash(bytes, &digest, .{});
    return std.fmt.bytesToHex(digest, .lower);
}
```

```zig
const std = @import("std");

pub fn sha1(bytes: []const u8) [std.crypto.hash.Sha1.digest_length * 2]u8 {
    var digest: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
    std.crypto.hash.Sha1.hash(bytes, &digest, .{});
    return std.fmt.bytesToHex(digest, .upper); // <-- requesting uppercase letters
}
```

```js
import { defineConfig } from 'vite'
import React from '@vitejs/plugin-react-swc'
import Zigar from 'rollup-plugin-zigar';

export default defineConfig({
  plugins: [
    React(),
    Zigar({ topLevelAwait: false }), // <-- disabling top-level-await
  ],
})
```

```js
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
```
