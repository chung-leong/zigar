import { getResponse } from './struct-example-3.zig';

const response = getResponse();
for (const [ key, value ] of response) {
    console.log(`${key} = ${value}`);
}
