import { mixin } from '../environment.js';
import { VISIT, MEMORY, ZIG, ADDRESS, LENGTH, POINTER, SLOTS, UPDATE } from '../symbols.js';
import { findSortedIndex } from '../utils.js';

var pointerSynchronization = mixin({
  updatePointerAddresses(context, args) {
    // first, collect all the pointers
    const pointerMap = new Map();
    const bufferMap = new Map();
    const potentialClusters = [];
    const callback = function({ isActive }) {
      if (isActive(this)) {
        // bypass proxy
        const pointer = this[POINTER];
        if (!pointerMap.get(pointer)) {
          const target = pointer[SLOTS][0];
          if (target) {
            pointerMap.set(pointer, target);
            // only relocatable targets need updating
            const dv = target[MEMORY];
            if (!dv[ZIG]) {
              // see if the buffer is shared with other objects
              const other = bufferMap.get(dv.buffer);
              if (other) {
                const array = Array.isArray(other) ? other : [ other ];
                const index = findSortedIndex(array, dv.byteOffset, t => t[MEMORY].byteOffset);
                array.splice(index, 0, target);
                if (!Array.isArray(other)) {
                  bufferMap.set(dv.buffer, array);
                  potentialClusters.push(array);
                }
              } else {
                bufferMap.set(dv.buffer, target);
              }
              // scan pointers in target
              target[VISIT]?.(callback);
            }
          }
        }
      }
    };
    args[VISIT](callback);
    // find targets that overlap each other
    const clusters = this.findTargetClusters(potentialClusters);
    const clusterMap = new Map();
    for (const cluster of clusters) {
      for (const target of cluster.targets) {
        clusterMap.set(target, cluster);
      }
    }
    // process the pointers
    for (const [ pointer, target ] of pointerMap) {
      if (!pointer[MEMORY][ZIG]) {
        const cluster = clusterMap.get(target);
        const address = this.getTargetAddress(context, target, cluster)
                     ?? this.getShadowAddress(context, target, cluster);
        // update the pointer
        pointer[ADDRESS] = address;
        if (LENGTH in pointer) {
          pointer[LENGTH] = target.length;
        }
      }
    }
  },
  updatePointerTargets(context, args) {
    const pointerMap = new Map();
    const callback = function({ isActive, isMutable }) {
      // bypass proxy
      const pointer = this[POINTER] /* c8 ignore next */ ?? this;
      if (!pointerMap.get(pointer)) {
        pointerMap.set(pointer, true);
        const writable = !pointer.constructor.const;
        const currentTarget = pointer[SLOTS][0];
        const newTarget = (!currentTarget || isMutable(this))
        ? pointer[UPDATE](context, true, isActive(this))
        : currentTarget;
        // update targets of pointers in original target if it's in relocatable memory
        // pointers in Zig memory are updated on access so we don't need to do it here
        // (and they should never point to reloctable memory)
        if (currentTarget && !currentTarget[MEMORY][ZIG]) {
          currentTarget[VISIT]?.(callback, { vivificate: true, isMutable: () => writable });
        }
        if (newTarget !== currentTarget) {
          if (newTarget && !newTarget[MEMORY][ZIG]) {
            // acquire targets of pointers in new target
            newTarget?.[VISIT]?.(callback, { vivificate: true, isMutable: () => writable });
          }
        }
      }
    };
    args[VISIT](callback, { vivificate: true });
  },
  findTargetClusters(potentialClusters) {
    const clusters = [];
    for (const targets of potentialClusters) {
      let prevTarget = null, prevStart = 0, prevEnd = 0;
      let currentCluster = null;
      for (const target of targets) {
        const dv = target[MEMORY];
        const { byteOffset: start, byteLength } = dv;
        const end = start + byteLength;
        let forward = true;
        if (prevTarget) {
          if (prevEnd > start) {
            // the previous target overlaps this one
            if (!currentCluster) {
              currentCluster = {
                targets: [ prevTarget ],
                start: prevStart,
                end: prevEnd,
                address: undefined,
                misaligned: undefined,
              };
              clusters.push(currentCluster);
            }
            currentCluster.targets.push(target);
            if (end > prevEnd) {
              // set cluster end offset to include this one
              currentCluster.end = end;
            } else {
              // the previous target contains this one
              forward = false;
            }
          } else {
            currentCluster = null;
          }
        }
        if (forward) {
          prevTarget = target;
          prevStart = start;
          prevEnd = end;
        }
      }
    }
    return clusters;
  },
});

export { pointerSynchronization as default };
