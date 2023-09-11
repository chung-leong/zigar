import { transpile } from 'zigar-compiler';

const schema = {
  type: 'object',
  default: {},
  title: 'Zigar-loader Options Schema',
  required: [],
  additionalProperties: false,
  properties: {
    useReadFile: {
      type: 'boolean',
      title: 'Enable the use of readFile() to Load WASM file when library is used in Node.js',
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
    keepNames: {
      type: 'boolean',
      title: 'Keep names of function in WASM binary when stripping',
    },
    buildDir: {
      type: 'string',
      title: 'Root directory where temporary build directories are placed',
    },
    cacheDir: {
      type: 'string',
      title: 'Directory where compiled library files re placed',
    },
    zigCmd: {
      type: 'string',
      title: 'Zig command used to build libraries',
    },
    staleTime: {
      type: 'number',
      title: 'Time interval in milliseconds before a lock file is considered stale',
    },
  },
};

function verifyOptions(options) {
  for (const [ name, value ] of Object.entries(options)) {
    const descriptor = schema.properties[name];
    if (!descriptor) {
      throw new Error(`Unknown option '${name}'`);
    } else if (descriptor.enum && !descriptor.enum.includes(value)) {
      const list = descriptor.enum.map((n, i, arr) => {
        return (i === arr.length - 1) ? `or '${n}'` : `'${n}'`;
      }).join(', ');
      throw new Error(`The option '${name}' should be ${list}, got '${value}'`);
    }
  }
}

function getOptimizationMode(isProd) {
  return (isProd) ? 'ReleaseSmall' : 'Debug';
}

export default function createPlugin(options = {}) {
  verifyOptions(options);
  let embedWASMDefault = false;
  let optimizeDefault = getOptimizationMode(process.env.NODE_ENV === 'production');
  return {
    name: 'Zigar',
    /* c8 ignore next 7 */
    apply(config, { command }) {
      // embed WASM by default when Vite is serving
      embedWASMDefault = (command === 'serve');
      // set default optimization, although process.env.NODE_ENV should already give the right value
      optimizeDefault = getOptimizationMode(config.mode === 'production');
      return true;
    },
    async load(id) {
      if (id.endsWith('.zig')) {
        const {
          useReadFile = false,
          embedWASM = embedWASMDefault,
          optimize = optimizeDefault,
          ...otherOptions
        } = options;
        const wasmLoader = async (name, dv) => {
          const source = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
          const refID = this.emitFile({ type: 'asset', name, source });
          if (useReadFile) {
            return loadWASM(refID);
          } else {
            return fetchWASM(refID);
          }
        };
        return transpile(id, {
          ...otherOptions,
          optimize,
          wasmLoader,
          embedWASM,
        });
      }
    }
  };
}

function fetchWASM(refID) {
  return `(async () => {
  const url = import.meta.ROLLUP_FILE_URL_${refID};
  return fetch(url);
})()`;
}

function loadWASM(refID) {
  return `(async () => {
  const url = import.meta.ROLLUP_FILE_URL_${refID};
  if (typeof(process) === 'object' && process[Symbol.toStringTag] === 'process') {
    const { readFile } = await import('fs/promises');
    const { fileURLToPath } = await import('url');
    const path = fileURLToPath(url);
    return readFile(path);
  } else {
    return fetch(url);
  }
})()`;
}
