import { AllocationError, FileOpenError } from './error-set-example-1.zig';

console.log(Number(FileOpenError.access_denied));
console.log(Number(FileOpenError.out_of_memory));
console.log(Number(FileOpenError.file_not_found));
console.log(Number(AllocationError.out_of_memory));
