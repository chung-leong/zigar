import { UserPreferences } from './bool-example-2.zig';

const pref = new UserPreferences({ option8: true });
console.log(pref.valueOf());
console.log(`size = ${pref.dataView.byteLength}`);
