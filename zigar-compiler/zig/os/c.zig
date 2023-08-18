const std = @import("std");

pub const target = std.c;

pub fn with(comptime substitutes: anytype) type {
	return struct {
		pub const tokenizer = if (@hasDecl(substitutes, "tokenizer")) substitutes.tokenizer else std.c.tokenizer;
		pub const Token = if (@hasDecl(substitutes, "Token")) substitutes.Token else std.c.Token;
		pub const Tokenizer = if (@hasDecl(substitutes, "Tokenizer")) substitutes.Tokenizer else std.c.Tokenizer;
		pub const versionCheck = if (@hasDecl(substitutes, "versionCheck")) substitutes.versionCheck else std.c.versionCheck;
		pub const AF = if (@hasDecl(substitutes, "AF")) substitutes.AF else std.c.AF;
		pub const ARCH = if (@hasDecl(substitutes, "ARCH")) substitutes.ARCH else std.c.ARCH;
		pub const AT = if (@hasDecl(substitutes, "AT")) substitutes.AT else std.c.AT;
		pub const CLOCK = if (@hasDecl(substitutes, "CLOCK")) substitutes.CLOCK else std.c.CLOCK;
		pub const CPU_COUNT = if (@hasDecl(substitutes, "CPU_COUNT")) substitutes.CPU_COUNT else std.c.CPU_COUNT;
		pub const E = if (@hasDecl(substitutes, "E")) substitutes.E else std.c.E;
		pub const Elf_Symndx = if (@hasDecl(substitutes, "Elf_Symndx")) substitutes.Elf_Symndx else std.c.Elf_Symndx;
		pub const F = if (@hasDecl(substitutes, "F")) substitutes.F else std.c.F;
		pub const FD_CLOEXEC = if (@hasDecl(substitutes, "FD_CLOEXEC")) substitutes.FD_CLOEXEC else std.c.FD_CLOEXEC;
		pub const F_OK = if (@hasDecl(substitutes, "F_OK")) substitutes.F_OK else std.c.F_OK;
		pub const Flock = if (@hasDecl(substitutes, "Flock")) substitutes.Flock else std.c.Flock;
		pub const HOST_NAME_MAX = if (@hasDecl(substitutes, "HOST_NAME_MAX")) substitutes.HOST_NAME_MAX else std.c.HOST_NAME_MAX;
		pub const IFNAMESIZE = if (@hasDecl(substitutes, "IFNAMESIZE")) substitutes.IFNAMESIZE else std.c.IFNAMESIZE;
		pub const IOV_MAX = if (@hasDecl(substitutes, "IOV_MAX")) substitutes.IOV_MAX else std.c.IOV_MAX;
		pub const IPPROTO = if (@hasDecl(substitutes, "IPPROTO")) substitutes.IPPROTO else std.c.IPPROTO;
		pub const LOCK = if (@hasDecl(substitutes, "LOCK")) substitutes.LOCK else std.c.LOCK;
		pub const MADV = if (@hasDecl(substitutes, "MADV")) substitutes.MADV else std.c.MADV;
		pub const MAP = if (@hasDecl(substitutes, "MAP")) substitutes.MAP else std.c.MAP;
		pub const MSF = if (@hasDecl(substitutes, "MSF")) substitutes.MSF else std.c.MSF;
		pub const MMAP2_UNIT = if (@hasDecl(substitutes, "MMAP2_UNIT")) substitutes.MMAP2_UNIT else std.c.MMAP2_UNIT;
		pub const MSG = if (@hasDecl(substitutes, "MSG")) substitutes.MSG else std.c.MSG;
		pub const NAME_MAX = if (@hasDecl(substitutes, "NAME_MAX")) substitutes.NAME_MAX else std.c.NAME_MAX;
		pub const O = if (@hasDecl(substitutes, "O")) substitutes.O else std.c.O;
		pub const PATH_MAX = if (@hasDecl(substitutes, "PATH_MAX")) substitutes.PATH_MAX else std.c.PATH_MAX;
		pub const POLL = if (@hasDecl(substitutes, "POLL")) substitutes.POLL else std.c.POLL;
		pub const PROT = if (@hasDecl(substitutes, "PROT")) substitutes.PROT else std.c.PROT;
		pub const REG = if (@hasDecl(substitutes, "REG")) substitutes.REG else std.c.REG;
		pub const RLIM = if (@hasDecl(substitutes, "RLIM")) substitutes.RLIM else std.c.RLIM;
		pub const R_OK = if (@hasDecl(substitutes, "R_OK")) substitutes.R_OK else std.c.R_OK;
		pub const S = if (@hasDecl(substitutes, "S")) substitutes.S else std.c.S;
		pub const SA = if (@hasDecl(substitutes, "SA")) substitutes.SA else std.c.SA;
		pub const SC = if (@hasDecl(substitutes, "SC")) substitutes.SC else std.c.SC;
		pub const SEEK = if (@hasDecl(substitutes, "SEEK")) substitutes.SEEK else std.c.SEEK;
		pub const SHUT = if (@hasDecl(substitutes, "SHUT")) substitutes.SHUT else std.c.SHUT;
		pub const SIG = if (@hasDecl(substitutes, "SIG")) substitutes.SIG else std.c.SIG;
		pub const SIOCGIFINDEX = if (@hasDecl(substitutes, "SIOCGIFINDEX")) substitutes.SIOCGIFINDEX else std.c.SIOCGIFINDEX;
		pub const SO = if (@hasDecl(substitutes, "SO")) substitutes.SO else std.c.SO;
		pub const SOCK = if (@hasDecl(substitutes, "SOCK")) substitutes.SOCK else std.c.SOCK;
		pub const SOL = if (@hasDecl(substitutes, "SOL")) substitutes.SOL else std.c.SOL;
		pub const STDERR_FILENO = if (@hasDecl(substitutes, "STDERR_FILENO")) substitutes.STDERR_FILENO else std.c.STDERR_FILENO;
		pub const STDIN_FILENO = if (@hasDecl(substitutes, "STDIN_FILENO")) substitutes.STDIN_FILENO else std.c.STDIN_FILENO;
		pub const STDOUT_FILENO = if (@hasDecl(substitutes, "STDOUT_FILENO")) substitutes.STDOUT_FILENO else std.c.STDOUT_FILENO;
		pub const SYS = if (@hasDecl(substitutes, "SYS")) substitutes.SYS else std.c.SYS;
		pub const Sigaction = if (@hasDecl(substitutes, "Sigaction")) substitutes.Sigaction else std.c.Sigaction;
		pub const TCP = if (@hasDecl(substitutes, "TCP")) substitutes.TCP else std.c.TCP;
		pub const TCSA = if (@hasDecl(substitutes, "TCSA")) substitutes.TCSA else std.c.TCSA;
		pub const VDSO = if (@hasDecl(substitutes, "VDSO")) substitutes.VDSO else std.c.VDSO;
		pub const W = if (@hasDecl(substitutes, "W")) substitutes.W else std.c.W;
		pub const W_OK = if (@hasDecl(substitutes, "W_OK")) substitutes.W_OK else std.c.W_OK;
		pub const X_OK = if (@hasDecl(substitutes, "X_OK")) substitutes.X_OK else std.c.X_OK;
		pub const addrinfo = if (@hasDecl(substitutes, "addrinfo")) substitutes.addrinfo else std.c.addrinfo;
		pub const blkcnt_t = if (@hasDecl(substitutes, "blkcnt_t")) substitutes.blkcnt_t else std.c.blkcnt_t;
		pub const blksize_t = if (@hasDecl(substitutes, "blksize_t")) substitutes.blksize_t else std.c.blksize_t;
		pub const clock_t = if (@hasDecl(substitutes, "clock_t")) substitutes.clock_t else std.c.clock_t;
		pub const cpu_set_t = if (@hasDecl(substitutes, "cpu_set_t")) substitutes.cpu_set_t else std.c.cpu_set_t;
		pub const dev_t = if (@hasDecl(substitutes, "dev_t")) substitutes.dev_t else std.c.dev_t;
		pub const dl_phdr_info = if (@hasDecl(substitutes, "dl_phdr_info")) substitutes.dl_phdr_info else std.c.dl_phdr_info;
		pub const empty_sigset = if (@hasDecl(substitutes, "empty_sigset")) substitutes.empty_sigset else std.c.empty_sigset;
		pub const epoll_event = if (@hasDecl(substitutes, "epoll_event")) substitutes.epoll_event else std.c.epoll_event;
		pub const fd_t = if (@hasDecl(substitutes, "fd_t")) substitutes.fd_t else std.c.fd_t;
		pub const gid_t = if (@hasDecl(substitutes, "gid_t")) substitutes.gid_t else std.c.gid_t;
		pub const ifreq = if (@hasDecl(substitutes, "ifreq")) substitutes.ifreq else std.c.ifreq;
		pub const ino_t = if (@hasDecl(substitutes, "ino_t")) substitutes.ino_t else std.c.ino_t;
		pub const mcontext_t = if (@hasDecl(substitutes, "mcontext_t")) substitutes.mcontext_t else std.c.mcontext_t;
		pub const mode_t = if (@hasDecl(substitutes, "mode_t")) substitutes.mode_t else std.c.mode_t;
		pub const msghdr = if (@hasDecl(substitutes, "msghdr")) substitutes.msghdr else std.c.msghdr;
		pub const msghdr_const = if (@hasDecl(substitutes, "msghdr_const")) substitutes.msghdr_const else std.c.msghdr_const;
		pub const nfds_t = if (@hasDecl(substitutes, "nfds_t")) substitutes.nfds_t else std.c.nfds_t;
		pub const nlink_t = if (@hasDecl(substitutes, "nlink_t")) substitutes.nlink_t else std.c.nlink_t;
		pub const off_t = if (@hasDecl(substitutes, "off_t")) substitutes.off_t else std.c.off_t;
		pub const pid_t = if (@hasDecl(substitutes, "pid_t")) substitutes.pid_t else std.c.pid_t;
		pub const pollfd = if (@hasDecl(substitutes, "pollfd")) substitutes.pollfd else std.c.pollfd;
		pub const rlim_t = if (@hasDecl(substitutes, "rlim_t")) substitutes.rlim_t else std.c.rlim_t;
		pub const rlimit = if (@hasDecl(substitutes, "rlimit")) substitutes.rlimit else std.c.rlimit;
		pub const rlimit_resource = if (@hasDecl(substitutes, "rlimit_resource")) substitutes.rlimit_resource else std.c.rlimit_resource;
		pub const rusage = if (@hasDecl(substitutes, "rusage")) substitutes.rusage else std.c.rusage;
		pub const siginfo_t = if (@hasDecl(substitutes, "siginfo_t")) substitutes.siginfo_t else std.c.siginfo_t;
		pub const sigset_t = if (@hasDecl(substitutes, "sigset_t")) substitutes.sigset_t else std.c.sigset_t;
		pub const sockaddr = if (@hasDecl(substitutes, "sockaddr")) substitutes.sockaddr else std.c.sockaddr;
		pub const socklen_t = if (@hasDecl(substitutes, "socklen_t")) substitutes.socklen_t else std.c.socklen_t;
		pub const stack_t = if (@hasDecl(substitutes, "stack_t")) substitutes.stack_t else std.c.stack_t;
		pub const tcflag_t = if (@hasDecl(substitutes, "tcflag_t")) substitutes.tcflag_t else std.c.tcflag_t;
		pub const termios = if (@hasDecl(substitutes, "termios")) substitutes.termios else std.c.termios;
		pub const time_t = if (@hasDecl(substitutes, "time_t")) substitutes.time_t else std.c.time_t;
		pub const timespec = if (@hasDecl(substitutes, "timespec")) substitutes.timespec else std.c.timespec;
		pub const timeval = if (@hasDecl(substitutes, "timeval")) substitutes.timeval else std.c.timeval;
		pub const timezone = if (@hasDecl(substitutes, "timezone")) substitutes.timezone else std.c.timezone;
		pub const ucontext_t = if (@hasDecl(substitutes, "ucontext_t")) substitutes.ucontext_t else std.c.ucontext_t;
		pub const uid_t = if (@hasDecl(substitutes, "uid_t")) substitutes.uid_t else std.c.uid_t;
		pub const user_desc = if (@hasDecl(substitutes, "user_desc")) substitutes.user_desc else std.c.user_desc;
		pub const utsname = if (@hasDecl(substitutes, "utsname")) substitutes.utsname else std.c.utsname;
		pub const PR = if (@hasDecl(substitutes, "PR")) substitutes.PR else std.c.PR;
		pub const _errno = if (@hasDecl(substitutes, "_errno")) substitutes._errno else std.c._errno;
		pub const Stat = if (@hasDecl(substitutes, "Stat")) substitutes.Stat else std.c.Stat;
		pub const AI = if (@hasDecl(substitutes, "AI")) substitutes.AI else std.c.AI;
		pub const NI = if (@hasDecl(substitutes, "NI")) substitutes.NI else std.c.NI;
		pub const EAI = if (@hasDecl(substitutes, "EAI")) substitutes.EAI else std.c.EAI;
		pub const fallocate64 = if (@hasDecl(substitutes, "fallocate64")) substitutes.fallocate64 else std.c.fallocate64;
		pub const fopen64 = if (@hasDecl(substitutes, "fopen64")) substitutes.fopen64 else std.c.fopen64;
		pub const fstat64 = if (@hasDecl(substitutes, "fstat64")) substitutes.fstat64 else std.c.fstat64;
		pub const fstatat64 = if (@hasDecl(substitutes, "fstatat64")) substitutes.fstatat64 else std.c.fstatat64;
		pub const ftruncate64 = if (@hasDecl(substitutes, "ftruncate64")) substitutes.ftruncate64 else std.c.ftruncate64;
		pub const getrlimit64 = if (@hasDecl(substitutes, "getrlimit64")) substitutes.getrlimit64 else std.c.getrlimit64;
		pub const lseek64 = if (@hasDecl(substitutes, "lseek64")) substitutes.lseek64 else std.c.lseek64;
		pub const mmap64 = if (@hasDecl(substitutes, "mmap64")) substitutes.mmap64 else std.c.mmap64;
		pub const open64 = if (@hasDecl(substitutes, "open64")) substitutes.open64 else std.c.open64;
		pub const openat64 = if (@hasDecl(substitutes, "openat64")) substitutes.openat64 else std.c.openat64;
		pub const pread64 = if (@hasDecl(substitutes, "pread64")) substitutes.pread64 else std.c.pread64;
		pub const preadv64 = if (@hasDecl(substitutes, "preadv64")) substitutes.preadv64 else std.c.preadv64;
		pub const pwrite64 = if (@hasDecl(substitutes, "pwrite64")) substitutes.pwrite64 else std.c.pwrite64;
		pub const pwritev64 = if (@hasDecl(substitutes, "pwritev64")) substitutes.pwritev64 else std.c.pwritev64;
		pub const sendfile64 = if (@hasDecl(substitutes, "sendfile64")) substitutes.sendfile64 else std.c.sendfile64;
		pub const setrlimit64 = if (@hasDecl(substitutes, "setrlimit64")) substitutes.setrlimit64 else std.c.setrlimit64;
		pub const getrandom = if (@hasDecl(substitutes, "getrandom")) substitutes.getrandom else std.c.getrandom;
		pub const sched_getaffinity = if (@hasDecl(substitutes, "sched_getaffinity")) substitutes.sched_getaffinity else std.c.sched_getaffinity;
		pub const eventfd = if (@hasDecl(substitutes, "eventfd")) substitutes.eventfd else std.c.eventfd;
		pub const epoll_ctl = if (@hasDecl(substitutes, "epoll_ctl")) substitutes.epoll_ctl else std.c.epoll_ctl;
		pub const epoll_create1 = if (@hasDecl(substitutes, "epoll_create1")) substitutes.epoll_create1 else std.c.epoll_create1;
		pub const epoll_wait = if (@hasDecl(substitutes, "epoll_wait")) substitutes.epoll_wait else std.c.epoll_wait;
		pub const epoll_pwait = if (@hasDecl(substitutes, "epoll_pwait")) substitutes.epoll_pwait else std.c.epoll_pwait;
		pub const inotify_init1 = if (@hasDecl(substitutes, "inotify_init1")) substitutes.inotify_init1 else std.c.inotify_init1;
		pub const inotify_add_watch = if (@hasDecl(substitutes, "inotify_add_watch")) substitutes.inotify_add_watch else std.c.inotify_add_watch;
		pub const inotify_rm_watch = if (@hasDecl(substitutes, "inotify_rm_watch")) substitutes.inotify_rm_watch else std.c.inotify_rm_watch;
		pub const getauxval = if (@hasDecl(substitutes, "getauxval")) substitutes.getauxval else std.c.getauxval;
		pub const dl_iterate_phdr_callback = if (@hasDecl(substitutes, "dl_iterate_phdr_callback")) substitutes.dl_iterate_phdr_callback else std.c.dl_iterate_phdr_callback;
		pub const dl_iterate_phdr = if (@hasDecl(substitutes, "dl_iterate_phdr")) substitutes.dl_iterate_phdr else std.c.dl_iterate_phdr;
		pub const sigaltstack = if (@hasDecl(substitutes, "sigaltstack")) substitutes.sigaltstack else std.c.sigaltstack;
		pub const memfd_create = if (@hasDecl(substitutes, "memfd_create")) substitutes.memfd_create else std.c.memfd_create;
		pub const pipe2 = if (@hasDecl(substitutes, "pipe2")) substitutes.pipe2 else std.c.pipe2;
		pub const fallocate = if (@hasDecl(substitutes, "fallocate")) substitutes.fallocate else std.c.fallocate;
		pub const sendfile = if (@hasDecl(substitutes, "sendfile")) substitutes.sendfile else std.c.sendfile;
		pub const copy_file_range = if (@hasDecl(substitutes, "copy_file_range")) substitutes.copy_file_range else std.c.copy_file_range;
		pub const signalfd = if (@hasDecl(substitutes, "signalfd")) substitutes.signalfd else std.c.signalfd;
		pub const prlimit = if (@hasDecl(substitutes, "prlimit")) substitutes.prlimit else std.c.prlimit;
		pub const posix_memalign = if (@hasDecl(substitutes, "posix_memalign")) substitutes.posix_memalign else std.c.posix_memalign;
		pub const malloc_usable_size = if (@hasDecl(substitutes, "malloc_usable_size")) substitutes.malloc_usable_size else std.c.malloc_usable_size;
		pub const mincore = if (@hasDecl(substitutes, "mincore")) substitutes.mincore else std.c.mincore;
		pub const madvise = if (@hasDecl(substitutes, "madvise")) substitutes.madvise else std.c.madvise;
		pub const pthread_attr_t = if (@hasDecl(substitutes, "pthread_attr_t")) substitutes.pthread_attr_t else std.c.pthread_attr_t;
		pub const pthread_mutex_t = if (@hasDecl(substitutes, "pthread_mutex_t")) substitutes.pthread_mutex_t else std.c.pthread_mutex_t;
		pub const pthread_cond_t = if (@hasDecl(substitutes, "pthread_cond_t")) substitutes.pthread_cond_t else std.c.pthread_cond_t;
		pub const pthread_rwlock_t = if (@hasDecl(substitutes, "pthread_rwlock_t")) substitutes.pthread_rwlock_t else std.c.pthread_rwlock_t;
		pub const pthread_key_t = if (@hasDecl(substitutes, "pthread_key_t")) substitutes.pthread_key_t else std.c.pthread_key_t;
		pub const sem_t = if (@hasDecl(substitutes, "sem_t")) substitutes.sem_t else std.c.sem_t;
		pub const pthread_setname_np = if (@hasDecl(substitutes, "pthread_setname_np")) substitutes.pthread_setname_np else std.c.pthread_setname_np;
		pub const pthread_getname_np = if (@hasDecl(substitutes, "pthread_getname_np")) substitutes.pthread_getname_np else std.c.pthread_getname_np;
		pub const RTLD = if (@hasDecl(substitutes, "RTLD")) substitutes.RTLD else std.c.RTLD;
		pub const dirent = if (@hasDecl(substitutes, "dirent")) substitutes.dirent else std.c.dirent;
		pub const dirent64 = if (@hasDecl(substitutes, "dirent64")) substitutes.dirent64 else std.c.dirent64;
		pub const whence_t = if (@hasDecl(substitutes, "whence_t")) substitutes.whence_t else std.c.whence_t;
		pub const DIR = if (@hasDecl(substitutes, "DIR")) substitutes.DIR else std.c.DIR;
		pub const opendir = if (@hasDecl(substitutes, "opendir")) substitutes.opendir else std.c.opendir;
		pub const fdopendir = if (@hasDecl(substitutes, "fdopendir")) substitutes.fdopendir else std.c.fdopendir;
		pub const rewinddir = if (@hasDecl(substitutes, "rewinddir")) substitutes.rewinddir else std.c.rewinddir;
		pub const closedir = if (@hasDecl(substitutes, "closedir")) substitutes.closedir else std.c.closedir;
		pub const telldir = if (@hasDecl(substitutes, "telldir")) substitutes.telldir else std.c.telldir;
		pub const seekdir = if (@hasDecl(substitutes, "seekdir")) substitutes.seekdir else std.c.seekdir;
		pub const clock_gettime = if (@hasDecl(substitutes, "clock_gettime")) substitutes.clock_gettime else std.c.clock_gettime;
		pub const clock_getres = if (@hasDecl(substitutes, "clock_getres")) substitutes.clock_getres else std.c.clock_getres;
		pub const gettimeofday = if (@hasDecl(substitutes, "gettimeofday")) substitutes.gettimeofday else std.c.gettimeofday;
		pub const nanosleep = if (@hasDecl(substitutes, "nanosleep")) substitutes.nanosleep else std.c.nanosleep;
		pub const getrusage = if (@hasDecl(substitutes, "getrusage")) substitutes.getrusage else std.c.getrusage;
		pub const sched_yield = if (@hasDecl(substitutes, "sched_yield")) substitutes.sched_yield else std.c.sched_yield;
		pub const sigaction = if (@hasDecl(substitutes, "sigaction")) substitutes.sigaction else std.c.sigaction;
		pub const sigprocmask = if (@hasDecl(substitutes, "sigprocmask")) substitutes.sigprocmask else std.c.sigprocmask;
		pub const sigfillset = if (@hasDecl(substitutes, "sigfillset")) substitutes.sigfillset else std.c.sigfillset;
		pub const sigwait = if (@hasDecl(substitutes, "sigwait")) substitutes.sigwait else std.c.sigwait;
		pub const socket = if (@hasDecl(substitutes, "socket")) substitutes.socket else std.c.socket;
		pub const stat = if (@hasDecl(substitutes, "stat")) substitutes.stat else std.c.stat;
		pub const alarm = if (@hasDecl(substitutes, "alarm")) substitutes.alarm else std.c.alarm;
		pub const msync = if (@hasDecl(substitutes, "msync")) substitutes.msync else std.c.msync;
		pub const fstat = if (@hasDecl(substitutes, "fstat")) substitutes.fstat else std.c.fstat;
		pub const readdir = if (@hasDecl(substitutes, "readdir")) substitutes.readdir else std.c.readdir;
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
