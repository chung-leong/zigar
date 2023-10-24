# Zigar

A software tool set that lets you utilize [Zig](https://ziglang.org/) code in your JavaScript
project. It consists of the following front-facing components:

* [node-zigar](./node-zigar/README.md) - [Node.js loader](https://nodejs.org/api/esm.html#loaders)
that enables the importing of Zig code
* [zigar-loader](./zigar-loader/README.md) - [WebPack](https://webpack.js.org/) loader that
transfrom Zig code into JavaScript and WASM
* [rollup-plugin-zigar](./rollup-plugin-zigar/README.md) - [Rollup](https://rollupjs.org/) plugin
that does the same

Along with these back-end components:

* [node-zigar-addon](./node-zigar-addon/README.md) - C++ addon used by node-zigar
* [zigar-runtime](./zigar-runtime/README.md) - JavaScript runtime for accessing Zig data structures
and call-marshalling
* [zigar-compiler](./zigar-compiler/README.md) - Library that uses the Zig compiler to export
functions and structures defined in Zig

## Live demo

[Pb2zig](https://github.com/chung-leong/pb2zig#readme) was developed alongside Zigar to serve as a
proving ground and a demonstration of what can be done. At its project page you'll find a number
of demos that runs in the web browser.
