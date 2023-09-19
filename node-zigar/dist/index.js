import { cwd } from 'process';
import { fileURLToPath, pathToFileURL } from 'url';
import { compile } from 'zigar-compiler';
import { load as loadModule } from 'node-zigar-addon';

const baseURL = pathToFileURL(`${cwd()}/`).href;
const extensionsRegex = /\.zig$/;

function isZig(url) {
  const { pathname } = new URL(url);
  return extensionsRegex.test(pathname);
}

let nextModuleId = 1;

async function loadZig(url) {
  // compile the file if it or any of its dependencies has changed
  const zigPath = fileURLToPath(url);
  const { env } = process;
  const options = {
    clean: !!parseInt(env.ZIGAR_CLEAN ?? ((env.NODE_ENV === 'production') ? '1' : '0')),
    optimize: env.ZIGAR_OPTIMIZE ?? ((env.NODE_ENV === 'production') ? 'ReleaseFast' : 'Debug'),
    zigCmd: env.ZIGAR_BUILD_CMD,
    buildDir: env.ZIGAR_BUILD_DIR,
    cacheDir: env.ZIGAR_CACHE_DIR,
  };
  const soPath = await compile(zigPath, options);
  const module = await loadModule(soPath);
  const descriptors = Object.getOwnPropertyDescriptors(module);
  const names = [];
  for (const [ name, { get, set } ] of Object.entries(descriptors)) {
    if (/^[$\w]+$/.test(name)) {
      // any prop with a setter needs to be involved through the object
      if (!set) {
        names.push(name);
      }
    }
  }
  // temporarily save the object in global
  const globalName = `__zigar_module_${nextModuleId}`;
  global[globalName] = module;
  // in the "transpiled" source, we get the object back, destructure the exportable propertie
  // and export them for ease of use while making the module itself available as the default
  const source = `
    const module = global['${globalName}'];
    delete global['${globalName}'];
    const { ${names.join(', ')} } = module;
    export { ${names.join(', ')} };
    export default module;
  `;
  return {
    format: 'module',
    shortCircuit: true,
    source,
  };
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

// called by Node 14x
export async function getFormat(url, context, defaultGetFormat) {
  if (isZig(url)) {
    return {
      format: 'module'
    };
  }
  return defaultGetFormat(url, context, defaultGetFormat);
}

// called by Node 14x
export async function getSource(url, context, defaultGetSource) {
  if (isZig(url)) {
    return loadZig(url);
  }
  return defaultGetSource(url, context, defaultGetSource);
}
