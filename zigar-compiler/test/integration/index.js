import { execSync } from 'child_process';

import * as BenchmarksGame from './benchmarks-game/tests.js';
import * as BugFixes from './bug-fixes/tests.js';
import * as BuiltinFunctions from './builtin-functions/tests.js';
import * as Console from './console/tests.js';
import * as ErrorHandling from './error-handling/tests.js';
import * as FunctionCalling from './function-calling/tests.js';
import * as FunctionPointer from './function-pointer/tests.js';
import * as Iterator from './iterator/tests.js';
import * as MemoryAllocation from './memory-allocation/tests.js';
import * as MetaTypes from './meta-types/tests.js';
import * as Options from './options/tests.js';
import * as PackageManager from './package-manager/tests.js';
import * as StreamHandling from './stream-handling/tests.js';
import * as SystemFunctions from './system-functions/tests.js';
import * as ThreadHandling from './thread-handling/tests.js';
import * as TypeHandling from './type-handling/tests.js';

export function addTests(importModule, options) {
  const compilerVersion = execSync('zig version').toString().trim();
  options = { ...options, compilerVersion };
  BugFixes.addTests(importModule, options);
  BenchmarksGame.addTests(importModule, options);
  Console.addTests(importModule, options);
  BuiltinFunctions.addTests(importModule, options);
  ErrorHandling.addTests(importModule, options);
  FunctionCalling.addTests(importModule, options);
  FunctionPointer.addTests(importModule, options);
  Iterator.addTests(importModule, options);
  MemoryAllocation.addTests(importModule, options);
  Options.addTests(importModule, options);
  MetaTypes.addTests(importModule, options);
  PackageManager.addTests(importModule, options);
  ThreadHandling.addTests(importModule, options);
  StreamHandling.addTests(importModule, options);
  SystemFunctions.addTests(importModule, options);
  TypeHandling.addTests(importModule, options);
}
