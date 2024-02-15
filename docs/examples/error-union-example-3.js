import { login } from './error-union-example-3.zig';

const result = login();
const json = JSON.stringify(result, undefined, 2);
console.log(json);
