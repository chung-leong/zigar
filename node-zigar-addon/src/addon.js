import { useAllExtendedTypes } from '../../zigar-runtime/src/data-view.js';
import { useAllMemberTypes } from '../../zigar-runtime/src/member.js';
import { useAllStructureTypes } from '../../zigar-runtime/src/structure.js';

useAllMemberTypes();
useAllStructureTypes();
useAllExtendedTypes();

export { NodeEnvironment as Environment } from '../../zigar-runtime/src/environment-node.js';
