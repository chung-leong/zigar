import module, { numeric_constant, printNumericVariable } from './variable-example-1.zig';

console.log(numeric_constant);
console.log(module.numeric_variable);
module.numeric_variable = 777;
printNumericVariable();
