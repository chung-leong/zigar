import { User } from './struct-example-1.zig';

const user = new User({
    id: 1234n,
    name: "Bigus Dickus",
    email: "madeupname12@rome.gov.it",
});
console.log(user.id);
console.log(user.name.string);
console.log(user.email.string);
console.log(user.age);
console.log(user.popularity);
