# Node-zigar-addon

Node-zigar-addon is the C++ component used by [Node-zigar](../node-zigar/) to load shared libraries
compiled from Zig code into Node.js. It handles the interface between JavaScript and Zig. It also
provides an embedded copy of [Zigar-runtime](../zigar-runtime).

This module can be used independently from Node-zigar to create libraries with precompiled
binaries.

## Installation

```sh
npm install --save node-zigar-addon
```

## Usage

```js
import { os } from 'os;
import { fileURLToPath } from 'url';
import { load } from 'node-zigar-addon';

const platform = os.platform();
const arch = os.arch();
const extensions = { windows: 'dll', darwin: 'dylib' };
const ext = extensions[platform] ?? 'so';
const path = fileURLTOPath(new URL(`./${platform}/${arch}/libmojo.${ext}`, import.meta.url));
const module = load(path);
```

## Limitations

* No support for Windows currently. Tested in Linux and MacOS only.
