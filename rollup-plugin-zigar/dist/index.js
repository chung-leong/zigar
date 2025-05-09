import { createHash } from 'crypto';
import { parse } from 'path';
import { optionsForCompile, optionsForTranspile, transpile } from 'zigar-compiler/transpiler';

export const schema = {
  type: 'object',
  default: {},
  title: 'Rollup-plugin-zigar Options Schema',
  required: [],
  additionalProperties: false,
  properties: {
    ...optionsForCompile,
    ...optionsForTranspile,
  },
};

export function verifyOptions(options, schema) {
  for (const [ name, value ] of Object.entries(options)) {
    const descriptor = schema.properties[name];
    if (!descriptor) {
      // TODO: remove check after a couple versions
      if (name === 'useReadFile') {
        throw new Error(`Option '${name}' has been deprecated. Set 'nodeCompat' instead.`);
      } else {
        throw new Error(`Unknown option '${name}'`);
      }
    } else if (descriptor.enum && !descriptor.enum.includes(value)) {
      const list = descriptor.enum.map((n, i, arr) => {
        return (i === arr.length - 1) ? `or '${n}'` : `'${n}'`;
      }).join(', ');
      throw new Error(`The option '${name}' should be ${list}, got '${value}'`);
    }
  }
}

export function getOptimizationMode(isProd) {
  return (isProd) ? 'ReleaseSmall' : 'Debug';
}

export default function createPlugin(options = {}) {
  verifyOptions(options, schema);
  let serving = false;
  let optimizeDefault = getOptimizationMode(process.env.NODE_ENV === 'production');
  const wasmBinaries = {};
  return {
    name: 'zigar',
    /* c8 ignore next 7 */
    configResolved(config) {
      // set default optimization, although process.env.NODE_ENV should already give the right value
      optimizeDefault = getOptimizationMode(config.mode === 'production');
      return true;
    },
    configureServer(server) {
      serving = true;
      server.middlewares.use((req, res, next) => {
        const binary = wasmBinaries[req._parsedUrl.pathname];
        if (binary) {
          res.setHeader('Content-Type', 'application/wasm');
          res.write(binary);
          res.end();
        } else {
          next();
        }
      })
    },
    async load(id) {
      if (id.endsWith('.zig') || id.endsWith('.zigar')) {
        const {
          nodeCompat = false,
          embedWASM = false,
          optimize = optimizeDefault,
          ...otherOptions
        } = options;
        const wasmLoader = async (path, dv) => {
          const source = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
          const name = parse(path).name + '.wasm';
          if (serving) {
            const virtualPath = `/zigar/${md5(path).slice(0, 8)}/${name}`;
            const url = virtualPath + `?hash=${md5(source).slice(0, 8)}`;
            wasmBinaries[virtualPath] = source;
            return fetchVirtualWASM(url);
          } else {
            const refID = this.emitFile({ type: 'asset', name, source });
            if (nodeCompat) {
              return loadWASM(refID);
            } else {
              return fetchWASM(refID);
            }
          }
        };
        const { code, exports, structures, sourcePaths } = await transpile(id, {
          ...otherOptions,
          optimize,
          nodeCompat,
          wasmLoader,
          embedWASM,
        });
        const meta = {
          zigar: { exports, structures, sourcePaths },
        };
        if (sourcePaths) {
          for (const sourcePath of sourcePaths) {
            if (sourcePath != id) {
              this.addWatchFile(sourcePath);
            }
          }
        }
        return { code, meta };
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

function fetchVirtualWASM(url) {
  return `(async () => {
  const url = ${JSON.stringify(url)};
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

function md5(text) {
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}
