## 0.14.1

* Added support for reader/writer
* Added support for standalone module loader
* Added ability to specify string struct field, arguments, and return value
* Made promises and generator more efficient
* Implemented the copying of PDB file for Windows build
* Enable use of local modules
* Fixed infinite rebuild bug affecting rollup-plugin-zigar and zigar-loader on Mac
* Fixed handling of anyerror
* Fixed issue when WASM is larger than 8MB
* Fixed memory allocation
* Fixed access to Zig memory in Electron
* Made stack size for work queue threads the same as the default
* Expanded "sourceFiles" option to "modules"
* Migrated addon code from C to Zig

## 0.14.0

* Added support for function pointer
* Added support for thread in WebAssembly
* Added support for allocator
* Added support for async function and generator
* Added clampedArray property
* Implemented WorkQueue
* Improved dead-code removal
* Enabled variables in Electron
* Removed automatic allocation of Zig memory
* Passing an incompatible typed array triggers an error instead of a warning

## 0.13.2

* Removed 64K of zeros from generated WASM files

## 0.13.1

* Enhanced handling of multi-item and C pointers
* Implemented expected behavior from pointer to anyopaque
* Added support for iterators
* Added support for variadic functions
* Added buildDirSize option to control size of build directory
* Added support for Zig 0.14.0/master
* Various bug fixes and optimizations
* Tested on ARM64 (including MacOS on ARM)

## 0.13.0

* Added support for Zig 0.13.0
* Fixed inability of rollup-plugin-zigar and zigar-loader to detect changes in dependent files
* Renamed zigar-cache to .zigar-cache

## 0.12.0

* Removed support for Zig 0.11.0

## 0.11.2

* Added sizeOf(), alignOf(), and typeOf() to __zigar
* Added ability to provide custom WASI handler
* Added compilation indicator to node-zigar
* Implemented casting from packed structs to number and initialization
* Implemented casting from tagged union to string
* Implemented redirection of libc io functions
* Made directory containing Zig file available as include directory for C
* Fixed error reporting
* Replaced zigCmd option with separate zigPath and zigArgs options
* General code clean-up

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