import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { loadFile } from './utility-functions.js';

export const optionsForCompile = {
  optimize: {
    type: 'string',
    enum: [ 'Debug', 'ReleaseSmall', 'ReleaseFast', 'ReleaseSafe' ],
    title: 'Zig optimization mode',
  },
  omitFunctions: {
    type: 'boolean',
    title: 'Omit all Zig functions',
  },
  omitVariables: {
    type: 'boolean',
    title: 'Omit all variables',
  },
  omitExports: {
    type: 'boolean',
    title: 'Omit export statements',
  },
  evalBranchQuota: {
    type: 'number',
    title: 'Value provided to @setEvalBranchQuota() during export',
  },
  useLibc: {
    type: 'boolean',
    title: 'Link in C standard library',
  },
  topLevelAwait: {
    type: 'boolean',
    title: 'Use top-level await to load WASM file',
  },
  multithreaded: {
    type: 'boolean',
    title: 'Enable multithreading',
  },
  buildDir: {
    type: 'string',
    title: 'Root directory where temporary build directories are placed',
  },
  cacheDir: {
    type: 'string',
    title: 'Directory where compiled library files are placed',
  },
  zigPath: {
    type: 'string',
    title: 'Zig command used to build libraries',
  },
  zigArgs: {
    type: 'string',
    title: 'Addition command-line passed to the Zig compiler',
  },
  modules: {
    type: 'object',
    title: 'Information concerning individual modules, including source file and loader',
  },
  sourceFiles: {
    type: 'object',
    title: 'Map of modules to source files/directories (legacy)',
  },
  quiet: {
    type: 'boolean',
    title: 'Disable compilation indicator',
  },
  recompile: {
    type: 'boolean',
    title: 'Recompile module when source file have been changed',
  },
  clean: {
    type: 'boolean',
    title: 'Remove temporary build directory after compilation finishes',
  },
  targets: {
    type: 'object',
    title: 'List of cross-compilation targets',
  },
};

export const optionsForTranspile = {
  nodeCompat: {
    type: 'boolean',
    title: 'Produce code compatible with Node.js',
  },
  embedWASM: {
    type: 'boolean',
    title: 'Embed WASM file in JavaScript source code',
  },
  stripWASM: {
    type: 'boolean',
    title: 'Remove unnecessary code from WASM file',
  },
  stackSize: {
    type: 'number',
    title: 'Size of the call stack in bytes',
  },
  maxMemory: {
    type: 'number',
    title: 'Maximum amount of shared memory in bytes',
  },
  keepNames: {
    type: 'boolean',
    title: 'Keep names of function in WASM binary when stripping',
  },
};

const allOptions = {
  ...optionsForCompile,
  ...optionsForTranspile,
};

export function extractOptions(searchParams, availableOptions) {
  const options = {};
  const names = Object.keys(availableOptions);
  for (const [ name, string ] of searchParams) {
    const key = getCamelCase(name, names);
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(name);
    }
    if (key === 'optimize') {
      options[key] = getCamelCase(string, [ 'Debug', 'ReleaseSafe', 'ReleaseFast', 'ReleaseSmall' ]);
    } else {
      switch (option.type) {
        case 'boolean':
          options[key] = !!parseInt(string);
          break;
        case 'number':
          options[key] = parseInt(string);
          break;
        default:
          options[key] = string;
      }
    }
  }
  return options;
}

function getCamelCase(name, names) {
  for (const nameCC of names) {
    const nameSC = nameCC.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    const nameKC = nameSC.replace(/_/g, '-');
    if (name === nameKC || name === nameSC || name === nameCC) {
      return nameCC;
    }
  }
  return name;
}

class UnknownOption extends Error {
  constructor(key) {
    const adjective = (allOptions[key]) ? 'Unavailable' : 'Unrecognized';
    super(`${adjective} option: ${key}`);
  }
}

export async function findConfigFile(name, dir) {
  const path = join(dir, name);
  try {
    await stat(path);
    return path;
  } catch (err) {
    const parent = dirname(dir);
    if (parent !== dir) {
      return findConfigFile(name, parent);
    }
  }
}

export async function loadConfigFile(cfgPath, availableOptions) {
  const text = await loadFile(cfgPath);
  const json = JSON.parse(text);
  return processConfig(json, cfgPath, availableOptions);
}

export function processConfig(object, cfgPath, availableOptions) {
  const options = {};
  for (let [ key, value ] of Object.entries(object)) {
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(key);
    }
    if (typeof(value) !== option.type) {
      throw new Error(`${key} is expected to be a ${option.type}, received: ${value}`);
    }
    if (key === 'sourceFiles') {
      const modules = {};
      for (const [ modulePath, source ] of Object.entries(value)) {
        modules[modulePath] = { source };
      }
      value = modules;
      key = 'modules';
    }
    if (key === 'modules') {
      // expand to absolute paths
      const cfgDir = dirname(cfgPath);
      const modules = {};
      for (let [ modulePath, module ] of Object.entries(value)) {
        modulePath = resolve(cfgDir, modulePath);
        module.source = resolve(cfgDir, module.source);
        if (module.loader) {
          module.loader = resolve(cfgDir, module.loader);
        }
        modules[modulePath] = module;
      }
      value = modules;
    }
    options[key] = value;
  }
  return options;
}

export function findSourceFile(modulePath, options) {
  const { modules } = options;
  return modules?.[modulePath]?.source;
}
