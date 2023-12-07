import { cwd } from 'process';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import { compile, generateCodeForNode } from 'zigar-compiler';
import { exportStructures } from 'node-zigar-addon';

const baseURL = pathToFileURL(`${cwd()}/`).href;
const extensionsRegex = /\.zig$/;

function isZig(url) {
  const { pathname } = new URL(url);
  return extensionsRegex.test(pathname);
}

async function loadZig(url) {
  // compile the file if it or any of its dependencies has changed
  const { searchParams } = new URL(url);
  const zigPath = fileURLToPath(url);
  const options = {
    clean: process.env.NODE_ENV === 'production',
    optimize: (process.env.NODE_ENV === 'production') ? 'ReleaseFast' : 'Debug',
  };
  // variables from environment
  for (const [ name, value ] of Object.entries(process.env)) {
    if (name.startsWith('ZIGAR_')) {
      const key = camelCase(name.slice(6));
      options[key] = convertValue(key, value);
    }
  }
  // variables from URL
  for (const [ name, value ] of searchParams) {
    const key = camelCase(name);
    options[key] = convertValue(key, value);
  }
  const {
    omitFunctions = false,
    ...compileOptions
  } = options;
  const libPath = await compile(zigPath, compileOptions);
  const structures = await exportStructures(libPath, { omitFunctions });
  const require = createRequire(import.meta.url);
  // get the absolute path to node-zigar-addon so the "transpiled" code can find it
  const runtimeURL = pathToFileURL(require.resolve('node-zigar-addon'));
  const { code } = generateCodeForNode(structures, { runtimeURL, libPath });
  //console.log(code);
  return {
    format: 'module',
    shortCircuit: true,
    source: code,
  };
}

const boolFields = [ 'clean', 'omitFunctions' ];

function camelCase(name) {
  return name.toLowerCase().replace(/_(\w)/g, (m0, m1) => m1.toUpperCase());
}

function convertValue(key, string) {
  if (boolFields.includes(key)) {
    return !!parseInt(string);
  } else {
    return string;
  }
}

export function resolve(specifier, context, nextResolve) {
  const { parentURL = baseURL } = context;
  const { pathname, href } = new URL(specifier, parentURL);
  if (extensionsRegex.test(pathname)) {
    return {
      shortCircuit: true,
      url: href,
    };
  }
  return nextResolve(specifier);
}

export async function load(url, context, nextLoad) {
  if (isZig(url)) {
    return loadZig(url);
  }
  return nextLoad(url);
}
