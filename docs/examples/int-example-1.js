import { print32, print33 } from './int-example-1.zig';

print32(123);
try {
    print33(123);
} catch (err) {
    console.log(err.message);
}
print33(123n);