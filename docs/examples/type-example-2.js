import { FatalError, Int32, PizzaTopping, Point } from './type-example-2.zig';

console.log(new Int32(1234).valueOf())
console.log(new Point({ x: 0.5, y: 0.7 }).valueOf());
for (const [ name, item ] of PizzaTopping) {
    console.log(`${item}`);
}
for (const [ name, error ] of FatalError) {
    console.log(`${error}`);
}
