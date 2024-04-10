import { a, b, c, d } from './tagged-union-example-1.zig';

for (const number of [a, b, c, d ]) {
    for (const [ tag, value ] of number) {        
        switch (tag) {
            case 'integer':
                console.log('Do something with integer');
                break
            case 'big_integer':
                console.log('Do something with big integer');
                break;
            case 'decimal':
                console.log('Do something with decimal number');
                break;
            case 'complex': 
                console.log('Do something with complex number');
                break;
        }
    }   
}

