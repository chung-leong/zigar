import { AllocationError, FileOpenError } from './error-set-example-1.zig';

console.log(String(FileOpenError.access_denied));
console.log(String(FileOpenError.out_of_memory));
console.log(String(FileOpenError.file_not_found));
console.log(String(AllocationError.out_of_memory));
