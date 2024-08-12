const std = @import("std");
const builtin = @import("builtin");
const expect = std.testing.expect;

pub const get = Instance.fromBinding;

pub const Instance = struct {
    const code_size = switch (builtin.target.cpu.arch) {
        .x86_64 => 22,
        .aarch64 => 36,
        .riscv64 => 42,
        .powerpc64le => 48,
        .x86 => 12,
        .arm => 20,
        else => @compileError("Closure not supported on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
    };

    context_ptr: *allowzero const anyopaque,
    key: usize,
    bytes: [code_size]u8 = undefined,

    pub inline fn fromBinding() *const @This() {
        const address = switch (builtin.target.cpu.arch) {
            .x86_64 => asm (""
                : [ret] "={r10}" (-> usize),
            ),
            .aarch64 => asm (""
                : [ret] "={x9}" (-> usize),
            ),
            .riscv64 => asm (""
                : [ret] "={x5}" (-> usize),
            ),
            .powerpc64le => asm (""
                : [ret] "={r11}" (-> usize),
            ),
            .x86 => asm (""
                : [ret] "={eax}" (-> usize),
            ),
            .arm => asm (""
                : [ret] "={r4}" (-> usize),
            ),
            else => unreachable,
        };
        return @ptrFromInt(address);
    }

    pub fn fromFunction(fn_ptr: *const anyopaque) *@This() {
        const bytes: *const [code_size]u8 = @ptrCast(fn_ptr);
        return @alignCast(@fieldParentPtr("bytes", @constCast(bytes)));
    }

    fn construct(self: *@This(), fn_ptr: *const anyopaque, context_ptr: *const anyopaque, key: usize) void {
        self.* = .{ .context_ptr = context_ptr, .key = key };
        self.createInstructions(fn_ptr);
    }

    pub fn function(self: *const @This(), comptime FT: type) *const FT {
        return @ptrCast(@alignCast(&self.bytes));
    }

    fn createInstructions(self: *@This(), fn_ptr: *const anyopaque) void {
        const ip = &self.bytes;
        const self_addr = @intFromPtr(self);
        const fn_addr = @intFromPtr(fn_ptr);
        switch (builtin.target.cpu.arch) {
            .x86_64 => {
                const MOV = packed struct {
                    rex: u8 = 0x4B, // W + X
                    reg: u3,
                    opc: u5 = 0x17,
                    imm64: usize,
                };
                const JMP = packed struct {
                    rex: u8 = 0x4B,
                    opc: u8 = 0xff,
                    rm: u3,
                    ope: u3 = 0x4,
                    mod: u2 = 0x3,
                };
                @as(*align(1) MOV, @ptrCast(&ip[0])).* = .{
                    .imm64 = self_addr,
                    .reg = 2, // r10
                };
                @as(*align(1) MOV, @ptrCast(&ip[10])).* = .{
                    .imm64 = fn_addr,
                    .reg = 3, // r11
                };
                @as(*align(1) JMP, @ptrCast(&ip[20])).* = .{
                    .rm = 3, // r11
                };
            },
            .aarch64 => {
                const MOVZ = packed struct {
                    rd: u5,
                    imm16: u16,
                    hw: u2,
                    opc: u9 = 0x1a5,
                };
                const MOVK = packed struct {
                    rd: u5,
                    imm16: u16,
                    hw: u2,
                    opc: u9 = 0x1e5,
                };
                const BR = packed struct {
                    op4: u5 = 0,
                    rn: u5,
                    op3: u6 = 0,
                    op2: u5 = 0x1f,
                    opc: u4 = 0,
                    ope: u7 = 0x6b,
                };
                @as(*align(1) MOVZ, @ptrCast(&ip[0])).* = .{
                    .imm16 = @as([*]const u16, @ptrCast(&self_addr))[0],
                    .hw = 0,
                    .rd = 9,
                };
                @as(*align(1) MOVK, @ptrCast(&ip[4])).* = .{
                    .imm16 = @as([*]const u16, @ptrCast(&self_addr))[1],
                    .hw = 1,
                    .rd = 9,
                };
                @as(*align(1) MOVK, @ptrCast(&ip[8])).* = .{
                    .imm16 = @as([*]const u16, @ptrCast(&self_addr))[2],
                    .hw = 2,
                    .rd = 9,
                };
                @as(*align(1) MOVK, @ptrCast(&ip[12])).* = .{
                    .imm16 = @as([*]const u16, @ptrCast(&self_addr))[3],
                    .hw = 3,
                    .rd = 9,
                };
                @as(*align(1) MOVZ, @ptrCast(&ip[16])).* = .{
                    .imm16 = @as([*]const u16, @ptrCast(&fn_addr))[0],
                    .hw = 0,
                    .rd = 10,
                };
                @as(*align(1) MOVK, @ptrCast(&ip[20])).* = .{
                    .imm16 = @as([*]const u16, @ptrCast(&fn_addr))[1],
                    .hw = 1,
                    .rd = 10,
                };
                @as(*align(1) MOVK, @ptrCast(&ip[24])).* = .{
                    .imm16 = @as([*]const u16, @ptrCast(&fn_addr))[2],
                    .hw = 2,
                    .rd = 10,
                };
                @as(*align(1) MOVK, @ptrCast(&ip[28])).* = .{
                    .imm16 = @as([*]const u16, @ptrCast(&fn_addr))[3],
                    .hw = 3,
                    .rd = 10,
                };
                @as(*align(1) BR, @ptrCast(&ip[32])).* = .{
                    .rn = 10,
                };
            },
            .riscv64 => {
                const LUI = packed struct {
                    opc: u7 = 0x37,
                    rd: u5,
                    imm20: u20,
                };
                const ADDI = packed struct {
                    opc: u7 = 0x1b,
                    rd: u5,
                    func: u3 = 0,
                    rs: u5,
                    imm12: u12,
                };
                const C_SLLI = packed struct {
                    opc: u2 = 0x2,
                    imm5: u5,
                    rd: u5,
                    imm1: u1,
                    func: u3 = 0,
                };
                const C_ADD = packed struct {
                    opc: u2 = 0x2,
                    rs: u5,
                    rd: u5,
                    func1: u1 = 1,
                    func2: u3 = 0x4,
                };
                const C_JR = packed struct {
                    opc: u2 = 0x2,
                    rs2: u5 = 0,
                    rs: u5,
                    func1: u1 = 0,
                    func2: u3 = 0x4,
                };
                const self_addr_11_0 = (self_addr >> 0 & 0xFFF);
                const self_addr_31_12 = (self_addr >> 12 & 0xFFFFF) + (self_addr >> 11 & 1);
                const self_addr_43_32 = (self_addr >> 32 & 0xFFF) + (self_addr >> 31 & 1);
                const self_addr_63_44 = (self_addr >> 44 & 0xFFFFF) + (self_addr >> 43 & 1);
                @as(*align(1) LUI, @ptrCast(&ip[0])).* = .{
                    .imm20 = @truncate(self_addr_63_44),
                    .rd = 5,
                };
                @as(*align(1) ADDI, @ptrCast(&ip[4])).* = .{
                    .imm12 = @truncate(self_addr_43_32),
                    .rd = 5,
                    .rs = 5,
                };
                @as(*align(1) LUI, @ptrCast(&ip[8])).* = .{
                    .imm20 = @truncate(self_addr_31_12),
                    .rd = 7,
                };
                @as(*align(1) ADDI, @ptrCast(&ip[12])).* = .{
                    .imm12 = @truncate(self_addr_11_0),
                    .rd = 7,
                    .rs = 7,
                };
                @as(*align(1) C_SLLI, @ptrCast(&ip[16])).* = .{
                    .imm5 = 0,
                    .imm1 = 1, // imm1 << 5 | imm5 = 32
                    .rd = 5,
                };
                @as(*align(1) C_ADD, @ptrCast(&ip[18])).* = .{
                    .rs = 7,
                    .rd = 5,
                };
                const fn_addr_11_0 = (fn_addr >> 0 & 0xFFF);
                const fn_addr_31_12 = (fn_addr >> 12 & 0xFFFFF) + (fn_addr >> 11 & 1);
                const fn_addr_43_32 = (fn_addr >> 32 & 0xFFF) + (fn_addr >> 31 & 1);
                const fn_addr_63_44 = (fn_addr >> 44 & 0xFFFFF) + (fn_addr >> 43 & 1);
                @as(*align(1) LUI, @ptrCast(&ip[20])).* = .{
                    .imm20 = @truncate(fn_addr_63_44),
                    .rd = 6,
                };
                @as(*align(1) ADDI, @ptrCast(&ip[24])).* = .{
                    .imm12 = @truncate(fn_addr_43_32),
                    .rd = 6,
                    .rs = 6,
                };
                @as(*align(1) LUI, @ptrCast(&ip[28])).* = .{
                    .imm20 = @truncate(fn_addr_31_12),
                    .rd = 7,
                };
                @as(*align(1) ADDI, @ptrCast(&ip[32])).* = .{
                    .imm12 = @truncate(fn_addr_11_0),
                    .rd = 7,
                    .rs = 7,
                };
                @as(*align(1) C_SLLI, @ptrCast(&ip[36])).* = .{
                    .imm5 = 0,
                    .imm1 = 1,
                    .rd = 6,
                };
                @as(*align(1) C_ADD, @ptrCast(&ip[38])).* = .{
                    .rs = 7,
                    .rd = 6,
                };
                @as(*align(1) C_JR, @ptrCast(&ip[40])).* = .{
                    .rs = 6,
                };
            },
            .powerpc64le => {
                const ADDI = packed struct {
                    simm: u16,
                    ra: u5,
                    rt: u5,
                    opc: u6 = 0x0e,
                };
                const ADDIS = packed struct {
                    simm: u16,
                    ra: u5,
                    rt: u5,
                    opc: u6 = 0x0f,
                };
                const RLDIC = packed struct {
                    rc: u1 = 0,
                    sh2: u1,
                    _: u3 = 0,
                    mb: u6 = 0,
                    sh: u5,
                    ra: u5,
                    rs: u5,
                    opc: u6 = 0x1e,
                };
                const MTCTR = packed struct {
                    _: u1 = 0,
                    func: u10 = 467,
                    spr: u10 = 0x120,
                    rs: u5,
                    opc: u6 = 0x1f,
                };
                const BCTRL = packed struct {
                    lk: u1 = 0,
                    func: u10 = 528,
                    bh: u2 = 0,
                    _: u3 = 0,
                    bi: u5 = 0,
                    bo: u5 = 0x14,
                    opc: u6 = 0x13,
                };
                const self_addr_16_0 = (self_addr >> 0 & 0xFFFF);
                const self_addr_31_16 = (self_addr >> 16 & 0xFFFF) + (self_addr >> 15 & 1);
                const self_addr_47_32 = (self_addr >> 32 & 0xFFFF) + (self_addr >> 31 & 1);
                const self_addr_63_48 = (self_addr >> 48 & 0xFFFF) + (self_addr >> 47 & 1);
                @as(*align(1) ADDI, @ptrCast(&ip[0])).* = .{
                    .rt = 11,
                    .ra = 0,
                    .simm = @truncate(self_addr_47_32),
                };
                @as(*align(1) ADDIS, @ptrCast(&ip[4])).* = .{
                    .rt = 11,
                    .ra = 11,
                    .simm = @truncate(self_addr_63_48),
                };
                @as(*align(1) RLDIC, @ptrCast(&ip[8])).* = .{
                    .rs = 11,
                    .ra = 11,
                    .sh = 0,
                    .sh2 = 1,
                };
                @as(*align(1) ADDI, @ptrCast(&ip[12])).* = .{
                    .rt = 11,
                    .ra = 11,
                    .simm = @truncate(self_addr_16_0),
                };
                @as(*align(1) ADDIS, @ptrCast(&ip[16])).* = .{
                    .rt = 11,
                    .ra = 11,
                    .simm = @truncate(self_addr_31_16),
                };
                const fn_addr_16_0 = (fn_addr >> 0 & 0xFFFF);
                const fn_addr_31_16 = (fn_addr >> 16 & 0xFFFF) + (fn_addr >> 15 & 1);
                const fn_addr_47_32 = (fn_addr >> 32 & 0xFFFF) + (fn_addr >> 31 & 1);
                const fn_addr_63_48 = (fn_addr >> 48 & 0xFFFF) + (fn_addr >> 47 & 1);
                @as(*align(1) ADDI, @ptrCast(&ip[20])).* = .{
                    .rt = 12,
                    .ra = 0,
                    .simm = @truncate(fn_addr_47_32),
                };
                @as(*align(1) ADDIS, @ptrCast(&ip[24])).* = .{
                    .rt = 12,
                    .ra = 12,
                    .simm = @truncate(fn_addr_63_48),
                };
                @as(*align(1) RLDIC, @ptrCast(&ip[28])).* = .{
                    .rs = 12,
                    .ra = 12,
                    .sh = 0,
                    .sh2 = 1,
                };
                @as(*align(1) ADDI, @ptrCast(&ip[32])).* = .{
                    .rt = 12,
                    .ra = 0,
                    .simm = @truncate(fn_addr_16_0),
                };
                @as(*align(1) ADDIS, @ptrCast(&ip[36])).* = .{
                    .rt = 12,
                    .ra = 12,
                    .simm = @truncate(fn_addr_31_16),
                };
                @as(*align(1) MTCTR, @ptrCast(&ip[40])).* = .{
                    .rs = 12,
                };
                @as(*align(1) BCTRL, @ptrCast(&ip[44])).* = .{};
            },
            .x86 => {
                const MOV = packed struct {
                    reg: u3,
                    opc: u5 = 0x17,
                    imm32: usize,
                };
                const JMP = packed struct {
                    opc: u8 = 0xff,
                    rm: u3,
                    ope: u3 = 0x4,
                    mod: u2 = 0x3,
                };
                @as(*align(1) MOV, @ptrCast(&ip[0])).* = .{
                    .imm32 = self_addr,
                    .reg = 0, // eax
                };
                @as(*align(1) MOV, @ptrCast(&ip[5])).* = .{
                    .imm32 = fn_addr,
                    .reg = 2, // edx
                };
                @as(*align(1) JMP, @ptrCast(&ip[10])).* = .{
                    .rm = 2, // edx
                };
            },
            .arm => {
                const MOVW = packed struct {
                    imm12: u12,
                    rd: u4,
                    imm4: u4,
                    opc: u8 = 0x30,
                    _: u4 = 0,
                };
                const MOVT = packed struct {
                    imm12: u12,
                    rd: u4,
                    imm4: u4,
                    opc: u8 = 0x34,
                    _: u4 = 0,
                };
                const BX = packed struct {
                    rm: u4,
                    flags: u4 = 0x1,
                    imm12: u12 = 0xfff,
                    opc: u8 = 0x12,
                    _: u4 = 0,
                };
                @as(*align(1) MOVW, @ptrCast(&ip[0])).* = .{
                    .imm12 = @truncate(self_addr >> 0 & 0xFFF),
                    .imm4 = @truncate(self_addr >> 12 & 0xF),
                    .rd = 4,
                };
                @as(*align(1) MOVT, @ptrCast(&ip[4])).* = .{
                    .imm12 = @truncate(self_addr >> 16 & 0xFFF),
                    .imm4 = @truncate(self_addr >> 28 & 0xF),
                    .rd = 4,
                };
                @as(*align(1) MOVW, @ptrCast(&ip[8])).* = .{
                    .imm12 = @truncate(fn_addr >> 0 & 0xFFF),
                    .imm4 = @truncate(fn_addr >> 12 & 0xF),
                    .rd = 5,
                };
                @as(*align(1) MOVT, @ptrCast(&ip[12])).* = .{
                    .imm12 = @truncate(fn_addr >> 16 & 0xFFF),
                    .imm4 = @truncate(fn_addr >> 28 & 0xF),
                    .rd = 5,
                };
                @as(*align(1) BX, @ptrCast(&ip[16])).* = .{
                    .rm = 5,
                };
            },
            else => unreachable,
        }
    }
};

test "Instance.construct" {
    const ns = struct {
        fn check(
            number_ptr: *usize,
            a1: usize,
            a2: usize,
            a3: usize,
            a4: usize,
            a5: usize,
            a6: usize,
            a7: usize,
        ) usize {
            const closure = get();
            number_ptr.* = @intFromPtr(closure.context_ptr) + closure.key;
            return 777 + a1 + a2 + a3 + a4 + a5 + a6 + a7;
        }
    };
    const bytes = try std.posix.mmap(
        null,
        1024 * 4,
        std.posix.PROT.READ | std.posix.PROT.WRITE | std.posix.PROT.EXEC,
        .{ .TYPE = .PRIVATE, .ANONYMOUS = true },
        -1,
        0,
    );
    defer std.posix.munmap(bytes);
    const closure: *Instance = @ptrCast(bytes);
    const address = switch (@sizeOf(usize)) {
        4 => 0xABCD_1230,
        else => 0xAAAA_BBBB_CCCC_1230,
    };
    const context_ptr: *const anyopaque = @ptrFromInt(address);
    const key: usize = 1234;
    closure.construct(&ns.check, context_ptr, key);
    const f = closure.function(@TypeOf(ns.check));
    var number: usize = undefined;
    const result = f(&number, 1, 2, 3, 4, 5, 6, 7);
    try expect(result == 777 + 1 + 2 + 3 + 4 + 5 + 6 + 7);
    try expect(number == address + key);
}

test "Instance.fromFunction()" {
    const ns = struct {
        fn check() usize {
            return 777;
        }
    };
    const bytes = try std.posix.mmap(
        null,
        1024 * 4,
        std.posix.PROT.READ | std.posix.PROT.WRITE | std.posix.PROT.EXEC,
        .{ .TYPE = .PRIVATE, .ANONYMOUS = true },
        -1,
        0,
    );
    defer std.posix.munmap(bytes);
    const closure: *Instance = @ptrCast(bytes);
    const address = switch (@sizeOf(usize)) {
        4 => 0xABCD_1230,
        else => 0xAAAA_BBBB_CCCC_1230,
    };
    const context_ptr: *const anyopaque = @ptrFromInt(address);
    const key: usize = 1234;
    closure.construct(&ns.check, context_ptr, key);
    const f = closure.function(@TypeOf(ns.check));
    const result = Instance.fromFunction(f);
    try expect(result == closure);
}

const Chunk = struct {
    bytes: []u8,
    instances: []Instance,
    used: usize = 0,
    freed: usize = 0,
    prev_chunk: ?*@This() = null,
    next_chunk: ?*@This() = null,

    fn use(bytes: []u8) *@This() {
        const self: *@This() = @ptrCast(@alignCast(bytes));
        const addr = @intFromPtr(bytes.ptr);
        const instance_addr = std.mem.alignForward(usize, addr + @sizeOf(@This()), @alignOf(Instance));
        const capacity = (bytes.len - (instance_addr - addr)) / @sizeOf(Instance);
        const instance_ptr: [*]Instance = @ptrFromInt(instance_addr);
        self.* = .{
            .bytes = bytes,
            .instances = instance_ptr[0..capacity],
        };
        return self;
    }

    fn getInstance(self: *@This()) ?*Instance {
        if (self.used < self.instances.len) {
            const index = self.used;
            self.used += 1;
            return &self.instances[index];
        }
        if (self.freed > 0) {
            for (self.instances) |*instance| {
                if (@intFromPtr(instance.context_ptr) == 0) {
                    self.freed -= 1;
                    return instance;
                }
            }
        }
        return null;
    }

    fn freeInstance(self: *@This(), instance: *Instance) bool {
        if (self.contains(instance)) {
            instance.context_ptr = @ptrFromInt(0);
            self.freed += 1;
            return true;
        }
        return false;
    }

    fn contains(self: *@This(), ptr: *const anyopaque) bool {
        const addr = @intFromPtr(ptr);
        const start = @intFromPtr(self.instances.ptr);
        const end = start + @sizeOf(Instance) * self.instances.len;
        return start <= addr and addr < end;
    }
};

test "Chunk.use" {
    var bytes: [512]u8 = undefined;
    const chunk = Chunk.use(&bytes);
    try expect(@intFromPtr(chunk) == @intFromPtr(&bytes));
    try expect(chunk.instances.len > 0);
}

test "Chunk.getInstance" {
    var bytes: [512]u8 = undefined;
    const chunk = Chunk.use(&bytes);
    while (chunk.getInstance()) |_| {}
    try expect(chunk.used == chunk.instances.len);
}

test "Chunk.freeInstance" {
    var bytes: [512]u8 = undefined;
    const chunk = Chunk.use(&bytes);
    const instance1 = chunk.getInstance().?;
    const result1 = chunk.freeInstance(instance1);
    try expect(result1);
    try expect(chunk.freed == 1);
    var instance2: *Instance = undefined;
    while (chunk.getInstance()) |i| {
        instance2 = i;
    }
    try expect(instance2 == instance1);
    try expect(chunk.freed == 0);
}

test "Chunk.contains" {
    var bytes: [512]u8 = undefined;
    const chunk = Chunk.use(&bytes);
    const instance = chunk.getInstance().?;
    const f = instance.function(fn () void);
    try expect(chunk.contains(instance));
    try expect(chunk.contains(f));
    try expect(!chunk.contains(@ptrFromInt(0xAAAA)));
}

pub const Factory = struct {
    last_chunk: ?*Chunk = null,
    chunk_count: usize = 0,

    pub fn init() @This() {
        return .{};
    }

    pub fn alloc(self: *@This(), fn_ptr: *const anyopaque, context_ptr: *const anyopaque, key: usize) !*Instance {
        var chunk = self.last_chunk;
        const instance = while (chunk) |c| : (chunk = c.prev_chunk) {
            if (c.getInstance()) |instance| {
                break instance;
            }
        } else alloc: {
            const byte_count = 1024 * 8;
            const bytes = try std.posix.mmap(
                null,
                byte_count,
                std.posix.PROT.READ | std.posix.PROT.WRITE | std.posix.PROT.EXEC,
                .{ .TYPE = .PRIVATE, .ANONYMOUS = true },
                -1,
                0,
            );
            const new_chunk = Chunk.use(bytes);
            if (self.last_chunk) |lc| {
                lc.next_chunk = new_chunk;
                new_chunk.prev_chunk = lc;
            }
            self.last_chunk = new_chunk;
            self.chunk_count += 1;
            break :alloc new_chunk.getInstance().?;
        };
        instance.construct(fn_ptr, context_ptr, key);
        return instance;
    }

    pub fn free(self: *@This(), instance: *Instance) bool {
        var chunk = self.last_chunk;
        return while (chunk) |c| : (chunk = c.prev_chunk) {
            if (c.freeInstance(instance)) {
                if (c.freed == c.used) {
                    if (c.prev_chunk) |pc| {
                        pc.next_chunk = c.next_chunk;
                    }
                    if (c.next_chunk) |nc| {
                        nc.prev_chunk = c.prev_chunk;
                    }
                    if (self.last_chunk == c) {
                        self.last_chunk = c.prev_chunk;
                    }
                    std.posix.munmap(@alignCast(c.bytes));
                    self.chunk_count -= 1;
                }
                break true;
            }
        } else false;
    }

    pub fn contains(self: *@This(), fn_ptr: *const anyopaque) bool {
        var chunk = self.last_chunk;
        return while (chunk) |c| : (chunk = c.prev_chunk) {
            if (c.contains(fn_ptr)) {
                break true;
            }
        } else false;
    }
};

test "Factory.alloc" {
    const ns = struct {
        fn check() usize {
            const closure = get();
            return 777 + closure.key;
        }
    };
    var factory = Factory.init();
    const context_ptr: *const anyopaque = @ptrFromInt(0xABCD);
    for (0..1000) |index| {
        const instance = try factory.alloc(&ns.check, context_ptr, index);
        const f = instance.function(@TypeOf(ns.check));
        const result = f();
        try expect(result == 777 + index);
    }
    try expect(factory.chunk_count > 1);
}

test "Factory.free" {
    const ns = struct {
        fn check() usize {
            return 777;
        }
    };
    var factory = Factory.init();
    const context_ptr: *const anyopaque = @ptrFromInt(0xABCD);
    var instances: [1000]*Instance = undefined;
    for (&instances, 0..) |*p, index| {
        p.* = try factory.alloc(&ns.check, context_ptr, index);
    }
    for (instances) |instance| {
        const result = factory.free(instance);
        try expect(result);
    }
    try expect(factory.chunk_count == 0);
}

test "Factory.contains" {
    const ns = struct {
        fn check() usize {
            return 777;
        }
    };
    var factory = Factory.init();
    const context_ptr: *const anyopaque = @ptrFromInt(0xABCD);
    const instance = try factory.alloc(&ns.check, context_ptr, 1234);
    const f = instance.function(@TypeOf(ns.check));
    try expect(factory.contains(f));
    try expect(!factory.contains(&ns.check));
}
