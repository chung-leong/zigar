import { MemberType, PointerFlag, structureNames, StructureType } from '../../zigar-runtime/src/constants.js';
import { SENTINEL } from '../../zigar-runtime/src/symbols.js';

export function shortenNames(structures) {
  let structId = 1;
  let unionId = 1;
  let errorSetId = 1;
  let enumId = 1;
  let opaqueId = 1;
  const map = new Map();
  const nsRegExp = /.+?\./g;
  const removeNS = function(s) {
    return s.replace(nsRegExp, '');
  };
  const handlers = {
    getPrimitiveName(s) {
      const { name, instance: { members: [ member ] } } = s;
      switch (member.type) {
        case MemberType.Literal: return 'enum_literal';
        case MemberType.Null: return 'null';
        case MemberType.Undefined: return 'undefined';
        default: return name;
      }
    },
    getArrayName(s) {
      const { instance: { members: [ element ] }, length } = s;
      const elementName = process(element.structure);
      return `[${length}]${elementName}`;
    },
    getStructName(s) {
      const { name } = s;
      return /[{}()]/.test(name) ? `S${structId++}` : removeNS(name);
    },
    getUnionName(s) {
      const { name } = s;
      return /[{}()]/.test(name) ? `U${unionId++}` : removeNS(name);
    },
    getErrorUnionName(s) {
      const { instance: { members: [ payload, errorSet ] } } = s;
      const payloadName = process(payload.structure);
      const errorSetName = process(errorSet.structure);
      return `${errorSetName}!${payloadName}`;
    },
    getErrorSetName(s) {
      const { name } = s;
      return /[{}()]/.test(name) ? `ES${errorSetId++}` : removeNS(name);
    },
    getEnumName(s) {
      const { name } = s;
      return /[{}()]/.test(name) ? `E${enumId++}` : removeNS(name);
    },
    getOptionalName(s) {
      const { instance: { members: [ payload ] } } = s;
      const payloadName = process(payload.structure);
      return `?${payloadName}`;
    },
    getPointerName(s) {
      const { instance: { members: [ target ] }, flags } = s;
      let prefix = '*'
      let targetName = process(target.structure);
      if (target.structure.type === StructureType.Slice) {
        targetName = targetName.slice(3);
      }
      if (flags & PointerFlag.IsMultiple) {
        if (flags & PointerFlag.HasLength) {
          prefix = '[]';
        } else if (flags & PointerFlag.IsSingle) {
          prefix = '[*c]';
        } else {
          prefix = '[*]';
        }
      }
      const sentinel = target.constructor[SENTINEL];
      if (sentinel) {
        prefix = prefix.slice(0, -1) + `:${sentinel.value}` + prefix.slice(-1);
      }
      if (flags & PointerFlag.IsConst) {
        prefix = `${prefix}const `;
      }
      return prefix + targetName;
    },
    getSliceName(s) {
      const { instance: { members: [ element ] } } = s;
      const elementName = process(element.structure);
      return `[_]${elementName}`;
    },
    getVector(s) {
      return s.name;
    },
    getOpaqueName(s) {
      const { name } = s;
      return (name !== 'anyopaque') ? `O${opaqueId++}` : name;
    },
    getArgStructName(s) {
      const { instance: { members } } = s;
      const retval = members[0];
      const args = members.slice(1);
      const rvName = process(retval.structure);
      const argNames = args.map(m => process(m.structure));
      return `Arg(fn (${argNames.join(' ,')}) ${rvName})`;
    },
    getVariadicStructName(s) {
      const { instance: { members } } = s;
      const retval = members[0];
      const args = members.slice(1);
      const rvName = process(retval.structure);
      const argNames = args.map(m => process(m.structure));
      return `Arg(fn (${argNames.join(' ,')}, ...) ${rvName})`;
    },
    getFunctionName(s) {
      const { instance: { members: [ args ] } } = s;
      const argName = process(args.structure);
      return argName.slice(4, -1);
    },
  };
  const process = function(s) {
    let name = map.get(s);
    if (name === undefined) {
      const handlerName = `get${structureNames[s.type]}Name`;
      const handler = handlers[handlerName];
      name = handler?.(s) ?? 'TODO';
      map.set(s, name);
      s.name = name;
    }
    return name;
  };
  for (const s of structures) {
    process(s);
  }
}
