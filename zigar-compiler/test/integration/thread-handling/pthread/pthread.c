#define _GNU_SOURCE
#define __wasilibc_unmodified_upstream
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>
#include <time.h>

void* run_function_once(void* arg) {
    pthread_once(PTHREAD_ONCE_INIT, (void (*)(void)) arg);
    return NULL;
}

bool spawn_run_function_once(void *routine) {
    for (int i = 0; i < 4; i++) {
        pthread_t thread_id;
        if (pthread_create(&thread_id, NULL, run_function_once, routine) != 0) return false;
        pthread_detach(thread_id);
    }
    return true;
}

pthread_mutex_t mutex;
pthread_cond_t cond;

void* run_wait_for_condition(void *arg) {
    pthread_mutex_lock(&mutex);
    printf("Thread waiting for condition\n");
    if (pthread_cond_wait(&cond, &mutex) == 0) {
        printf("Thread saw condition\n");
    }
    pthread_mutex_unlock(&mutex);
    return NULL;
}

bool spawn_create_condition() {
    if (pthread_mutex_init(&mutex, NULL) != 0) return false;
    pthread_condattr_t attrs;
    if (pthread_condattr_init(&attrs) != 0) return false;
    if (pthread_condattr_setclock(&attrs, CLOCK_REALTIME) != 0) return false;
    if (pthread_cond_init(&cond, &attrs) != 0) return false;
    pthread_t thread_id;
    for (int i = 0; i < 3; i++) {
        if (pthread_create(&thread_id, NULL, run_wait_for_condition, NULL) != 0) return false;
        if (pthread_detach(thread_id) != 0) return false;
    }
}

// pub fn spawn() !void {
//     if (c.pthread_mutex_init(&mutex, null) != 0) return error.CannotCreateMutex;
//     var attrs: pthread_condattr_t = undefined;
//     if (c.pthread_condattr_init(&attrs) != 0) return error.CannotCreateConditionAttributes;
//     if (@hasDecl(c, "pthread_condattr_setclock")) {
//         if (pthread_condattr_setclock(&attrs, .REALTIME) != 0) return error.CannotSetConditionAttribute;
//     }
//     if (c.pthread_cond_init(&cond, &attrs) != 0) return error.CannotCreateCondition;
//     var thread_id: pthread_t = undefined;
//     for (0..3) |_| {
//         if (c.pthread_create(&thread_id, null, run, null) != 0) return error.CannotCreateThread;
//         if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
//     }
// }

// pub fn signal() !void {
//     if (c.pthread_cond_signal(&cond) != 0) return error.CannotSignalCondition;
// }

// pub fn broadcast() !void {
//     if (c.pthread_cond_broadcast(&cond) != 0) return error.CannotBroadcastCondition;
// }

