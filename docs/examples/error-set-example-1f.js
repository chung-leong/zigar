import { FileOpenError } from './error-set-example-1.zig';

console.log(FileOpenError(47));
console.log(FileOpenError('Error: Access denied'));
console.log(FileOpenError('access_denied'));
console.log(FileOpenError(42));

