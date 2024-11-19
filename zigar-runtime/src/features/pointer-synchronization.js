import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { ADDRESS, LENGTH, MEMORY, POINTER, SLOTS, UPDATE, VISIT, ZIG } from '../symbols.js';
import { findSortedIndex } from '../utils.js';

export default mixin({
  updatePointerAddresses(context, object) {
    // first, collect all the pointers
    const pointerMap = new Map();
    const bufferMap = new Map();
    const potentialClusters = [];
    const callback = function(flags) {
      // bypass proxy
      const pointer = this[POINTER];
      if (!pointerMap.get(pointer)) {
        const target = pointer[SLOTS][0];
        if (target) {
          const writable = !pointer.constructor.const;
          const entry = { target, writable };
          pointerMap.set(pointer, target);
          // only targets in JS memory need updating
          const dv = target[MEMORY];
          if (!dv[ZIG]) {
            // see if the buffer is shared with other objects
            const other = bufferMap.get(dv.buffer);
            if (other) {
              const array = Array.isArray(other) ? other : [ other ];
              const index = findSortedIndex(array, dv.byteOffset, e => e.target[MEMORY].byteOffset);
              array.splice(index, 0, entry);
              if (!Array.isArray(other)) {
                bufferMap.set(dv.buffer, array);
                potentialClusters.push(array);
              }
            } else {
              bufferMap.set(dv.buffer, entry);
            }
            // scan pointers in target
            target[VISIT]?.(callback, 0);
          }
        }
      }
    };
    const flags = VisitorFlag.IgnoreRetval | VisitorFlag.IgnoreInactive;
    object[VISIT](callback, flags);
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
        const writable = cluster?.writable ?? !pointer.constructor.const;
        pointer[ADDRESS] = this.getTargetAddress(context, target, cluster, writable);
        if (LENGTH in pointer) {
          pointer[LENGTH] = target.length;
        }
      }
    }
  },
  updatePointerTargets(context, object, inbound = false) {
    const pointerMap = new Map();
    const callback = function(flags) {
      // bypass proxy
      const pointer = this[POINTER];
      if (!pointerMap.get(pointer)) {
        pointerMap.set(pointer, true);
        const currentTarget = pointer[SLOTS][0];
        const newTarget = (!currentTarget || !(flags & VisitorFlag.IsImmutable))
        ? pointer[UPDATE](context, true, !(flags & VisitorFlag.IsInactive))
        : currentTarget;
        const targetFlags = (pointer.constructor.const) ? VisitorFlag.IsImmutable : 0;
        if (!(targetFlags & VisitorFlag.IsImmutable)) {
          // update targets of pointers in original target if it's in JS memory
          // pointers in Zig memory are updated on access so we don't need to do it here
          // (and they should never point to reloctable memory)
          if (currentTarget && !currentTarget[MEMORY][ZIG]) {
            currentTarget[VISIT]?.(callback, targetFlags);
          }
        }
        if (newTarget !== currentTarget) {
          // acquire targets of pointers in new target if it;s in JS memory
          if (newTarget && !newTarget[MEMORY][ZIG]) {
            newTarget?.[VISIT]?.(callback, targetFlags);
          }
        }
      }
    }
    const flags = (inbound) ? VisitorFlag.IgnoreRetval : 0;
    object[VISIT](callback, flags);
  },
  findTargetClusters(potentialClusters) {
    const clusters = [];
    for (const entries of potentialClusters) {
      let prevTarget = null, prevStart = 0, prevEnd = 0;
      let currentCluster = null;
      for (const { target, writable } of entries) {
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
                writable,
              };
              clusters.push(currentCluster);
            } else {
              currentCluster.writable ||= writable;
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
