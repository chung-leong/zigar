const { transpile } = require('zigar-compiler/cjs');

module.exports = function (content, map, meta) {
  const callback = this.async();
  loader.call(this, content, map, meta).then((result) => {
    callback(null, result, map, meta);
  }).catch((err) => {
    callback(err);
  });
};
module.exports.raw = true;

const schema = {
  type: 'object',
  default: {},
  title: 'Zigar-loader Options Schema',
  required: [],
  additionalProperties: false,
  properties: {
    useReadFile: {
      type: 'boolean',
      title: 'Load WASM file using readFile() instead of fetch()',
    },
    embedWASM: {
      type: 'boolean',
      title: 'Embed WASM file in JavaScript source code',
    },
    topLevelAwait: {
      type: 'boolean',
      title: 'Use top-level await to load WASM file',
    },
    omitFunctions: {
      type: 'boolean',
      title: 'Omit all Zig functions',
    },
    optimize: {
      type: 'string',
      enum: [ 'Debug', 'ReleaseSmall', 'ReleaseFast', 'ReleaseSafe' ],
      title: 'Zig optimization mode',
    },
    clean: {
      type: 'boolean',
      title: 'Remove temporary build directory after compilation finishes',
    },
    stripWASM: {
      type: 'boolean',
      title: 'Remove unnecessary code from WASM file',
    },
    buildDir: {
      type: 'string',
      title: 'Root directory where temporary build directories are placed',
    },
    cacheDir: {
      type: 'string',
      title: 'Directory where library files re placed',
    },
    zigCmd: {
      type: 'string',
      title: 'Zig command used to build libraries',
    },
    staleTime: {
      type: 'number',
      title: 'Time interval in milliseconds before a PID file is considered stale',
    },
  },
};

async function loader(content, map, meta) {
  const path = this.resourcePath;
  const options = this.getOptions(schema);
  const {
    useReadFile = (this.target === 'node'),
    embedWASM = false,
    ...otherOptions
  } = options;
  const wasmLoader = async (name, dv) => {
    const source = Buffer.from(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
    this.emitFile(name, source);
    if (useReadFile) {
      return loadWASM(name);
    } else {
      return fetchWASM(name);
    }
  };
  const code = await transpile(path, { ...otherOptions, wasmLoader, embedWASM });
  return code;
};

function fetchWASM(name) {
  return `(async () => {
  const source = fetch(${JSON.stringify(name)});
  return WebAssembly.compileStreaming(source);
})()`;
}

function loadWASM(name) {
  return `(async () => {
  const { readFile } = require('fs/promises');
  const path = ${JSON.stringify(name)};
  return readFile(path);
})()`;
}
