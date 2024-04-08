import { AllocationError, FileOpenError } from './error-set-example-1.zig';

console.log(FileOpenError.out_of_memory === AllocationError.out_of_memory);
console.log(FileOpenError.out_of_memory instanceof FileOpenError);
console.log(AllocationError.out_of_memory instanceof AllocationError);
