import {
  returnInt,
  returnPoint,
  returnString,
  shutdown,
  startup
} from 'scratch.zig?multithreaded=1&use_llvm=1';

startup(1);
(async () => {
  try {
    const str = await returnString();
    console.log(str);
    const int = await returnInt();
    console.log(int);
    const point = await returnPoint();
    console.log(point);
  } finally {
    await shutdown();
  }
})();
