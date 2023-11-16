import { useAllMemberTypes } from '../../zigar-runtime/src/member.js';
import { useAllStructureTypes } from '../../zigar-runtime/src/structure.js';

useAllMemberTypes();
useAllStructureTypes();

export { NodeEnvironment as Environment } from '../../zigar-runtime/src/environment.js';
