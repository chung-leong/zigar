import { cwd } from 'process';
import { fileURLToPath, pathToFileURL } from 'url';
import { compile } from 'zigar-compiler';
import { load as loadModule } from 'node-zigar-addon';

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
  const { pathname } = new URL(url);
  if (extensionsRegex.test(pathname)) {
    // compile the file if it or any of its dependencies has changed
    const zigPath = fileURLToPath(url);
    const { env } = process;
    const options = {
      clean: !!(env.ZIGAR_CLEAN ?? (env.NODE_ENV === 'production') ? '1' : '0'),
      optimize: env.ZIGAR_OPTIMIZE ?? (env.NODE_ENV === 'production') ? 'ReleaseFast' : 'Debug',
      zigCmd: env.ZIGAR_BUILD_CMD,
      buildDir: env.ZIGAR_BUILD_DIR,
      cacheDir: env.ZIGAR_CACHE_DIR,
    };
    const soPath = await compile(zigPath, options);
    const module = await loadModule(soPath);
    const descriptors = Object.getOwnPropertyDescriptors(module);
    const names = [];
    for (const [ name, { get, set } ] of Object.entries(descriptors)) {
      // any prop with a setter needs to be involved through the object
      if (!get && !set) {
        names.push(name);
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
  return nextLoad(url);
}

