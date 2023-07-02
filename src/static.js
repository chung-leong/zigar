import { getAccessors } from "./member";

export function attachStaticMembers(s) {
  const {
    constructor,
    static: {
      members,
      template,
    },
    options,
  } = s;
  const descriptors = {
    [SLOTS]: { value: template?.[SLOTS] },
  };
  for (const member of members) {
    const { get, set } = getAccessors(member, options);
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  };
  Object.defineProperties(constructor, descriptors);
}
