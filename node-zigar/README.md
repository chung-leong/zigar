# Node-zigar

Node-zigar is a Node.js module that lets you use functions written in the
[Zig language](https://ziglang.org/). It compiles Zig code into shared libraries and handles the
necessary marshalling. Basically, it lets you gain the power of developing your own native Node
module with a simple `import` statement.

It is designed to work with Node 14 and above.

## Installation

```js
npm install -g node-zigar
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

