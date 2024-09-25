const std = @import("std");
const builtin = @import("builtin");
const expect = std.testing.expect;

threadlocal var instance_address: usize = 0;

pub fn Instance(comptime T: type) type {
    return struct {
        const code_size = switch (builtin.target.cpu.arch) {
            .x86_64 => 36,
            .aarch64 => 56,
            .riscv64 => 66,
            .powerpc64le => 72,
            .x86 => 19,
            .arm => 32,
            else => @compileError("No support for closure on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
        };
        const Writer = struct {
            bytes: [*]u8,
            len: usize = 0,

            fn add(self: *@This(), instr: anytype) void {
                const IT = @TypeOf(instr);
                const ptr: *align(1) IT = @ptrCast(&self.bytes[self.len]);
                ptr.* = instr;
                self.len += @bitSizeOf(IT) / 8;
            }
        };

        context: ?T,
        bytes: [code_size]u8 = undefined,

        pub inline fn getContext() T {
            return fromBinding().context.?;
        }

        pub inline fn fromBinding() *const @This() {
            return @ptrFromInt(instance_address);
        }

        pub fn fromFunction(fn_ptr: *const anyopaque) *@This() {
            const bytes: *const [code_size]u8 = @ptrCast(fn_ptr);
            return @alignCast(@fieldParentPtr("bytes", @constCast(bytes)));
        }

        fn construct(self: *@This(), fn_ptr: *const anyopaque, cxt: T) void {
            self.* = .{ .context = cxt };
            self.createInstructions(fn_ptr);
        }

        pub fn function(self: *const @This(), comptime FT: type) *const FT {
            return @ptrCast(@alignCast(&self.bytes));
        }

        fn createInstructions(self: *@This(), fn_ptr: *const anyopaque) void {
            var code: Writer = .{ .bytes = &self.bytes };
            const self_addr = @intFromPtr(self);
            const fn_addr = @intFromPtr(fn_ptr);
            const ia_addr = @intFromPtr(&instance_address);
            switch (builtin.target.cpu.arch) {
                .x86_64 => {
                    const REX = packed struct {
                        b: u1 = 0,
                        x: u1 = 0,
                        r: u1 = 0,
                        w: u1 = 1,
                        pat: u4 = 4,
                    };
                    const ModRM = packed struct {
                        rm: u3 = 0,
                        reg: u3 = 0,
                        mod: u2 = 0,
                    };
                    const SIB = packed struct {
                        base: u3 = 0,
                        index: u3 = 0,
                        scale: u2 = 0,
                    };
                    const MOV = union(enum) {
                        const A = packed struct {
                            rex: REX = .{},
                            // rm is basically stored as part of the opcode
                            rm: u3 = 0,
                            opc: u5 = 0xb8 >> 3,
                            imm64: usize,
                        };
                        const B = packed struct {
                            rex: REX = .{},
                            opc: u8 = 0x89,
                            mod_rm: ModRM,
                        };
                        const C = packed struct {
                            rex: REX = .{},
                            opc: u8 = 0x89,
                            mod_rm: ModRM,
                            sib: SIB,
                        };
                        const D = packed struct {
                            rex: REX = .{},
                            opc: u8 = 0x89,
                            mod_rm: ModRM,
                            sib: SIB,
                            disp8: i8,
                        };
                        const E = packed struct {
                            rex: REX = .{},
                            opc: u8 = 0x89,
                            mod_rm: ModRM,
                            sib: SIB,
                            disp32: i32,
                        };

                        a: A,
                        b: B,
                        c: C,
                        d: D,
                        e: E,
                    };
                    const JMP = packed struct {
                        rex: REX = .{},
                        opc: u8 = 0xff,
                        mod_rm: ModRM,
                    };
                    // mov r11, self_addr
                    code.add(MOV.A{
                        .rex = .{ .b = 1 },
                        .rm = 3,
                        .imm64 = self_addr,
                    });
                    // mov rax, ia_addr
                    code.add(MOV.A{ .imm64 = ia_addr });
                    // mov [rax], r11
                    code.add(MOV.B{
                        .rex = .{ .r = 1 },
                        .mod_rm = .{ .reg = 3 },
                    });
                    // mov rax, fn_addr
                    code.add(MOV.A{ .imm64 = fn_addr });
                    // jmp [rax]
                    code.add(JMP{ .mod_rm = .{ .reg = 4, .mod = 3 } });
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
                    const STR = packed struct {
                        rt: u5,
                        rn: u5,
                        imm12: u12 = 0,
                        opc: u10 = 0x3e4,
                    };
                    const BR = packed struct {
                        op4: u5 = 0,
                        rn: u5,
                        op3: u6 = 0,
                        op2: u5 = 0x1f,
                        opc: u4 = 0,
                        ope: u7 = 0x6b,
                    };
                    const MOV_IMM64 = packed struct {
                        movz: MOVZ,
                        movk1: MOVK,
                        movk2: MOVK,
                        movk3: MOVK,

                        fn init(rd: u5, imm64: usize) @This() {
                            const imm16s: [4]u16 = @bitCast(imm64);
                            return .{
                                .movz = .{ .imm16 = imm16s[0], .hw = 0, .rd = rd },
                                .movk1 = .{ .imm16 = imm16s[1], .hw = 1, .rd = rd },
                                .movk2 = .{ .imm16 = imm16s[2], .hw = 2, .rd = rd },
                                .movk3 = .{ .imm16 = imm16s[3], .hw = 3, .rd = rd },
                            };
                        }
                    };
                    // mov x9, self_addr
                    code.add(MOV_IMM64.init(9, self_addr));
                    // mov x10, ia_addr
                    code.add(MOV_IMM64.init(10, ia_addr));
                    // sd [x10], x9
                    code.add(STR{ .rn = 10, .rt = 9 });
                    // mov x9, fn_addr
                    code.add(MOV_IMM64.init(9, fn_addr));
                    // br x9
                    code.add(BR{ .rn = 9 });
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
                    const SD = packed struct(u32) {
                        opc: u7 = 0x23,
                        offset_4_0: u5 = 0,
                        func: u3 = 0x3,
                        rs1: u5,
                        rs2: u5,
                        offset_11_5: u7 = 0,
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
                    const MOV_IMM64 = packed struct {
                        lui1: LUI,
                        addi1: ADDI,
                        lui2: LUI,
                        addi2: ADDI,
                        slli: C_SLLI,
                        add: C_ADD,

                        fn init(rd: u5, rtmp: u5, imm64: usize) @This() {
                            const imm64_11_0 = (imm64 >> 0 & 0xFFF);
                            const imm64_31_12 = (imm64 >> 12 & 0xFFFFF) + (imm64 >> 11 & 1);
                            const imm64_43_32 = (imm64 >> 32 & 0xFFF) + (imm64 >> 31 & 1);
                            const imm64_63_44 = (imm64 >> 44 & 0xFFFFF) + (imm64 >> 43 & 1);
                            return .{
                                // lui rd, imm64_63_44
                                .lui1 = .{
                                    .imm20 = @truncate(imm64_63_44),
                                    .rd = rd,
                                },
                                // addi rd, imm64_43_32
                                .addi1 = .{
                                    .imm12 = @truncate(imm64_43_32),
                                    .rd = rd,
                                    .rs = rd,
                                },
                                // lui rtmp, imm64_31_12
                                .lui2 = .{
                                    .imm20 = @truncate(imm64_31_12),
                                    .rd = rtmp,
                                },
                                // addi rtmp, imm64_11_0
                                .addi2 = .{
                                    .imm12 = @truncate(imm64_11_0),
                                    .rd = rtmp,
                                    .rs = rtmp,
                                },
                                // shift rd, 32
                                .slli = .{ .imm1 = 1, .imm5 = 0, .rd = rd },
                                // add rd, rtmp
                                .add = .{ .rd = rd, .rs = rtmp },
                            };
                        }
                    };
                    // mov x5, self_addr
                    code.add(MOV_IMM64.init(5, 7, self_addr));
                    // mov x6, ia_addr
                    code.add(MOV_IMM64.init(6, 7, ia_addr));
                    // sd [x6], x5
                    code.add(SD{ .rs1 = 6, .rs2 = 5 });
                    // mov x5, fn_addr
                    code.add(MOV_IMM64.init(5, 7, fn_addr));
                    // jmp [x5]
                    code.add(C_JR{ .rs = 5 });
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
                    const STD = packed struct {
                        _: u2 = 0,
                        ds: u14 = 0,
                        ra: u5,
                        rs: u5,
                        opc: u6 = 0x3e,
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
                    const MOV_IMM64 = packed struct {
                        addi1: ADDI,
                        addis1: ADDIS,
                        rldic: RLDIC,
                        addi2: ADDI,
                        addis2: ADDIS,

                        fn init(rt: u5, imm64: usize) @This() {
                            const imm64_16_0 = (imm64 >> 0 & 0xFFFF);
                            const imm64_31_16 = (imm64 >> 16 & 0xFFFF) + (imm64 >> 15 & 1);
                            const imm64_47_32 = (imm64 >> 32 & 0xFFFF) + (imm64 >> 31 & 1);
                            const imm64_63_48 = (imm64 >> 48 & 0xFFFF) + (imm64 >> 47 & 1);
                            return .{
                                .addi1 = .{
                                    .rt = rt,
                                    .ra = 0,
                                    .simm = @truncate(imm64_47_32),
                                },
                                .addis1 = .{
                                    .rt = rt,
                                    .ra = rt,
                                    .simm = @truncate(imm64_63_48),
                                },
                                .rldic = .{
                                    .rs = rt,
                                    .ra = rt,
                                    .sh = 0,
                                    .sh2 = 1,
                                },
                                .addi2 = .{
                                    .rt = rt,
                                    .ra = rt,
                                    .simm = @truncate(imm64_16_0),
                                },
                                .addis2 = .{
                                    .rt = rt,
                                    .ra = rt,
                                    .simm = @truncate(imm64_31_16),
                                },
                            };
                        }
                    };
                    // mov r11, self_addr
                    code.add(MOV_IMM64.init(11, self_addr));
                    // mov r12, ia_addr
                    code.add(MOV_IMM64.init(12, ia_addr));
                    // std [r12], r11
                    code.add(STD{ .ra = 12, .rs = 11 });
                    // mov r12, fn_addr
                    code.add(MOV_IMM64.init(12, fn_addr));
                    // mtctr r12
                    code.add(MTCTR{ .rs = 12 });
                    // bctrl
                    code.add(BCTRL{});
                },
                .x86 => {
                    const ModRM = packed struct {
                        rm: u3 = 0,
                        reg: u3 = 0,
                        mod: u2 = 0,
                    };
                    const SIB = packed struct {
                        base: u3 = 0,
                        index: u3 = 0,
                        scale: u2 = 0,
                    };
                    const MOV = union(enum) {
                        const A = packed struct {
                            rm: u3 = 0,
                            opc: u5 = 0xb8 >> 3,
                            imm32: usize,
                        };
                        const B = packed struct {
                            opc: u8 = 0x89,
                            mod_rm: ModRM,
                        };
                        const C = packed struct {
                            opc: u8 = 0x89,
                            mod_rm: ModRM,
                            sib: SIB,
                        };
                        const D = packed struct {
                            opc: u8 = 0x89,
                            mod_rm: ModRM,
                            sib: SIB,
                            disp8: i8,
                        };
                        const E = packed struct {
                            opc: u8 = 0x89,
                            mod_rm: ModRM,
                            sib: SIB,
                            disp32: i32,
                        };

                        a: A,
                        b: B,
                        c: C,
                        d: D,
                        e: E,
                    };
                    const JMP = packed struct {
                        opc: u8 = 0xff,
                        mod_rm: ModRM,
                    };
                    // mov edx, self_addr
                    code.add(MOV.A{
                        .rm = 3,
                        .imm32 = self_addr,
                    });
                    // mov eax, self_addr
                    code.add(MOV.A{ .imm32 = ia_addr });
                    // mov [eax], edx
                    code.add(MOV.B{ .mod_rm = .{ .reg = 3 } });
                    // mov eax, fn_addr
                    code.add(MOV.A{ .imm32 = fn_addr });
                    // jmp [eax]
                    code.add(JMP{ .mod_rm = .{ .reg = 4, .mod = 3 } });
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
                    const STR = packed struct {
                        imm12: u12 = 0,
                        rt: u4,
                        rn: u4,
                        opc: u8 = 0x58,
                        _: u4 = 0,
                    };
                    const BX = packed struct {
                        rm: u4,
                        flags: u4 = 0x1,
                        imm12: u12 = 0xfff,
                        opc: u8 = 0x12,
                        _: u4 = 0,
                    };
                    const MOV_IMM32 = packed struct {
                        movw: MOVW,
                        movt: MOVT,

                        fn init(rd: u4, imm32: usize) @This() {
                            const imm16s: [2]u16 = @bitCast(imm32);
                            return .{
                                .movw = .{
                                    .imm12 = @truncate(imm16s[0] & 0xFFF),
                                    .imm4 = @truncate(imm16s[0] >> 12 & 0xF),
                                    .rd = rd,
                                },
                                .movt = .{
                                    .imm12 = @truncate(imm16s[1] & 0xFFF),
                                    .imm4 = @truncate(imm16s[1] >> 12 & 0xF),
                                    .rd = rd,
                                },
                            };
                        }
                    };
                    // mov x4, self_addr
                    code.add(MOV_IMM32.init(4, self_addr));
                    // mov x5, ia_addr
                    code.add(MOV_IMM32.init(5, ia_addr));
                    // mov [x5], x4
                    code.add(STR{ .rn = 5, .rt = 4 });
                    // mov x4, fn_addr
                    code.add(MOV_IMM32.init(4, fn_addr));
                    // bx [x4]
                    code.add(BX{ .rm = 4 });
                },
                else => unreachable,
            }
        }

        test "construct" {
            const bytes = try std.posix.mmap(
                null,
                1024 * 4,
                std.posix.PROT.READ | std.posix.PROT.WRITE | std.posix.PROT.EXEC,
                .{ .TYPE = .PRIVATE, .ANONYMOUS = true },
                -1,
                0,
            );
            defer std.posix.munmap(bytes);
            const closure: *@This() = @ptrCast(bytes);
            const context = T.create(1234);
            const ns1 = struct {
                fn check(number_ptr: *usize, a1: usize, a2: usize, a3: usize, a4: usize, a5: usize, a6: usize, a7: usize) usize {
                    if (getContext().check()) {
                        number_ptr.* = a7;
                        return a1 + a2 + a3 + a4 + a5 + a6 + a7;
                    } else {
                        return 0;
                    }
                }
            };
            closure.construct(&ns1.check, context);
            const f1 = closure.function(@TypeOf(ns1.check));
            var number1: usize = 0;
            const result1 = f1(&number1, 1, 2, 3, 4, 5, 6, 7);
            try expect(result1 == 1 + 2 + 3 + 4 + 5 + 6 + 7);
            try expect(number1 == 7);
            // pass enough arguments to ensure we're exhausting available registers
            const ns2 = struct {
                fn check(number_ptr: *usize, a1: usize, a2: usize, a3: usize, a4: usize, a5: usize, a6: usize, a7: usize, a8: usize, a9: usize, a10: usize, a11: usize, a12: usize, a13: usize, a14: usize) usize {
                    if (getContext().check()) {
                        number_ptr.* = a14;
                        return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14;
                    } else {
                        return 0;
                    }
                }
            };
            closure.construct(&ns2.check, context);
            const f2 = closure.function(@TypeOf(ns2.check));
            var number2: usize = 0;
            const result2 = f2(&number2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14);
            try expect(result2 == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14);
            try expect(number2 == 14);
        }

        test "fromFunction()" {
            const bytes = try std.posix.mmap(
                null,
                1024 * 4,
                std.posix.PROT.READ | std.posix.PROT.WRITE | std.posix.PROT.EXEC,
                .{ .TYPE = .PRIVATE, .ANONYMOUS = true },
                -1,
                0,
            );
            defer std.posix.munmap(bytes);
            const ns = struct {
                fn check() bool {
                    return getContext().check();
                }
            };
            const closure: *@This() = @ptrCast(bytes);
            const context = T.create(1234);
            closure.construct(&ns.check, context);
            const f = closure.function(@TypeOf(ns.check));
            const result = fromFunction(f);
            try expect(result == closure);
        }
    };
}

fn Chunk(comptime T: type) type {
    return struct {
        bytes: []u8,
        instances: []Instance(T),
        used: usize = 0,
        freed: usize = 0,
        prev_chunk: ?*@This() = null,
        next_chunk: ?*@This() = null,

        fn use(bytes: []u8) *@This() {
            const self: *@This() = @ptrCast(@alignCast(bytes));
            const addr = @intFromPtr(bytes.ptr);
            const instance_addr = std.mem.alignForward(usize, addr + @sizeOf(@This()), @alignOf(Instance(T)));
            const capacity = (bytes.len - (instance_addr - addr)) / @sizeOf(Instance(T));
            const instance_ptr: [*]Instance(T) = @ptrFromInt(instance_addr);
            self.* = .{
                .bytes = bytes,
                .instances = instance_ptr[0..capacity],
            };
            return self;
        }

        fn getInstance(self: *@This()) ?*Instance(T) {
            if (self.used < self.instances.len) {
                const index = self.used;
                self.used += 1;
                return &self.instances[index];
            }
            if (self.freed > 0) {
                for (self.instances) |*instance| {
                    if (instance.context == null) {
                        self.freed -= 1;
                        return instance;
                    }
                }
            }
            return null;
        }

        fn freeInstance(self: *@This(), instance: *Instance(T)) bool {
            if (self.contains(instance)) {
                instance.context = null;
                self.freed += 1;
                return true;
            }
            return false;
        }

        fn contains(self: *@This(), ptr: *const anyopaque) bool {
            const addr = @intFromPtr(ptr);
            const start = @intFromPtr(self.instances.ptr);
            const end = start + @sizeOf(Instance(T)) * self.instances.len;
            return start <= addr and addr < end;
        }

        test "use" {
            var bytes: [512]u8 = undefined;
            const chunk = Chunk(T).use(&bytes);
            try expect(@intFromPtr(chunk) == @intFromPtr(&bytes));
            try expect(chunk.instances.len > 0);
        }

        test "getInstance" {
            var bytes: [512]u8 = undefined;
            const chunk = Chunk(T).use(&bytes);
            while (chunk.getInstance()) |_| {}
            try expect(chunk.used == chunk.instances.len);
        }

        test "freeInstance" {
            var bytes: [512]u8 = undefined;
            const chunk = Chunk(T).use(&bytes);
            const instance1 = chunk.getInstance().?;
            const result1 = chunk.freeInstance(instance1);
            try expect(result1);
            try expect(chunk.freed == 1);
            var instance2: *Instance(T) = undefined;
            while (chunk.getInstance()) |i| {
                instance2 = i;
            }
            try expect(instance2 == instance1);
            try expect(chunk.freed == 0);
        }

        test "contains" {
            var bytes: [512]u8 = undefined;
            const chunk = Chunk(T).use(&bytes);
            const instance = chunk.getInstance().?;
            const f = instance.function(fn () void);
            try expect(chunk.contains(instance));
            try expect(chunk.contains(f));
            try expect(!chunk.contains(@ptrFromInt(0xAAAA)));
        }
    };
}

pub fn Factory(comptime T: type) type {
    return struct {
        last_chunk: ?*Chunk(T) = null,
        chunk_count: usize = 0,

        pub fn init() @This() {
            return .{};
        }

        pub fn alloc(self: *@This(), fn_ptr: *const anyopaque, context: T) !*Instance(T) {
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
                const new_chunk = Chunk(T).use(bytes);
                if (self.last_chunk) |lc| {
                    lc.next_chunk = new_chunk;
                    new_chunk.prev_chunk = lc;
                }
                self.last_chunk = new_chunk;
                self.chunk_count += 1;
                break :alloc new_chunk.getInstance().?;
            };
            instance.construct(fn_ptr, context);
            return instance;
        }

        pub fn free(self: *@This(), instance: *Instance(T)) bool {
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

        test "alloc" {
            const Closure = Instance(T);
            const ns = struct {
                fn check() bool {
                    return Closure.getContext().check();
                }
            };
            var factory = init();
            for (0..1000) |index| {
                const context = T.create(index);
                const instance = try factory.alloc(&ns.check, context);
                const f = instance.function(@TypeOf(ns.check));
                const result = f();
                try expect(result == true);
            }
            try expect(factory.chunk_count > 1);
        }

        test "free" {
            const ns = struct {
                fn exist() void {}
            };
            var factory = init();
            var instances: [1000]*Instance(T) = undefined;
            for (&instances, 0..) |*p, index| {
                const context = T.create(index);
                p.* = try factory.alloc(&ns.exist, context);
            }
            for (instances) |instance| {
                const result = factory.free(instance);
                try expect(result);
            }
            try expect(factory.chunk_count == 0);
        }

        test "contains" {
            const ns = struct {
                fn exist() void {}
            };
            var factory = init();
            const context = T.create(1234);
            const instance = try factory.alloc(&ns.exist, context);
            const f = instance.function(@TypeOf(ns.exist));
            try expect(factory.contains(f));
            try expect(!factory.contains(&ns.exist));
        }
    };
}

test {
    _ = Factory(struct {
        index: usize,
        id: usize = 1234,

        pub fn create(index: usize) @This() {
            return .{ .index = index };
        }

        pub fn check(self: @This()) bool {
            return self.id == 1234;
        }
    });
}
