## 0.11.1

* Completely reworked pointer handling, improving performance and eliminating restrictions on 
  pointer aliasing
* One-to-One address to JavaSCript object mapping
* Implemented handling of obscure Zig types such as enum literal
* Added support for Windows (32-bit and 64-bit)
* Added support for latest version of Node.js 
* Added support for Electron and NW.js, including cross-compilation handling
* Added support for master branch version of Zig compiler
* Added support for packages
* Implemented proper handling of const pointers
* Improved handling of tagged union
* Improved handling of enum
* Improved conversion to JSON
* Fixed rounding error for f16, f32, f80 and f128
* Fixed error sets
* Consolidated runtime for native-code execution and WebAssembly into single codebase
* Switched from Node-gyp to more modern Node-API, eliminating C++ code and need for Python