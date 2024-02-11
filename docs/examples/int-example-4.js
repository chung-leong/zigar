import { UserPreferences } from './int-example-4.zig';

const pref = new UserPreferences({ 
    option2: 2,
    option3: 7,
    option4: 15,
    option7: 1,
    option8: 3,
});
console.log(pref.valueOf());
console.log(`size = ${pref.dataView.byteLength}`);
