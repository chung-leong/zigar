import * as BenchmarksGame from './benchmarks-game/tests.js';
import * as BuiltinFunctions from './builtin-functions/tests.js';
import * as Console from './console/tests.js';
import * as ErrorHandling from './error-handling/tests.js';
import * as FunctionCalling from './function-calling/tests.js';
import * as MemoryAllocation from './memory-allocation/tests.js';
import * as TypeHandling from './type-handling/tests.js';

export function addTests(importModule, options) {
  BenchmarksGame.addTests(importModule, options);
  Console.addTests(importModule, options);
  BuiltinFunctions.addTests(importModule, options);
  ErrorHandling.addTests(importModule, options);
  FunctionCalling.addTests(importModule, options);
  MemoryAllocation.addTests(importModule, options);
  TypeHandling.addTests(importModule, options);
}
