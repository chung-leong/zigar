import { FileOpenError } from './error-set-example-1.zig';

console.log(FileOpenError(JSON.parse('{"error":"File not found"}')));
