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
  const { searchParams } = new URL(url);
  const zigPath = fileURLToPath(url);
  const options = {
    clean: process.env.NODE_ENV === 'production',
    optimize: (process.env.NODE_ENV === 'production') ? 'ReleaseFast' : 'Debug',
  };
  // variables from environment
  for (const [ name, value ] of Object.entries(process.env)) {
    if (name.startsWith('ZIGAR_')) {
      options[name.slice(6).toLowerCase()] = value;
    }
  }
  // variables from URL
  for (const [ name, value ] of new URL(url).searchParams) {
    options[name] = value;
  }
  if (typeof(options.clean) !== 'boolean') {
    options.clean = !!parseInt(options.clean);
  }
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

export function resolve(specifier, context, defaultResolve) {
  const { parentURL = baseURL } = context;
  const { pathname, href } = new URL(specifier, parentURL);
  if (extensionsRegex.test(pathname)) {
    return {
      shortCircuit: true,
      url: href,
    };
  }
  return defaultResolve(specifier, context, defaultResolve);
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
