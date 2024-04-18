import { dirname, join, resolve } from 'path';
import { findFile, findFileSync, loadFile, loadFileSync } from './utility-functions.js';

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
  useLibc: {
    type: 'boolean',
    title: 'Link in C standard library',
  },
  topLevelAwait: {
    type: 'boolean',
    title: 'Use top-level await to load WASM file',
  },
  buildDir: {
    type: 'string',
    title: 'Root directory where temporary build directories are placed',
  },
  cacheDir: {
    type: 'string',
    title: 'Directory where compiled library files are placed',
  },
  zigCmd: {
    type: 'string',
    title: 'Zig command used to build libraries',
  },
  sourceFiles: {
    type: 'object',
    title: 'Map of modules to source files/directories',
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
  useReadFile: {
    type: 'boolean',
    title: 'Enable the use of readFile() to Load WASM file when library is used in Node.js',
  },
  embedWASM: {
    type: 'boolean',
    title: 'Embed WASM file in JavaScript source code',
  },
  stripWASM: {
    type: 'boolean',
    title: 'Remove unnecessary code from WASM file',
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
  const info = await findFile(path);
  if (info?.isFile()) {
    return path;
  } else {
    const parent = dirname(dir);
    if (parent !== dir) {
      return findConfigFile(name, parent);
    }
  }
}

export function findConfigFileSync(name, dir) {
  const path = join(dir, name);
  const info = findFileSync(path);
  if (info?.isFile()) {
    return path;
  } else {
    const parent = dirname(dir);
    if (parent !== dir) {
      return findConfigFileSync(name, parent);
    }
  }
}

export async function loadConfigFile(cfgPath, availableOptions) {
  const text = await loadFile(cfgPath);
  return processConfigFile(text, cfgPath, availableOptions);
}

export function loadConfigFileSync(cfgPath, availableOptions) {
  const text = loadFileSync(cfgPath);
  return processConfigFile(text, cfgPath, availableOptions);
}

function processConfigFile(text, cfgPath, availableOptions) {
  const options = JSON.parse(text);
  for (const [ key, value ] of Object.entries(options)) {
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(key);
    }
    if (typeof(value) !== option.type) {
      throw new Error(`${key} is expected to be a ${option.type}, received: ${value}`);
    }
  }
  options.sourceFiles = getAbsoluteMapping(options.sourceFiles, dirname(cfgPath));
  return options;
}

export function getAbsoluteMapping(sourceFiles, cfgDir) {
  if (!sourceFiles) {
    return;
  }
  const map = {};
  for (const [ module, source ] of Object.entries(sourceFiles)) {
    const modulePath = resolve(cfgDir, module);
    const sourcePath = resolve(cfgDir, source);
    map[modulePath] = sourcePath;
  }
  return map;
}

export function findSourceFile(modulePath, options) {
  const { sourceFiles } = options;
  return sourceFiles?.[modulePath]; 
}
