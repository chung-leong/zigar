import { User } from './struct-example-2.zig';

const user = new User({
    id: 1234n,
    name: "Bigus Dickus",
    email: "madeupname12@rome.gov.it",
    age: 32,
    address: null,
});
user.address = {
    street: '1 Colosseum Sq.',
    city: 'Rome',
    state: 'NY',
    zipCode: '10001',
};
user.print();

// calling method like regular function
User.print({
    id: 1234n,
    name: "Bigus Dickus",
    email: "madeupname12@rome.gov.it",
    age: 32,
    address: {
        street: '1 Colosseum Sq.',
        city: 'Rome',
        state: 'NY',
        zipCode: '10001',
    },
});
