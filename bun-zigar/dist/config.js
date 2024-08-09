import { dirname, resolve } from 'path';

export async function loadConfigFile(cfgPath, availableOptions) {
  const { default: options } = await import(cfgPath);
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

function getAbsoluteMapping(sourceFiles, cfgDir) {
  const map = {};
  if (sourceFiles) {
    for (const [ module, source ] of Object.entries(sourceFiles)) {
      const modulePath = resolve(cfgDir, module);
      const sourcePath = resolve(cfgDir, source);
      map[modulePath] = sourcePath;
    }
  }
  return map;
}

class UnknownOption extends Error {
  constructor(key) {
    const adjective = (allOptions[key]) ? 'Unavailable' : 'Unrecognized';
    super(`${adjective} option: ${key}`);
  }
}
