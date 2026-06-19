#ifndef MSVC_INTRINSICS_H
#define MSVC_INTRINSICS_H

long _InterlockedExchange(
   long volatile * Target,
   long Value
);
long _InterlockedExchange_acq(
   long volatile * Target,
   long Value
);
long _InterlockedExchange_HLEAcquire(
   long volatile * Target,
   long Value
);
long _InterlockedExchange_HLERelease(
   long volatile * Target,
   long Value
);
long _InterlockedExchange_nf(
   long volatile * Target,
   long Value
);
long _InterlockedExchange_rel(
   long volatile * Target,
   long Value
);
char _InterlockedExchange8(
   char volatile * Target,
   char Value
);
char _InterlockedExchange8_acq(
   char volatile * Target,
   char Value
);
char _InterlockedExchange8_nf(
   char volatile * Target,
   char Value
);
char _InterlockedExchange8_rel(
   char volatile * Target,
   char Value
);
short _InterlockedExchange16(
   short volatile * Target,
   short Value
);
short _InterlockedExchange16_acq(
   short volatile * Target,
   short Value
);
short _InterlockedExchange16_nf(
   short volatile * Target,
   short Value
);
short _InterlockedExchange16_rel(
   short volatile * Target,
   short Value
);
long long _InterlockedExchange64(
   long long volatile * Target,
   long long Value
);
long long _InterlockedExchange64_acq(
   long long volatile * Target,
   long long Value
);
long long _InterlockedExchange64_HLEAcquire(
   long long volatile * Target,
   long long Value
);
long long _InterlockedExchange64_HLERelease(
   long long volatile * Target,
   long long Value
);
long long _InterlockedExchange64_nf(
   long long volatile * Target,
   long long Value
);
long long _InterlockedExchange64_rel(
   long long volatile * Target,
   long long Value
);
long _InterlockedCompareExchange(
   long volatile * Destination,
   long Exchange,
   long Comparand
);
long _InterlockedCompareExchange_acq(
   long volatile * Destination,
   long Exchange,
   long Comparand
);
long _InterlockedCompareExchange_HLEAcquire(
   long volatile * Destination,
   long Exchange,
   long Comparand
);
long _InterlockedCompareExchange_HLERelease(
   long volatile * Destination,
   long Exchange,
   long Comparand
);
long _InterlockedCompareExchange_nf(
   long volatile * Destination,
   long Exchange,
   long Comparand
);
long _InterlockedCompareExchange_np(
   long volatile * Destination,
   long Exchange,
   long Comparand
);
long _InterlockedCompareExchange_rel(
   long volatile * Destination,
   long Exchange,
   long Comparand
);
char _InterlockedCompareExchange8(
   char volatile * Destination,
   char Exchange,
   char Comparand
);
char _InterlockedCompareExchange8_acq(
   char volatile * Destination,
   char Exchange,
   char Comparand
);
char _InterlockedCompareExchange8_nf(
   char volatile * Destination,
   char Exchange,
   char Comparand
);
char _InterlockedCompareExchange8_rel(
   char volatile * Destination,
   char Exchange,
   char Comparand
);
short _InterlockedCompareExchange16(
   short volatile * Destination,
   short Exchange,
   short Comparand
);
short _InterlockedCompareExchange16_acq(
   short volatile * Destination,
   short Exchange,
   short Comparand
);
short _InterlockedCompareExchange16_nf(
   short volatile * Destination,
   short Exchange,
   short Comparand
);
short _InterlockedCompareExchange16_np(
   short volatile * Destination,
   short Exchange,
   short Comparand
);
short _InterlockedCompareExchange16_rel(
   short volatile * Destination,
   short Exchange,
   short Comparand
);
long long _InterlockedCompareExchange64(
   long long volatile * Destination,
   long long Exchange,
   long long Comparand
);
long long _InterlockedCompareExchange64_acq(
   long long volatile * Destination,
   long long Exchange,
   long long Comparand
);
long long _InterlockedCompareExchange64_HLEAcquire (
   long long volatile * Destination,
   long long Exchange,
   long long Comparand
);
long long _InterlockedCompareExchange64_HLERelease(
   long long volatile * Destination,
   long long Exchange,
   long long Comparand
);
long long _InterlockedCompareExchange64_nf(
   long long volatile * Destination,
   long long Exchange,
   long long Comparand
);
long long _InterlockedCompareExchange64_np(
   long long volatile * Destination,
   long long Exchange,
   long long Comparand
);
long long _InterlockedCompareExchange64_rel(
   long long volatile * Destination,
   long long Exchange,
   long long Comparand
);

#endif
