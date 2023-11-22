const std = @import("std");

pub const target = std.c;

pub fn with(comptime substitutes: anytype) type {
	return struct {
		pub const tokenizer = if (@hasDecl(substitutes, "tokenizer")) substitutes.tokenizer else std.c.tokenizer;
		pub const Token = if (@hasDecl(substitutes, "Token")) substitutes.Token else std.c.Token;
		pub const Tokenizer = if (@hasDecl(substitutes, "Tokenizer")) substitutes.Tokenizer else std.c.Tokenizer;
		pub const versionCheck = if (@hasDecl(substitutes, "versionCheck")) substitutes.versionCheck else std.c.versionCheck;
		pub const _errno = if (@hasDecl(substitutes, "_errno")) substitutes._errno else std.c._errno;
		pub const _msize = if (@hasDecl(substitutes, "_msize")) substitutes._msize else std.c._msize;
		pub const clock_getres = if (@hasDecl(substitutes, "clock_getres")) substitutes.clock_getres else std.c.clock_getres;
		pub const clock_gettime = if (@hasDecl(substitutes, "clock_gettime")) substitutes.clock_gettime else std.c.clock_gettime;
		pub const fstat = if (@hasDecl(substitutes, "fstat")) substitutes.fstat else std.c.fstat;
		pub const getrusage = if (@hasDecl(substitutes, "getrusage")) substitutes.getrusage else std.c.getrusage;
		pub const gettimeofday = if (@hasDecl(substitutes, "gettimeofday")) substitutes.gettimeofday else std.c.gettimeofday;
		pub const nanosleep = if (@hasDecl(substitutes, "nanosleep")) substitutes.nanosleep else std.c.nanosleep;
		pub const sched_yield = if (@hasDecl(substitutes, "sched_yield")) substitutes.sched_yield else std.c.sched_yield;
		pub const sigaction = if (@hasDecl(substitutes, "sigaction")) substitutes.sigaction else std.c.sigaction;
		pub const sigprocmask = if (@hasDecl(substitutes, "sigprocmask")) substitutes.sigprocmask else std.c.sigprocmask;
		pub const stat = if (@hasDecl(substitutes, "stat")) substitutes.stat else std.c.stat;
		pub const sigfillset = if (@hasDecl(substitutes, "sigfillset")) substitutes.sigfillset else std.c.sigfillset;
		pub const alarm = if (@hasDecl(substitutes, "alarm")) substitutes.alarm else std.c.alarm;
		pub const sigwait = if (@hasDecl(substitutes, "sigwait")) substitutes.sigwait else std.c.sigwait;
		pub const fd_t = if (@hasDecl(substitutes, "fd_t")) substitutes.fd_t else std.c.fd_t;
		pub const ino_t = if (@hasDecl(substitutes, "ino_t")) substitutes.ino_t else std.c.ino_t;
		pub const pid_t = if (@hasDecl(substitutes, "pid_t")) substitutes.pid_t else std.c.pid_t;
		pub const mode_t = if (@hasDecl(substitutes, "mode_t")) substitutes.mode_t else std.c.mode_t;
		pub const PATH_MAX = if (@hasDecl(substitutes, "PATH_MAX")) substitutes.PATH_MAX else std.c.PATH_MAX;
		pub const time_t = if (@hasDecl(substitutes, "time_t")) substitutes.time_t else std.c.time_t;
		pub const timespec = if (@hasDecl(substitutes, "timespec")) substitutes.timespec else std.c.timespec;
		pub const timeval = if (@hasDecl(substitutes, "timeval")) substitutes.timeval else std.c.timeval;
		pub const Stat = if (@hasDecl(substitutes, "Stat")) substitutes.Stat else std.c.Stat;
		pub const sig_atomic_t = if (@hasDecl(substitutes, "sig_atomic_t")) substitutes.sig_atomic_t else std.c.sig_atomic_t;
		pub const sigset_t = if (@hasDecl(substitutes, "sigset_t")) substitutes.sigset_t else std.c.sigset_t;
		pub const Sigaction = if (@hasDecl(substitutes, "Sigaction")) substitutes.Sigaction else std.c.Sigaction;
		pub const timezone = if (@hasDecl(substitutes, "timezone")) substitutes.timezone else std.c.timezone;
		pub const rusage = if (@hasDecl(substitutes, "rusage")) substitutes.rusage else std.c.rusage;
		pub const NSIG = if (@hasDecl(substitutes, "NSIG")) substitutes.NSIG else std.c.NSIG;
		pub const SIG = if (@hasDecl(substitutes, "SIG")) substitutes.SIG else std.c.SIG;
		pub const SEEK = if (@hasDecl(substitutes, "SEEK")) substitutes.SEEK else std.c.SEEK;
		pub const PROT = if (@hasDecl(substitutes, "PROT")) substitutes.PROT else std.c.PROT;
		pub const E = if (@hasDecl(substitutes, "E")) substitutes.E else std.c.E;
		pub const STRUNCATE = if (@hasDecl(substitutes, "STRUNCATE")) substitutes.STRUNCATE else std.c.STRUNCATE;
		pub const F_OK = if (@hasDecl(substitutes, "F_OK")) substitutes.F_OK else std.c.F_OK;
		pub const AT = if (@hasDecl(substitutes, "AT")) substitutes.AT else std.c.AT;
		pub const in_port_t = if (@hasDecl(substitutes, "in_port_t")) substitutes.in_port_t else std.c.in_port_t;
		pub const sa_family_t = if (@hasDecl(substitutes, "sa_family_t")) substitutes.sa_family_t else std.c.sa_family_t;
		pub const socklen_t = if (@hasDecl(substitutes, "socklen_t")) substitutes.socklen_t else std.c.socklen_t;
		pub const sockaddr = if (@hasDecl(substitutes, "sockaddr")) substitutes.sockaddr else std.c.sockaddr;
		pub const in6_addr = if (@hasDecl(substitutes, "in6_addr")) substitutes.in6_addr else std.c.in6_addr;
		pub const in_addr = if (@hasDecl(substitutes, "in_addr")) substitutes.in_addr else std.c.in_addr;
		pub const addrinfo = if (@hasDecl(substitutes, "addrinfo")) substitutes.addrinfo else std.c.addrinfo;
		pub const AF = if (@hasDecl(substitutes, "AF")) substitutes.AF else std.c.AF;
		pub const MSG = if (@hasDecl(substitutes, "MSG")) substitutes.MSG else std.c.MSG;
		pub const SOCK = if (@hasDecl(substitutes, "SOCK")) substitutes.SOCK else std.c.SOCK;
		pub const TCP = if (@hasDecl(substitutes, "TCP")) substitutes.TCP else std.c.TCP;
		pub const IPPROTO = if (@hasDecl(substitutes, "IPPROTO")) substitutes.IPPROTO else std.c.IPPROTO;
		pub const BTHPROTO_RFCOMM = if (@hasDecl(substitutes, "BTHPROTO_RFCOMM")) substitutes.BTHPROTO_RFCOMM else std.c.BTHPROTO_RFCOMM;
		pub const nfds_t = if (@hasDecl(substitutes, "nfds_t")) substitutes.nfds_t else std.c.nfds_t;
		pub const pollfd = if (@hasDecl(substitutes, "pollfd")) substitutes.pollfd else std.c.pollfd;
		pub const POLL = if (@hasDecl(substitutes, "POLL")) substitutes.POLL else std.c.POLL;
		pub const SOL = if (@hasDecl(substitutes, "SOL")) substitutes.SOL else std.c.SOL;
		pub const SO = if (@hasDecl(substitutes, "SO")) substitutes.SO else std.c.SO;
		pub const PVD_CONFIG = if (@hasDecl(substitutes, "PVD_CONFIG")) substitutes.PVD_CONFIG else std.c.PVD_CONFIG;
		pub const O = if (@hasDecl(substitutes, "O")) substitutes.O else std.c.O;
		pub const IFNAMESIZE = if (@hasDecl(substitutes, "IFNAMESIZE")) substitutes.IFNAMESIZE else std.c.IFNAMESIZE;
		pub const whence_t = if (@hasDecl(substitutes, "whence_t")) substitutes.whence_t else std.c.whence_t;
		pub const realpath = if (@hasDecl(substitutes, "realpath")) substitutes.realpath else std.c.realpath;
		pub const fstatat = if (@hasDecl(substitutes, "fstatat")) substitutes.fstatat else std.c.fstatat;
		pub const getErrno = if (@hasDecl(substitutes, "getErrno")) substitutes.getErrno else std.c.getErrno;
		pub const environ = if (@hasDecl(substitutes, "environ")) substitutes.environ else std.c.environ;
		pub const fopen = if (@hasDecl(substitutes, "fopen")) substitutes.fopen else std.c.fopen;
		pub const fclose = if (@hasDecl(substitutes, "fclose")) substitutes.fclose else std.c.fclose;
		pub const fwrite = if (@hasDecl(substitutes, "fwrite")) substitutes.fwrite else std.c.fwrite;
		pub const fread = if (@hasDecl(substitutes, "fread")) substitutes.fread else std.c.fread;
		pub const printf = if (@hasDecl(substitutes, "printf")) substitutes.printf else std.c.printf;
		pub const abort = if (@hasDecl(substitutes, "abort")) substitutes.abort else std.c.abort;
		pub const exit = if (@hasDecl(substitutes, "exit")) substitutes.exit else std.c.exit;
		pub const _exit = if (@hasDecl(substitutes, "_exit")) substitutes._exit else std.c._exit;
		pub const isatty = if (@hasDecl(substitutes, "isatty")) substitutes.isatty else std.c.isatty;
		pub const close = if (@hasDecl(substitutes, "close")) substitutes.close else std.c.close;
		pub const lseek = if (@hasDecl(substitutes, "lseek")) substitutes.lseek else std.c.lseek;
		pub const open = if (@hasDecl(substitutes, "open")) substitutes.open else std.c.open;
		pub const openat = if (@hasDecl(substitutes, "openat")) substitutes.openat else std.c.openat;
		pub const ftruncate = if (@hasDecl(substitutes, "ftruncate")) substitutes.ftruncate else std.c.ftruncate;
		pub const raise = if (@hasDecl(substitutes, "raise")) substitutes.raise else std.c.raise;
		pub const read = if (@hasDecl(substitutes, "read")) substitutes.read else std.c.read;
		pub const readv = if (@hasDecl(substitutes, "readv")) substitutes.readv else std.c.readv;
		pub const pread = if (@hasDecl(substitutes, "pread")) substitutes.pread else std.c.pread;
		pub const preadv = if (@hasDecl(substitutes, "preadv")) substitutes.preadv else std.c.preadv;
		pub const writev = if (@hasDecl(substitutes, "writev")) substitutes.writev else std.c.writev;
		pub const pwritev = if (@hasDecl(substitutes, "pwritev")) substitutes.pwritev else std.c.pwritev;
		pub const write = if (@hasDecl(substitutes, "write")) substitutes.write else std.c.write;
		pub const pwrite = if (@hasDecl(substitutes, "pwrite")) substitutes.pwrite else std.c.pwrite;
		pub const mmap = if (@hasDecl(substitutes, "mmap")) substitutes.mmap else std.c.mmap;
		pub const munmap = if (@hasDecl(substitutes, "munmap")) substitutes.munmap else std.c.munmap;
		pub const mprotect = if (@hasDecl(substitutes, "mprotect")) substitutes.mprotect else std.c.mprotect;
		pub const link = if (@hasDecl(substitutes, "link")) substitutes.link else std.c.link;
		pub const linkat = if (@hasDecl(substitutes, "linkat")) substitutes.linkat else std.c.linkat;
		pub const unlink = if (@hasDecl(substitutes, "unlink")) substitutes.unlink else std.c.unlink;
		pub const unlinkat = if (@hasDecl(substitutes, "unlinkat")) substitutes.unlinkat else std.c.unlinkat;
		pub const getcwd = if (@hasDecl(substitutes, "getcwd")) substitutes.getcwd else std.c.getcwd;
		pub const waitpid = if (@hasDecl(substitutes, "waitpid")) substitutes.waitpid else std.c.waitpid;
		pub const wait4 = if (@hasDecl(substitutes, "wait4")) substitutes.wait4 else std.c.wait4;
		pub const fork = if (@hasDecl(substitutes, "fork")) substitutes.fork else std.c.fork;
		pub const access = if (@hasDecl(substitutes, "access")) substitutes.access else std.c.access;
		pub const faccessat = if (@hasDecl(substitutes, "faccessat")) substitutes.faccessat else std.c.faccessat;
		pub const pipe = if (@hasDecl(substitutes, "pipe")) substitutes.pipe else std.c.pipe;
		pub const mkdir = if (@hasDecl(substitutes, "mkdir")) substitutes.mkdir else std.c.mkdir;
		pub const mkdirat = if (@hasDecl(substitutes, "mkdirat")) substitutes.mkdirat else std.c.mkdirat;
		pub const symlink = if (@hasDecl(substitutes, "symlink")) substitutes.symlink else std.c.symlink;
		pub const symlinkat = if (@hasDecl(substitutes, "symlinkat")) substitutes.symlinkat else std.c.symlinkat;
		pub const rename = if (@hasDecl(substitutes, "rename")) substitutes.rename else std.c.rename;
		pub const renameat = if (@hasDecl(substitutes, "renameat")) substitutes.renameat else std.c.renameat;
		pub const chdir = if (@hasDecl(substitutes, "chdir")) substitutes.chdir else std.c.chdir;
		pub const fchdir = if (@hasDecl(substitutes, "fchdir")) substitutes.fchdir else std.c.fchdir;
		pub const execve = if (@hasDecl(substitutes, "execve")) substitutes.execve else std.c.execve;
		pub const dup = if (@hasDecl(substitutes, "dup")) substitutes.dup else std.c.dup;
		pub const dup2 = if (@hasDecl(substitutes, "dup2")) substitutes.dup2 else std.c.dup2;
		pub const readlink = if (@hasDecl(substitutes, "readlink")) substitutes.readlink else std.c.readlink;
		pub const readlinkat = if (@hasDecl(substitutes, "readlinkat")) substitutes.readlinkat else std.c.readlinkat;
		pub const chmod = if (@hasDecl(substitutes, "chmod")) substitutes.chmod else std.c.chmod;
		pub const fchmod = if (@hasDecl(substitutes, "fchmod")) substitutes.fchmod else std.c.fchmod;
		pub const fchmodat = if (@hasDecl(substitutes, "fchmodat")) substitutes.fchmodat else std.c.fchmodat;
		pub const fchown = if (@hasDecl(substitutes, "fchown")) substitutes.fchown else std.c.fchown;
		pub const umask = if (@hasDecl(substitutes, "umask")) substitutes.umask else std.c.umask;
		pub const rmdir = if (@hasDecl(substitutes, "rmdir")) substitutes.rmdir else std.c.rmdir;
		pub const getenv = if (@hasDecl(substitutes, "getenv")) substitutes.getenv else std.c.getenv;
		pub const sysctl = if (@hasDecl(substitutes, "sysctl")) substitutes.sysctl else std.c.sysctl;
		pub const sysctlbyname = if (@hasDecl(substitutes, "sysctlbyname")) substitutes.sysctlbyname else std.c.sysctlbyname;
		pub const sysctlnametomib = if (@hasDecl(substitutes, "sysctlnametomib")) substitutes.sysctlnametomib else std.c.sysctlnametomib;
		pub const tcgetattr = if (@hasDecl(substitutes, "tcgetattr")) substitutes.tcgetattr else std.c.tcgetattr;
		pub const tcsetattr = if (@hasDecl(substitutes, "tcsetattr")) substitutes.tcsetattr else std.c.tcsetattr;
		pub const fcntl = if (@hasDecl(substitutes, "fcntl")) substitutes.fcntl else std.c.fcntl;
		pub const flock = if (@hasDecl(substitutes, "flock")) substitutes.flock else std.c.flock;
		pub const ioctl = if (@hasDecl(substitutes, "ioctl")) substitutes.ioctl else std.c.ioctl;
		pub const uname = if (@hasDecl(substitutes, "uname")) substitutes.uname else std.c.uname;
		pub const gethostname = if (@hasDecl(substitutes, "gethostname")) substitutes.gethostname else std.c.gethostname;
		pub const shutdown = if (@hasDecl(substitutes, "shutdown")) substitutes.shutdown else std.c.shutdown;
		pub const bind = if (@hasDecl(substitutes, "bind")) substitutes.bind else std.c.bind;
		pub const socketpair = if (@hasDecl(substitutes, "socketpair")) substitutes.socketpair else std.c.socketpair;
		pub const listen = if (@hasDecl(substitutes, "listen")) substitutes.listen else std.c.listen;
		pub const getsockname = if (@hasDecl(substitutes, "getsockname")) substitutes.getsockname else std.c.getsockname;
		pub const getpeername = if (@hasDecl(substitutes, "getpeername")) substitutes.getpeername else std.c.getpeername;
		pub const connect = if (@hasDecl(substitutes, "connect")) substitutes.connect else std.c.connect;
		pub const accept = if (@hasDecl(substitutes, "accept")) substitutes.accept else std.c.accept;
		pub const accept4 = if (@hasDecl(substitutes, "accept4")) substitutes.accept4 else std.c.accept4;
		pub const getsockopt = if (@hasDecl(substitutes, "getsockopt")) substitutes.getsockopt else std.c.getsockopt;
		pub const setsockopt = if (@hasDecl(substitutes, "setsockopt")) substitutes.setsockopt else std.c.setsockopt;
		pub const send = if (@hasDecl(substitutes, "send")) substitutes.send else std.c.send;
		pub const sendto = if (@hasDecl(substitutes, "sendto")) substitutes.sendto else std.c.sendto;
		pub const sendmsg = if (@hasDecl(substitutes, "sendmsg")) substitutes.sendmsg else std.c.sendmsg;
		pub const recv = if (@hasDecl(substitutes, "recv")) substitutes.recv else std.c.recv;
		pub const recvfrom = if (@hasDecl(substitutes, "recvfrom")) substitutes.recvfrom else std.c.recvfrom;
		pub const recvmsg = if (@hasDecl(substitutes, "recvmsg")) substitutes.recvmsg else std.c.recvmsg;
		pub const kill = if (@hasDecl(substitutes, "kill")) substitutes.kill else std.c.kill;
		pub const getdirentries = if (@hasDecl(substitutes, "getdirentries")) substitutes.getdirentries else std.c.getdirentries;
		pub const setuid = if (@hasDecl(substitutes, "setuid")) substitutes.setuid else std.c.setuid;
		pub const setgid = if (@hasDecl(substitutes, "setgid")) substitutes.setgid else std.c.setgid;
		pub const seteuid = if (@hasDecl(substitutes, "seteuid")) substitutes.seteuid else std.c.seteuid;
		pub const setegid = if (@hasDecl(substitutes, "setegid")) substitutes.setegid else std.c.setegid;
		pub const setreuid = if (@hasDecl(substitutes, "setreuid")) substitutes.setreuid else std.c.setreuid;
		pub const setregid = if (@hasDecl(substitutes, "setregid")) substitutes.setregid else std.c.setregid;
		pub const setresuid = if (@hasDecl(substitutes, "setresuid")) substitutes.setresuid else std.c.setresuid;
		pub const setresgid = if (@hasDecl(substitutes, "setresgid")) substitutes.setresgid else std.c.setresgid;
		pub const malloc = if (@hasDecl(substitutes, "malloc")) substitutes.malloc else std.c.malloc;
		pub const realloc = if (@hasDecl(substitutes, "realloc")) substitutes.realloc else std.c.realloc;
		pub const free = if (@hasDecl(substitutes, "free")) substitutes.free else std.c.free;
		pub const futimes = if (@hasDecl(substitutes, "futimes")) substitutes.futimes else std.c.futimes;
		pub const utimes = if (@hasDecl(substitutes, "utimes")) substitutes.utimes else std.c.utimes;
		pub const utimensat = if (@hasDecl(substitutes, "utimensat")) substitutes.utimensat else std.c.utimensat;
		pub const futimens = if (@hasDecl(substitutes, "futimens")) substitutes.futimens else std.c.futimens;
		pub const pthread_create = if (@hasDecl(substitutes, "pthread_create")) substitutes.pthread_create else std.c.pthread_create;
		pub const pthread_attr_init = if (@hasDecl(substitutes, "pthread_attr_init")) substitutes.pthread_attr_init else std.c.pthread_attr_init;
		pub const pthread_attr_setstack = if (@hasDecl(substitutes, "pthread_attr_setstack")) substitutes.pthread_attr_setstack else std.c.pthread_attr_setstack;
		pub const pthread_attr_setstacksize = if (@hasDecl(substitutes, "pthread_attr_setstacksize")) substitutes.pthread_attr_setstacksize else std.c.pthread_attr_setstacksize;
		pub const pthread_attr_setguardsize = if (@hasDecl(substitutes, "pthread_attr_setguardsize")) substitutes.pthread_attr_setguardsize else std.c.pthread_attr_setguardsize;
		pub const pthread_attr_destroy = if (@hasDecl(substitutes, "pthread_attr_destroy")) substitutes.pthread_attr_destroy else std.c.pthread_attr_destroy;
		pub const pthread_self = if (@hasDecl(substitutes, "pthread_self")) substitutes.pthread_self else std.c.pthread_self;
		pub const pthread_join = if (@hasDecl(substitutes, "pthread_join")) substitutes.pthread_join else std.c.pthread_join;
		pub const pthread_detach = if (@hasDecl(substitutes, "pthread_detach")) substitutes.pthread_detach else std.c.pthread_detach;
		pub const pthread_atfork = if (@hasDecl(substitutes, "pthread_atfork")) substitutes.pthread_atfork else std.c.pthread_atfork;
		pub const pthread_key_create = if (@hasDecl(substitutes, "pthread_key_create")) substitutes.pthread_key_create else std.c.pthread_key_create;
		pub const pthread_key_delete = if (@hasDecl(substitutes, "pthread_key_delete")) substitutes.pthread_key_delete else std.c.pthread_key_delete;
		pub const pthread_getspecific = if (@hasDecl(substitutes, "pthread_getspecific")) substitutes.pthread_getspecific else std.c.pthread_getspecific;
		pub const pthread_setspecific = if (@hasDecl(substitutes, "pthread_setspecific")) substitutes.pthread_setspecific else std.c.pthread_setspecific;
		pub const pthread_sigmask = if (@hasDecl(substitutes, "pthread_sigmask")) substitutes.pthread_sigmask else std.c.pthread_sigmask;
		pub const sem_init = if (@hasDecl(substitutes, "sem_init")) substitutes.sem_init else std.c.sem_init;
		pub const sem_destroy = if (@hasDecl(substitutes, "sem_destroy")) substitutes.sem_destroy else std.c.sem_destroy;
		pub const sem_open = if (@hasDecl(substitutes, "sem_open")) substitutes.sem_open else std.c.sem_open;
		pub const sem_close = if (@hasDecl(substitutes, "sem_close")) substitutes.sem_close else std.c.sem_close;
		pub const sem_post = if (@hasDecl(substitutes, "sem_post")) substitutes.sem_post else std.c.sem_post;
		pub const sem_wait = if (@hasDecl(substitutes, "sem_wait")) substitutes.sem_wait else std.c.sem_wait;
		pub const sem_trywait = if (@hasDecl(substitutes, "sem_trywait")) substitutes.sem_trywait else std.c.sem_trywait;
		pub const sem_timedwait = if (@hasDecl(substitutes, "sem_timedwait")) substitutes.sem_timedwait else std.c.sem_timedwait;
		pub const sem_getvalue = if (@hasDecl(substitutes, "sem_getvalue")) substitutes.sem_getvalue else std.c.sem_getvalue;
		pub const shm_open = if (@hasDecl(substitutes, "shm_open")) substitutes.shm_open else std.c.shm_open;
		pub const shm_unlink = if (@hasDecl(substitutes, "shm_unlink")) substitutes.shm_unlink else std.c.shm_unlink;
		pub const kqueue = if (@hasDecl(substitutes, "kqueue")) substitutes.kqueue else std.c.kqueue;
		pub const kevent = if (@hasDecl(substitutes, "kevent")) substitutes.kevent else std.c.kevent;
		pub const port_create = if (@hasDecl(substitutes, "port_create")) substitutes.port_create else std.c.port_create;
		pub const port_associate = if (@hasDecl(substitutes, "port_associate")) substitutes.port_associate else std.c.port_associate;
		pub const port_dissociate = if (@hasDecl(substitutes, "port_dissociate")) substitutes.port_dissociate else std.c.port_dissociate;
		pub const port_send = if (@hasDecl(substitutes, "port_send")) substitutes.port_send else std.c.port_send;
		pub const port_sendn = if (@hasDecl(substitutes, "port_sendn")) substitutes.port_sendn else std.c.port_sendn;
		pub const port_get = if (@hasDecl(substitutes, "port_get")) substitutes.port_get else std.c.port_get;
		pub const port_getn = if (@hasDecl(substitutes, "port_getn")) substitutes.port_getn else std.c.port_getn;
		pub const port_alert = if (@hasDecl(substitutes, "port_alert")) substitutes.port_alert else std.c.port_alert;
		pub const getaddrinfo = if (@hasDecl(substitutes, "getaddrinfo")) substitutes.getaddrinfo else std.c.getaddrinfo;
		pub const freeaddrinfo = if (@hasDecl(substitutes, "freeaddrinfo")) substitutes.freeaddrinfo else std.c.freeaddrinfo;
		pub const getnameinfo = if (@hasDecl(substitutes, "getnameinfo")) substitutes.getnameinfo else std.c.getnameinfo;
		pub const gai_strerror = if (@hasDecl(substitutes, "gai_strerror")) substitutes.gai_strerror else std.c.gai_strerror;
		pub const poll = if (@hasDecl(substitutes, "poll")) substitutes.poll else std.c.poll;
		pub const ppoll = if (@hasDecl(substitutes, "ppoll")) substitutes.ppoll else std.c.ppoll;
		pub const dn_expand = if (@hasDecl(substitutes, "dn_expand")) substitutes.dn_expand else std.c.dn_expand;
		pub const PTHREAD_MUTEX_INITIALIZER = if (@hasDecl(substitutes, "PTHREAD_MUTEX_INITIALIZER")) substitutes.PTHREAD_MUTEX_INITIALIZER else std.c.PTHREAD_MUTEX_INITIALIZER;
		pub const pthread_mutex_lock = if (@hasDecl(substitutes, "pthread_mutex_lock")) substitutes.pthread_mutex_lock else std.c.pthread_mutex_lock;
		pub const pthread_mutex_unlock = if (@hasDecl(substitutes, "pthread_mutex_unlock")) substitutes.pthread_mutex_unlock else std.c.pthread_mutex_unlock;
		pub const pthread_mutex_trylock = if (@hasDecl(substitutes, "pthread_mutex_trylock")) substitutes.pthread_mutex_trylock else std.c.pthread_mutex_trylock;
		pub const pthread_mutex_destroy = if (@hasDecl(substitutes, "pthread_mutex_destroy")) substitutes.pthread_mutex_destroy else std.c.pthread_mutex_destroy;
		pub const PTHREAD_COND_INITIALIZER = if (@hasDecl(substitutes, "PTHREAD_COND_INITIALIZER")) substitutes.PTHREAD_COND_INITIALIZER else std.c.PTHREAD_COND_INITIALIZER;
		pub const pthread_cond_wait = if (@hasDecl(substitutes, "pthread_cond_wait")) substitutes.pthread_cond_wait else std.c.pthread_cond_wait;
		pub const pthread_cond_timedwait = if (@hasDecl(substitutes, "pthread_cond_timedwait")) substitutes.pthread_cond_timedwait else std.c.pthread_cond_timedwait;
		pub const pthread_cond_signal = if (@hasDecl(substitutes, "pthread_cond_signal")) substitutes.pthread_cond_signal else std.c.pthread_cond_signal;
		pub const pthread_cond_broadcast = if (@hasDecl(substitutes, "pthread_cond_broadcast")) substitutes.pthread_cond_broadcast else std.c.pthread_cond_broadcast;
		pub const pthread_cond_destroy = if (@hasDecl(substitutes, "pthread_cond_destroy")) substitutes.pthread_cond_destroy else std.c.pthread_cond_destroy;
		pub const pthread_rwlock_destroy = if (@hasDecl(substitutes, "pthread_rwlock_destroy")) substitutes.pthread_rwlock_destroy else std.c.pthread_rwlock_destroy;
		pub const pthread_rwlock_rdlock = if (@hasDecl(substitutes, "pthread_rwlock_rdlock")) substitutes.pthread_rwlock_rdlock else std.c.pthread_rwlock_rdlock;
		pub const pthread_rwlock_wrlock = if (@hasDecl(substitutes, "pthread_rwlock_wrlock")) substitutes.pthread_rwlock_wrlock else std.c.pthread_rwlock_wrlock;
		pub const pthread_rwlock_tryrdlock = if (@hasDecl(substitutes, "pthread_rwlock_tryrdlock")) substitutes.pthread_rwlock_tryrdlock else std.c.pthread_rwlock_tryrdlock;
		pub const pthread_rwlock_trywrlock = if (@hasDecl(substitutes, "pthread_rwlock_trywrlock")) substitutes.pthread_rwlock_trywrlock else std.c.pthread_rwlock_trywrlock;
		pub const pthread_rwlock_unlock = if (@hasDecl(substitutes, "pthread_rwlock_unlock")) substitutes.pthread_rwlock_unlock else std.c.pthread_rwlock_unlock;
		pub const pthread_t = if (@hasDecl(substitutes, "pthread_t")) substitutes.pthread_t else std.c.pthread_t;
		pub const FILE = if (@hasDecl(substitutes, "FILE")) substitutes.FILE else std.c.FILE;
		pub const dlopen = if (@hasDecl(substitutes, "dlopen")) substitutes.dlopen else std.c.dlopen;
		pub const dlclose = if (@hasDecl(substitutes, "dlclose")) substitutes.dlclose else std.c.dlclose;
		pub const dlsym = if (@hasDecl(substitutes, "dlsym")) substitutes.dlsym else std.c.dlsym;
		pub const sync = if (@hasDecl(substitutes, "sync")) substitutes.sync else std.c.sync;
		pub const syncfs = if (@hasDecl(substitutes, "syncfs")) substitutes.syncfs else std.c.syncfs;
		pub const fsync = if (@hasDecl(substitutes, "fsync")) substitutes.fsync else std.c.fsync;
		pub const fdatasync = if (@hasDecl(substitutes, "fdatasync")) substitutes.fdatasync else std.c.fdatasync;
		pub const prctl = if (@hasDecl(substitutes, "prctl")) substitutes.prctl else std.c.prctl;
		pub const getrlimit = if (@hasDecl(substitutes, "getrlimit")) substitutes.getrlimit else std.c.getrlimit;
		pub const setrlimit = if (@hasDecl(substitutes, "setrlimit")) substitutes.setrlimit else std.c.setrlimit;
		pub const fmemopen = if (@hasDecl(substitutes, "fmemopen")) substitutes.fmemopen else std.c.fmemopen;
		pub const syslog = if (@hasDecl(substitutes, "syslog")) substitutes.syslog else std.c.syslog;
		pub const openlog = if (@hasDecl(substitutes, "openlog")) substitutes.openlog else std.c.openlog;
		pub const closelog = if (@hasDecl(substitutes, "closelog")) substitutes.closelog else std.c.closelog;
		pub const setlogmask = if (@hasDecl(substitutes, "setlogmask")) substitutes.setlogmask else std.c.setlogmask;
		pub const if_nametoindex = if (@hasDecl(substitutes, "if_nametoindex")) substitutes.if_nametoindex else std.c.if_nametoindex;
		pub const getcontext = if (@hasDecl(substitutes, "getcontext")) substitutes.getcontext else std.c.getcontext;
		pub const max_align_t = if (@hasDecl(substitutes, "max_align_t")) substitutes.max_align_t else std.c.max_align_t;
	};
}
