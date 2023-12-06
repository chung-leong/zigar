import * as BenchmarksGame from './benchmarks-game/tests.js';
import * as Console from './console/tests.js';
import * as Crypto from './crypto/tests.js';
import * as MemoryAllocation from './memory-allocation/tests.js';
import * as TypeHandling from './type-handling/tests.js';

export function addTests(importModule, options) {
  BenchmarksGame.addTests(importModule, options);
  Console.addTests(importModule, options);
  Crypto.addTests(importModule, options);
  MemoryAllocation.addTests(importModule, options);
  TypeHandling.addTests(importModule, options);
}
