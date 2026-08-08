import {
  returnInt,
  returnPoint,
  returnString,
  shutdown,
  startup
} from 'scratch.zig?multithreaded=1';

startup(2);
try {
  const str = await returnString();
  expect(str).to.equal('Hello world!');
  const int = await returnInt();
  expect(int).to.equal(1234);
  const point = await returnPoint();
  expect(point).to.eql({ x: 0.1234, y: 0.4567 });
} finally {
  await shutdown();
}
