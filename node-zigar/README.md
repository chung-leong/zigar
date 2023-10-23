# Node-zigar

Node-zigar is a Node.js module that lets you use functions written in the
[Zig language](https://ziglang.org/). It compiles Zig code into shared libraries and handles the
necessary marshalling. Basically, it lets you gain the power of developing your own native Node
module with a simple `import` statement.

It is designed to work with Node 14 and above.

## Installation

```js
npm install --save node-zigar
```

You must install the Zig compiler onto your computer separately. Follow the instructions outlined
in the official [Getting Started](https://ziglang.org/learn/getting-started/) guide. Alternately,
you can let [ZVM](https://github.com/tristanisham/zvm) help manage the installation process.

This library assumes that the compiler is in the search path.

## Usage

For Node.js 16 and above:

```js
node --experimental-loader node-zigar --no-warnings main.js
```

Node.js 14 employs a different loader API, requiring the use of a different loader:

```js
node --experimental-loader node-zigar/n14 --no-warnings main.js
```

## Simple example

```zig
// hello.zig
const std = @import("std");

pub fn hello() void {
    std.debug.print("Hello world", .{});
}
```

```js
// hello.js
import { hello } from './hello.zig';

hello();

// console output:
// Hello world
```

## More useful example

```zig
// md5.zig
const std = @import("std");

pub fn md5(bytes: []const u8) [std.crypto.hash.Md5.digest_length]u8 {
    var digest: [std.crypto.hash.Md5.digest_length]u8 = undefined;
    std.crypto.hash.Md5.hash(bytes, &digest, .{});
    return digest;
}
```
```js
// md5.js
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { md5 } from './md5.zig?optimize=ReleastFast';

const data = readFileSync(process.argv[0]);

console.time('Zig');
const digest1 = md5(data).string;
console.timeEnd('Zig');
console.log(digest1);

console.time('Node');
const hash = createHash('md5');
hash.update(data);
const digest2 = hash.digest('hex');
console.timeEnd('Node');
console.log(digest2);

// console output:
// Zig: 172.672ms
// 46cd8ba8e03525fac17db13dad4362db
// Node: 130.177ms
// 46cd8ba8e03525fac17db13dad4362db
```

See the documentation of [zigar-runtime](../zigar-runtime) for more code examples.

## Options

Options can be specified either as query variables in the path given to `import` or as environment
variables:

* `optimize` (env: `ZIGAR_OPTIMIZE`) - Optimization level (default: `ReleaseFast` when
process.env.NODE_ENV is "production", `Debug` otherwise)
* `clean` (env: `ZIGAR_CLEAN`) - Remove temporary build folder after building (default: `false`)
* `zig_cmd` (env: `ZIGAR_ZIG_CMD`) - Zig build command (default: `zig build -Doptimize=${optimize}`)
* `cache_dir` (env: `ZIGAR_CACHE_DIR`) - Directory where compiled shared libraries are placed (default: `${CWD}/zigar-cache`)
* `build_dir` (env: `ZIGAR_BUILD_DIR`) - Root directory where temporary build folder are placed (default: `${os.tmpdir()}`)
* `stale_time` (env: `ZIGAR_STALE_TIME`) - Maximum amount of time to wait for a file lock, in milliseconds (default: `60000`)

## __zigar object

Every module exported by Zigar comes with a `__zigar` object. This object has two methods:

* `init()` - Return a promise that resolves immediately
* `abandon()` - Remove all references to the shared library, such that it can be garbage-collected
