export { generateCode } from './code-generator.js';
export { compile, compileSync } from './compiler.js';
export {
  addPlatformExt, extractOptions, findConfigFile, findConfigFileSync, findSourceFile, getCachePath,
  loadConfigFile, loadConfigFileSync, optionsForCompile, optionsForTranspile
} from './configuration.js';
export { transpile } from './transpiler.js';

