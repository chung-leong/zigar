# zigar-compiler

Backend component responsible for the compilation process. It builds library files with the help
of the Zig compiler. When targeting WebAssembly, it'll also generate the necessary bootstrap
JavaScript and stripe the .wasm file of extraneous code.

## API

```js
async function compile(path: string, options: object = {}): string
```

Compile the zig file located at `path`. The options are:

* `optimize` - Optimization level (default: `Debug`)
* `platform` - Platform to target (default: the current system)
* `arch` - CPU architecture to target (default: the current system)
* `clean` - Remove temporary build folder after building (default: `false`)
* `zigCmd` - Zig build command (default: `zig build -Doptimize=${optimize}`)
* `cacheDir` - Directory where compiled shared libraries are placed (default: `${CWD}/zigar-cache`)
* `buildDir` - Root directory where temporary build folder are placed (default: `${os.tmpdir()}`)
* `staleTime` - Maximum amount of time to wait for a file lock, in milliseconds (default: `60000`)

`return value` - The path to the compiled library file (.so, .dylib, etc.)

```js
async function transpile(path: string, options: object = {}): string
```

Compile the Zig file located at `path` for use in a browser or Node.js. The options, in
addition to the ones for `compile()`, are:

* `topLevelAwait` - Use top-level await to wait for compilation of WASM code (default: `true`)
* `embedWASM` - Embed WASM binary as base64 in JavaScript code (default: `true`)
* `omitFunctions` - Exclude all functions and produce no WASM code (default: `false`)
* `stripWASM` - Remove extraneous code from WASM binary, including debugging information (default:
`true` unless `optimize` is `Debug`)
* `keepNames` - Keep names of function in WASM binary when stripping (default: `false`)
* `useReadFile` - Enable the use of readFile() to Load WASM file when library is used in Node.js
(default: `false`)
* `moduleResolver` - A function for resolving location of modules imported by the generated
JavaScript (default: `name => name`)
* `wasmLoader` - A function that returns JavaScript code for loading WASM binary (default:
undefined)

`return value` - `{ code, exports, structures }`

`wasmLoader` is required when `embedWASM` is `false`. It's fed two arguments: `path`--the path of the
Zig file in question, and `dv`, a
[DataView](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView)
object holding the WASM binary.

The object returned by `transpile()` contains the bootstrap code, a list of exported symbols,
and a list of objects describing data structures defined in Zig.

## Compilation process

When you import a file using node-zigar, behind the scene zigar-compiler will create a
temporary sub-directory in `buildDir` and place two files there. The first is
**build-cfg.zig**, which has the following:

```zig
const std = @import("std");

pub const target: std.zig.CrossTarget = .{ .cpu_arch = .x86_64, .os_tag = .linux };
pub const package_name = "[NAME OF TARGET ZIG FILE WITHOUT EXTENSION]";
pub const package_path = "[PATH TO TARGET FILE]";
pub const package_root = "[DIRECTORY HOLDING TARGET FILE]";
pub const exporter_path = "[NODE_MODULES]/zigar-compiler/zig/cpp-exporter.zig";
pub const stub_path = "[NODE_MODULES]/zigar-compiler/zig/cpp-stub.zig";
pub const use_libc = false;
```

The second is the actual build file, **build.zig**:

```zig
const std = @import("std");
const cfg = @import("./build-cfg.zig");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{
        .default_target = cfg.target,
    });
    const optimize = b.standardOptimizeOption(.{});
    const lib = b.addSharedLibrary(.{
        .name = cfg.package_name,
        .root_source_file = .{ .path = cfg.stub_path },
        .target = target,
        .optimize = optimize,
    });
    lib.addModule("exporter", b.createModule(.{
        .source_file = .{ .path = cfg.exporter_path },
    }));
    lib.addModule("package", b.createModule(.{
        .source_file = .{ .path = cfg.package_path },
    }));
    if (cfg.use_libc) {
        lib.linkLibC();
    }
    if (cfg.target.cpu_arch == .wasm32) {
        lib.use_lld = false;
        lib.rdynamic = true;
    }
    b.installArtifact(lib);
}
```

If the directory holding the target Zig file has a file named "build.zig", that file will be copied
into the temporary sub-directory instead.

Once the files are in place, zigar-compiler invokes the command `zig build -Doptimize=${optimize}`
(or the command given through the `zigCmd` option).

By default, the temporary sub-directory is not removed, in order to allow the reuse of compilation
cache.

Zigar-compiler does not invoke the Zig compiler when it sees that the output library file is newer
than any of the files in directory holding the target Zig file.

## Transpilation process

The target Zig file is first compiled into a WASM shared library. The library is then loaded into Node.js. Its factory function is invoked, which describes the Zig data types employed
and the functions available. After capturing this information, zigar-compiler generates the
JavaScript bootstrap and strips out the factory function.
