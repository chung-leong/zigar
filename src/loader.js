import { cwd } from 'process';
import { fileURLToPath, pathToFileURL } from 'url';
import { compile } from './compiler.js'

const baseURL = pathToFileURL(`${cwd()}/`).href;
const extensionsRegex = /\.zig$/;

export function resolve(specifier, context, nextResolve) {
  if (extensionsRegex.test(specifier)) {
    const { parentURL = baseURL } = context;
    return {
      shortCircuit: true,
      url: new URL(specifier, parentURL).href,
    };
  }
  return nextResolve(specifier);
}

let nextModuleId = 1;

export async function load(url, context, nextLoad) {
  if (extensionsRegex.test(url)) {
    // compile the file if it or any of its dependencies has changed
    const zigPath = fileURLToPath(url);
    const soPath = await compile(zigPath);
    // use require() to load the C++ addon
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const extPath = fileURLToPath(new URL('../build/Release/addon', import.meta.url));
    const { load } = require(extPath);
    // load the zig module and see which of its properties can be exported
    const module = load(soPath);
    const descriptors = Object.getOwnPropertyDescriptors(module);
    const names = [];
    for (const [ name, { get, set } ] of Object.entries(descriptors)) {
      // any prop with a setter needs to be involved through the object
      if (!get && !set) {
        names.push(name);
      }
    }
    // temporarily save the object in global
    const globalName = `__node_zig_module_${nextModuleId}`;
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
  return nextLoad(url);
}

