const { transpile, optionsForCompile, optionsForTranspile } = require('zigar-compiler/cjs');
const { createHash } = require('crypto');
const { parse } = require('path');

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
    ...optionsForCompile, 
    ...optionsForTranspile,
  },
};

async function loader(content, map, meta) {
  const path = this.resourcePath;
  const options = this.getOptions(schema);
  const {
    useReadFile = (this.target === 'node'),
    embedWASM = false,
    optimize = (this.mode === 'production') ? 'ReleaseSmall' : 'Debug',
    ...otherOptions
  } = options;
  const wasmLoader = async (path, dv) => {
    const source = Buffer.from(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
    const file = parse(path);
    const hash = md5(source);
    const outputPath = `${file.name}-${hash.slice(0, 8)}.wasm`;
    this.emitFile(outputPath, source);
    if (useReadFile) {
      return loadWASM(outputPath);
    } else {
      return fetchWASM(outputPath);
    }
  };
  const { code } = await transpile(path, {
    ...otherOptions,
    optimize,
    wasmLoader,
    embedWASM,
  });
  return code;
};

function fetchWASM(path) {
  return `(async () => {
  const url = ${JSON.stringify(path)};
  return fetch(url);
})()`;
}

function loadWASM(path) {
  return `(async () => {
  const url = ${JSON.stringify(path)};
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
