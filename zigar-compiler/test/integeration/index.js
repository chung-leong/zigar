import BenchmarksGame from './benchmarks-game/tests.js';
import Console from './console/tests.js';
import Crypto from './crypto/tests.js';
import MemoryAllocation from './memory-allocation/tests.js';
import TypeHandling from './type-handling/tests.js';

export function addTests(importModule, options) {
  BenchmarksGame.addTests(importModule, options);
  Console.addTests(importModule, options);
  Crypto.addTests(importModule, options);
  MemoryAllocation.addTests(importModule, options);
  TypeHandling.addTests(importModule, options);
}
