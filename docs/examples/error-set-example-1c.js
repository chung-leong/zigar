import { AllocationError, fail } from './error-set-example-1.zig';

for (let i = 1; i <= 3; i++) {
  try {
    fail(i);
  } catch (err) {
    console.log(`${err.message}: ${err in AllocationError}`);
  }   
}
