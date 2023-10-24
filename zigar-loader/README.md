# zigar-loader

WebPack plugin that lets you use code written in [the Zig language](https://ziglang.org/) in a
JavaScript project.

## Installation

```sh
npm install --save-dev zigar-loader
```

You must install the Zig compiler onto your computer separately. Follow the instructions outlined
in the official [Getting Started](https://ziglang.org/learn/getting-started/) guide. Alternately,
you can let [ZVM](https://github.com/tristanisham/zvm) help manage the installation process.

This library assumes that the compiler is in the search path.

## Versioning

The major and minor version numbers of this plugin correspond to the version of the Zig compiler
it's designed for. The current version is 0.11.0. It works with Zig 0.11.0.

## Usage

```js
const ZigarLoader = require('zigar-loader');

module.exports = {
  mode: 'development',
  entry: 'index.js',
  output: {
    library: {
      type: 'module',
    },
    filename: 'index.js',
    path: './build',
    chunkFormat: 'module',
  },
  module: {
    rules: [
      {
        test: /\.zig$/,
        loader: ZigarLoader,
        exclude: /node_modules/,
        options: {
          topLevelAwait: false,
        }
      },
    ]
  },
};
```

## Options

* `optimize` - Optimization level (default: `ReleaseSmall` when building for production, `Debug`
otherwise)
* `topLevelAwait` - Use top-level await to wait for compilation of WASM code (default: `true`)
* `embedWASM` - Embed WASM binary as base64 in JavaScript code (default: `false` in build mode,
`true` in server mode)
* `omitFunctions` - Exclude all functions and produce no WASM code (default: `false`)
* `stripWASM` - Remove extraneous code from WASM binary, including debugging information (default:
false when `optimize` is `Debug`, `true` otherwise)
* `keepNames` - Keep names of function in WASM binary when stripping (default: `false`)
* `useReadFile` - Enable the use of readFile() to Load WASM file when library is used in Node.js
(default: `true` when target is `node`, `false` otherwise)
* `clean` - Remove temporary build folder after building (default: `false`)
* `zigCmd` - Zig build command (default: `zig build -Doptimize=${optimize}`)
* `cacheDir` - Directory where compiled shared libraries are placed (default: `${CWD}/zigar-cache`)
* `buildDir` - Root directory where temporary build folder are placed (default: `${os.tmpdir()}`)
* `staleTime` - Maximum amount of time to wait for a file lock, in milliseconds (default: `60000`)

## Awaiting WASM compilation

By default, the plugin uses top-level await to wait for compilation of WASM binary. As of writing,
this JavaSCript feature is not yet universally available. To produce a production build, you might
need to set `topLevelAwait` to false.

There are two ways you can await WASM compilation when the feature is turned off. The first way is
to await the promise return by `__zigar.init()`:

```js
async function performTask(input) {
  const { calculate, __zigar } = await import('calculation.zig');
  await __zigar.init();
  const result = calculate(input);
  displayResult(result);
}
```

The second way is to use `await` on one of your own Zig functions:

```js
async function performTask(input) {
  const { calculate } = await import('calculation.zig');
  const result = await calculate(input);
  displayResult(result);
}
```

Prior to the completion of WASM compilation, every function will return a promise of its eventual
result.

## __zigar object

Every module exported by Zigar comes with a `__zigar` object. This object has two methods:

* `init()` - Return a promise that resolves when WASM compilation completes
* `abandon()` - Remove all references to the WebAssembly instance running the code so that it
can be garbage-collected

## Demo app

To demonstrate how to use this plugin, we'll build a simple React app that calculate the SHA-1 hash
of text you enter. We start by running the command `npm npm init -y` in an empty directory. Then we
run `npm install react react-dom`, followed by the command below to add development dependencies:

```sh
npm install --save-dev @babel/core @babel/preset-env @babel/preset-react babel-loader\
css-loader style-loader zig-loader html-webpack-plugin webpack webpack-cli webpack-dev-server
```

We then create `webpack.config.js`:

```js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/main.jsx',
  output: {
    path: path.join(__dirname, '/dist'),
    filename: 'bundle.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
    }),
  ],
  devServer: {
    port: 3030,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: [ 'style-loader', 'css-loader' ],
      },
      {
        test: /\.zig$/,
        exclude: /node_modules/,
        use: 'zigar-loader',
      },
    ],
  },
};
```

And `.babelrc` for Babel:

```json
{
  "presets": [
    "@babel/preset-env",
    [ "@babel/preset-react", { "runtime": "automatic" } ]
  ]
}
```

In `package.json` we add two commands:

```json
{
  "scripts": {
    "dev": "webpack serve --mode development",
    "build": "webpack --mode production"
  },
}
```

Create the sub-directory `src` and add the source file `src/App.jsx`:

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

And then `src/App.css`:

```css
.App {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  padding: 5px;
}

.App textarea {
  flex: 1 1 auto;
}

.App .Hash {
  flex: 0 0 auto;
  padding-top: 5px;
}

.App .Hash input {
  width: 32em;
}
```

Then `src/index.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
}
```

Then `src/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebPack + React + Zigar</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

Finally we add `src/sha1.zig`, the file imported by `src/App.jsx`:

```zig
const std = @import("std");

pub fn sha1(bytes: []const u8) [std.crypto.hash.Sha1.digest_length * 2]u8 {
    var digest: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
    std.crypto.hash.Sha1.hash(bytes, &digest, .{});
    return std.fmt.bytesToHex(digest, .lower);
}
```

`sha1()` returns an array object. We access its `string` property to get a string in our `onChange`
handler above.

With everything in place, start the development server using the command `npm run dev`. Open the
on-screen hyperlink with your browser. You should be greeted by the following:

![Demo app](./doc/img/screenshot-1.png)

Enter some text into the text box. Its SHA-1 hash should appear at the bottom of the page.

Now switch back to your code editor and make the following change to `src/sha1.zig`:

```zig
const std = @import("std");

pub fn sha1(bytes: []const u8) [std.crypto.hash.Sha1.digest_length * 2]u8 {
    var digest: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
    std.crypto.hash.Sha1.hash(bytes, &digest, .{});
    return std.fmt.bytesToHex(digest, .upper); // <-- requesting uppercase letters
}
```

When you return to the browser again, you should see that typing now produces upper-case hashes.

The latest version of WebPack supports top-level await. If for some reason you must use an older
version of WebPack, you'd encounter the following error when you run `npm run build`:

```
ERROR in ./src/sha1.zig
Module parse failed: The top-level-await experiment is not enabled (set experiments.topLevelAwait:
true to enabled it)
```

In order to build successfully despite the constraint, we need to go back to
`src/webpack.config.js` and add the option `{ topLevelAwait: false }`:

```js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/main.jsx',
  output: {
    path: path.join(__dirname, '/dist'),
    filename: 'bundle.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html',
    }),
  ],
  devServer: {
    port: 3030,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: [ 'style-loader', 'css-loader' ],
      },
      {
        test: /\.zig$/,
        exclude: /node_modules/,
        use: {
          loader: '../../dist/index.js',
          options: { topLevelAwait: false }, // <-- disabling top-level-await
        }
      },
    ],
  },
};
```

Without top-level await the app will work properly most of the time. In theory the loading process
could hit a hiccup and `sha1()` ends up being called before it's ready. To ensure that our app
works right all the time we're going to add a check to the `onChange` handler:

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
    if (hash instanceof Promise) {  // <-- check for promise
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

You can see the demo in action [here](https://chung-leong.github.io/zigar/demo-2/).

## Additional information

Consult the [Zigar runtime](../zigar-runtime/README.md) user guide to learn more about working
with Zig data structures in JavaScript.
