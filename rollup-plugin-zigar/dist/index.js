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

export default function createPlugin(options = {}) {
  verifyOptions(options);
  return {
    name: 'Zigar',
    async load(id) {
      if (id.endsWith('.zig')) {
        const {
          useReadFile = false,
          embedWASM = false,
          ...otherOptions
        } = options;
        console.log({ embedWASM, useReadFile });
        const wasmLoader = async (name, dv) => {
          const source = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
          const refID = this.emitFile({ type: 'asset', name, source });
          if (useReadFile) {
            return loadWASM(refID);
          } else {
            return fetchWASM(refID);
          }
        };
        return transpile(id, { ...otherOptions, wasmLoader, embedWASM });
      }
    }
  };
}

function fetchWASM(refID) {
  return `(async () => {
  const source = fetch(import.meta.ROLLUP_FILE_URL_${refID});
  return WebAssembly.compileStreaming(source);
})()`;
}

function loadWASM(refID) {
  return `(async () => {
  const { readFile } = await import('fs/promises');
  const { fileURLToPath } = await import('url');
  const path = fileURLToPath(import.meta.ROLLUP_FILE_URL_${refID});
  return readFile(path);
})()`;
}
