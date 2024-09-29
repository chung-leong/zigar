const std = @import("std");
const builtin = @import("builtin");
const fn_transform = @import("./fn-transform.zig");
const expect = std.testing.expect;

comptime {
    if (builtin.mode == .Debug) {
        @compileError("This file cannot be compiled at optimize=Debug");
    }
}

pub fn HandlerOf(comptime FT: type, comptime CT: type) type {
    const f = @typeInfo(FT).Fn;
    if (f.is_generic or f.is_var_args) {
        @compileError("Cannot create closure of generic or variadic function");
    }
    if (f.return_type == null) {
        @compileError("Cannot create closure of function without static return type");
    }
    var handler_params: [f.params.len + 1]std.builtin.Type.Fn.Param = undefined;
    inline for (f.params, 0..) |param, index| {
        handler_params[index] = param;
    }
    handler_params[f.params.len] = .{
        .is_generic = false,
        .is_noalias = false,
        .type = *const CT,
    };
    return @Type(.{
        .Fn = .{
            .calling_convention = f.calling_convention,
            .params = &handler_params,
            .is_generic = false,
            .is_var_args = false,
            .return_type = f.return_type,
        },
    });
}

pub fn Instance(comptime CT: type) type {
    return struct {
        pub const InstanceError = error{
            unable_to_find_context_placeholder,
            unable_to_find_function_placeholder,
        };

        const code_len = switch (builtin.target.cpu.arch) {
            .x86_64 => 128,
            .aarch64 => 72,
            .riscv64 => 66,
            .powerpc64le => 72,
            .x86 => 43,
            .arm => 52,
            else => @compileError("No support for closure on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
        };
        const code_align = @alignOf(fn () void);
        const context_placeholder: usize = switch (@bitSizeOf(usize)) {
            32 => 0xbad_beef_0,
            64 => 0xdead_beef_bad_00000,
            else => unreachable,
        };
        const fn_placeholder: usize = switch (@bitSizeOf(usize)) {
            32 => 0xbad_ee15_0,
            64 => 0xdead_ee15_bad_00000,
            else => unreachable,
        };

        context: ?CT,
        bytes: [code_len]u8 align(code_align) = undefined,

        pub fn function(self: *@This(), comptime FT: type) *const FT {
            return @ptrCast(&self.bytes);
        }

        pub fn fromFunction(fn_ptr: *align(code_align) const anyopaque) *@This() {
            const bytes: *align(code_align) const [code_len]u8 = @ptrCast(fn_ptr);
            return @fieldParentPtr("bytes", @constCast(bytes));
        }

        test "fromFunction()" {}

        fn construct(self: *@This(), comptime FT: type, handler: HandlerOf(FT, CT), ctx: CT) !void {
            self.* = .{ .context = ctx };
            const context_address = @intFromPtr(&self.context);
            const handler_address = @intFromPtr(&handler);
            const code_ptr = getTemplate(FT);
            var buffer: [256]Instruction = undefined;
            var decoder: InstructionDecoder = .{ .instructions = &buffer };
            const instr_count = decoder.decode(code_ptr);
            const instrs = buffer[0..instr_count];
            var context_replaced = false;
            var fn_replaced = false;
            for (instrs) |*instr| {
                switch (builtin.target.cpu.arch) {
                    .x86_64 => {
                        switch (instr.op.code) {
                            .MOV_AX_IMM,
                            .MOV_CX_IMM,
                            .MOV_DX_IMM,
                            .MOV_BX_IMM,
                            .MOV_SP_IMM,
                            .MOV_BP_IMM,
                            .MOV_SI_IMM,
                            .MOV_DI_IMM,
                            => {
                                if (instr.op.imm64.? == context_placeholder) {
                                    instr.op.imm64 = context_address;
                                    context_replaced = true;
                                } else if (instr.op.imm64.? == fn_placeholder) {
                                    instr.op.imm64 = handler_address;
                                    fn_replaced = true;
                                }
                            },
                            else => {},
                        }
                    },
                    else => unreachable,
                }
            }
            if (!context_replaced) {
                return InstanceError.unable_to_find_context_placeholder;
            } else if (!fn_replaced) {
                return InstanceError.unable_to_find_function_placeholder;
            }
            var encoder: InstructionEncoder = .{ .bytes = &self.bytes };
            _ = encoder.encode(instrs);
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
            const context = CT.create(1234);
            // simple case
            const ns1 = struct {
                fn check(number_ptr: *usize, a1: usize, a2: usize, ctx: *const CT) usize {
                    if (ctx.check()) {
                        number_ptr.* = a1;
                        return a1 + a2;
                    } else {
                        return 0;
                    }
                }
            };
            const FT1 = fn (*usize, usize, usize) usize;
            try closure.construct(FT1, ns1.check, context);
            const f1 = closure.function(FT1);
            var number1: usize = 0;
            const result1 = f1(&number1, 123, 456);
            try expect(result1 == 123 + 456);
            try expect(number1 == 123);
            try expect(f1(&number1, 123, 456) == result1);
            // stack usage
            const ns2 = struct {
                fn check(number_ptr: *usize, a1: usize, a2: usize, a3: usize, a4: usize, a5: usize, a6: usize, ctx: *const CT) usize {
                    if (ctx.check()) {
                        number_ptr.* = a1;
                        return a1 + a2 + a3 + a4 + a5 + a6;
                    } else {
                        return 0;
                    }
                }
            };
            const FT2 = fn (*usize, usize, usize, usize, usize, usize, usize) usize;
            try closure.construct(FT2, ns2.check, context);
            const f2 = closure.function(FT2);
            var number2: usize = 0;
            const result2 = f2(&number2, 123, 456, 3, 4, 5, 6);
            try expect(result2 == 123 + 456 + 3 + 4 + 5 + 6);
            try expect(number2 == 123);
            try expect(f2(&number2, 123, 456, 3, 4, 5, 6) == result2);
        }

        fn getTemplate(comptime FT: type) [*]const u8 {
            const HT = HandlerOf(FT, CT);
            const h = @typeInfo(FT).Fn;
            const ns = struct {
                fn call(args: std.meta.ArgsTuple(FT)) h.return_type.? {
                    const handler: *const HT = @ptrFromInt(fn_placeholder);
                    var handle_args: std.meta.ArgsTuple(HT) = undefined;
                    inline for (args, 0..) |arg, i| {
                        handle_args[i] = arg;
                    }
                    // last argument is the context pointer
                    handle_args[handle_args.len - 1] = @ptrFromInt(context_placeholder);
                    return @call(.auto, handler, handle_args);
                }
            };
            const caller = fn_transform.spreadArgs(ns.call, h.calling_convention);
            return @ptrCast(&caller);
        }
    };
}

fn Chunk(comptime CT: type) type {
    return struct {
        bytes: []u8,
        instances: []Instance(CT),
        used: usize = 0,
        freed: usize = 0,
        prev_chunk: ?*@This() = null,
        next_chunk: ?*@This() = null,

        fn use(bytes: []u8) *@This() {
            const self: *@This() = @ptrCast(@alignCast(bytes));
            const addr = @intFromPtr(bytes.ptr);
            const instance_addr = std.mem.alignForward(usize, addr + @sizeOf(@This()), @alignOf(Instance(CT)));
            const capacity = (bytes.len - (instance_addr - addr)) / @sizeOf(Instance(CT));
            const instance_ptr: [*]Instance(CT) = @ptrFromInt(instance_addr);
            self.* = .{
                .bytes = bytes,
                .instances = instance_ptr[0..capacity],
            };
            return self;
        }

        fn getInstance(self: *@This()) ?*Instance(CT) {
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

        fn freeInstance(self: *@This(), instance: *Instance(CT)) bool {
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
            const end = start + @sizeOf(Instance(CT)) * self.instances.len;
            return start <= addr and addr < end;
        }

        test "use" {
            var bytes: [512]u8 = undefined;
            const chunk = use(&bytes);
            try expect(@intFromPtr(chunk) == @intFromPtr(&bytes));
            try expect(chunk.instances.len > 0);
        }

        test "getInstance" {
            var bytes: [512]u8 = undefined;
            const chunk = use(&bytes);
            while (chunk.getInstance()) |_| {}
            try expect(chunk.used == chunk.instances.len);
        }

        test "freeInstance" {
            var bytes: [512]u8 = undefined;
            const chunk = use(&bytes);
            const instance1 = chunk.getInstance().?;
            const result1 = chunk.freeInstance(instance1);
            try expect(result1);
            try expect(chunk.freed == 1);
            var instance2: *Instance(CT) = undefined;
            while (chunk.getInstance()) |i| {
                instance2 = i;
            }
            try expect(instance2 == instance1);
            try expect(chunk.freed == 0);
        }

        test "contains" {
            var bytes: [512]u8 = undefined;
            const chunk = use(&bytes);
            const instance = chunk.getInstance().?;
            const f = instance.function(fn () void);
            try expect(chunk.contains(instance));
            try expect(chunk.contains(f));
            try expect(!chunk.contains(@ptrFromInt(0xAAAA)));
        }
    };
}

pub fn Factory(comptime CT: type) type {
    return struct {
        last_chunk: ?*Chunk(CT) = null,
        chunk_count: usize = 0,

        pub fn init() @This() {
            return .{};
        }

        pub fn alloc(self: *@This(), fn_ptr: *const anyopaque, context: CT) !*Instance(CT) {
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
                const new_chunk = Chunk(CT).use(bytes);
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

        pub fn free(self: *@This(), instance: *Instance(CT)) bool {
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
            const Closure = Instance(CT);
            const ns = struct {
                fn check() bool {
                    return Closure.getContext().check();
                }
            };
            var factory = init();
            for (0..1000) |index| {
                const context = CT.create(index);
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
            var instances: [1000]*Instance(CT) = undefined;
            for (&instances, 0..) |*p, index| {
                const context = CT.create(index);
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
            const context = CT.create(1234);
            const instance = try factory.alloc(&ns.exist, context);
            const f = instance.function(@TypeOf(ns.exist));
            try expect(factory.contains(f));
            try expect(!factory.contains(&ns.exist));
        }
    };
}

const Instruction = struct {
    op: Op,
    offset: usize,

    const Op = switch (builtin.target.cpu.arch) {
        .x86, .x86_64 => struct {
            pub const Code = enum(u8) {
                ADD_AX_IMM8 = 0x04,
                ADD_AX_IMM32 = 0x05,
                SUB_AX_IMM8 = 0x2c,
                SUB_AX_IMM32 = 0x2d,
                PUSH_AX = 0x50,
                PUSH_CX = 0x51,
                PUSH_DX = 0x52,
                PUSH_BX = 0x53,
                PUSH_SP = 0x54,
                PUSH_BP = 0x55,
                PUSH_SI = 0x56,
                PUSH_DI = 0x57,
                POP_AX = 0x58,
                POP_CX = 0x59,
                POP_DX = 0x5a,
                POP_BX = 0x5b,
                POP_SP = 0x5c,
                POP_BP = 0x5d,
                POP_SI = 0x5e,
                POP_DI = 0x5f,
                PUSH_IMM32 = 0x68,
                ADD_RM_IMM32 = 0x80,
                ADD_RM_IMM8 = 0x83,
                MOV_RM_R = 0x89,
                MOV_R_M = 0x8b,
                LEA_RM_R = 0x8d,
                NOP = 0x90,
                MOV_AX_IMM = 0xb8,
                MOV_CX_IMM = 0xb9,
                MOV_DX_IMM = 0xba,
                MOV_BX_IMM = 0xbb,
                MOV_SP_IMM = 0xbc,
                MOV_BP_IMM = 0xbd,
                MOV_SI_IMM = 0xbe,
                MOV_DI_IMM = 0xbf,
                RET = 0xc3,
                OP_RM = 0xff,
                _,
            };
            pub const Prefix = enum(u8) {
                ES = 0x26,
                CS = 0x2e,
                SS = 0x36,
                DS = 0x3e,
                FS = 0x64,
                GS = 0x65,
                OS = 0x66,
                AS = 0x67,
                F2 = 0xf2,
                F3 = 0xf3,
            };
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

            prefix: ?Prefix = null,
            rex: ?REX = null,
            code: Code = .NOP,
            mod_rm: ?ModRM = null,
            sib: ?SIB = null,
            disp8: ?i8 = null,
            disp32: ?i32 = null,
            imm8: ?u8 = null,
            imm32: ?u32 = null,
            imm64: ?u64 = null,
        },
        .aarch64 => struct {
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
            const SUB = packed struct {
                rd: u5,
                rn: u5,
                imm12: u12,
                opc: u10 = 0x344,
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
        },
        .riscv64 => struct {
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
            const SUB = packed struct(u32) {
                opc: u7 = 0x33,
                rd: u5,
                func: u3 = 0,
                rs1: u5,
                rs2: u5,
                offset_11_5: u7 = 0x20,
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
        },
        .powerpc64le => struct {
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
                    const imm64_47_32 = (imm64 >> 32 & 0xFFFF) + (imm64 >> 31 & 0);
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
        },
        .arm => struct {
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
            const SUB = packed struct {
                imm12: u12,
                rd: u4,
                rn: u4,
                opc: u8 = 0x24,
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
            fn imm12(comptime value: u32) u12 {
                var r: u32 = 0;
                var v: u32 = value;
                // keep rotating left, attaching overflow on the right side, until v fits an 8-bit int
                while (v & ~@as(u32, 0xff) != 0) {
                    v = (v << 2) | (v >> 30);
                    r += 1;
                    if (r > 15) {
                        @compileError("Cannot encode value as imm12");
                    }
                }
                return r << 8 | v;
            }
        },
        else => void,
    };
};

const InstructionDecoder = struct {
    instructions: ?[]Instruction = null,

    pub fn decode(self: *@This(), bytes: [*]const u8) usize {
        var len: usize = 0;
        switch (builtin.target.cpu.arch) {
            .x86, .x86_64 => {
                const Code = Instruction.Op.Code;
                const mod_rm_codes, const imm8_codes, const imm32_codes, const imm64_codes = comptime result: {
                    @setEvalBranchQuota(10000);
                    const opcode_fields = @typeInfo(Code).Enum.fields;
                    var list1: [opcode_fields.len]Code = undefined;
                    var list2: [opcode_fields.len]Code = undefined;
                    var list3: [opcode_fields.len]Code = undefined;
                    var list4: [opcode_fields.len]Code = undefined;
                    var len1: usize = 0;
                    var len2: usize = 0;
                    var len3: usize = 0;
                    var len4: usize = 0;
                    for (opcode_fields) |field| {
                        const opcode: Code = @enumFromInt(field.value);
                        for (.{ "_RM_", "_R_" }) |substr| {
                            if (std.mem.indexOf(u8, field.name, substr) != null) {
                                list1[len1] = opcode;
                                len1 += 1;
                            }
                        }
                        if (std.mem.indexOf(u8, field.name, "_IMM8") != null) {
                            list2[len2] = opcode;
                            len2 += 1;
                        } else if (std.mem.indexOf(u8, field.name, "_IMM32") != null) {
                            list3[len3] = opcode;
                            len3 += 1;
                        } else if (std.mem.indexOf(u8, field.name, "_IMM") != null) {
                            if (@bitSizeOf(usize) == 64) {
                                list4[len4] = opcode;
                                len4 += 1;
                            } else {
                                list3[len3] = opcode;
                                len3 += 1;
                            }
                        }
                    }
                    var array1: [len1]Code = undefined;
                    var array2: [len2]Code = undefined;
                    var array3: [len3]Code = undefined;
                    var array4: [len4]Code = undefined;
                    @memcpy(&array1, list1[0..len1]);
                    @memcpy(&array2, list2[0..len2]);
                    @memcpy(&array3, list3[0..len3]);
                    @memcpy(&array4, list4[0..len4]);
                    break :result .{ array1, array2, array3, array4 };
                };

                var i: usize = 0;
                while (true) {
                    const offset = i;
                    var op: Instruction.Op = .{};
                    // look for legacy prefix
                    op.prefix = result: {
                        const prefix = std.meta.intToEnum(Instruction.Op.Prefix, bytes[i]) catch null;
                        if (prefix != null) i += 1;
                        break :result prefix;
                    };
                    // look for rex prefix
                    op.rex = result: {
                        const rex: Instruction.Op.REX = @bitCast(bytes[i]);
                        if (rex.pat == 4) {
                            i += 1;
                            break :result rex;
                        } else {
                            break :result null;
                        }
                    };
                    // see if op has ModR/M byte
                    op.code = @enumFromInt(bytes[i]);
                    i += 1;
                    var sib_present = false;
                    var disp_size: ?u8 = null;
                    if (std.mem.indexOfScalar(Code, &mod_rm_codes, op.code) != null) {
                        // decode ModR/M
                        const mod_rm: Instruction.Op.ModRM = @bitCast(bytes[i]);
                        i += 1;
                        if (mod_rm.mod == 2 or (mod_rm.mod == 0 and mod_rm.rm == 5)) {
                            disp_size = 32;
                        } else if (mod_rm.mod == 1) {
                            disp_size = 8;
                        }
                        sib_present = mod_rm.rm == 4;
                        op.mod_rm = mod_rm;
                    }
                    if (sib_present) {
                        // decode SIB
                        const sib: Instruction.Op.SIB = @bitCast(bytes[i]);
                        i += 1;
                        if (sib.base == 5) {
                            disp_size = 32;
                        }
                        op.sib = sib;
                    }
                    if (disp_size) |size| {
                        // get displacement
                        if (size == 8) {
                            op.disp8 = std.mem.bytesToValue(i8, bytes[i .. i + 1]);
                            i += 1;
                        } else if (size == 32) {
                            op.disp32 = std.mem.bytesToValue(i32, bytes[i .. i + 4]);
                            i += 4;
                        }
                    }
                    // copy immediate (if any)
                    if (std.mem.indexOfScalar(Code, &imm8_codes, op.code) != null) {
                        op.imm8 = bytes[i];
                        i += 1;
                    } else if (std.mem.indexOfScalar(Code, &imm32_codes, op.code) != null) {
                        op.imm32 = std.mem.bytesToValue(u32, bytes[i .. i + 4]);
                        i += 4;
                    } else if (std.mem.indexOfScalar(Code, &imm64_codes, op.code) != null) {
                        op.imm64 = std.mem.bytesToValue(u64, bytes[i .. i + 8]);
                        i += 8;
                    }
                    if (self.instructions) |b| b[len] = .{ .offset = offset, .op = op };
                    len += 1;
                    switch (op.code) {
                        .RET => break,
                        .OP_RM => switch (op.mod_rm.?.reg) {
                            0 => {}, // inc
                            1 => {}, // dec
                            2, 3 => {}, // call
                            4, 5 => break, // jmp
                            6 => {}, // push quad
                            else => {},
                        },
                        else => {},
                    }
                }
            },
            else => unreachable,
        }
        return len;
    }
};

const InstructionEncoder = struct {
    bytes: ?[*]u8 = null,
    len: usize = 0,

    pub fn encode(self: *@This(), instrs: []Instruction) usize {
        self.len = 0;
        for (instrs) |instr| {
            self.add(instr.op);
        }
        return self.len;
    }

    fn add(self: *@This(), instr: anytype) void {
        switch (@typeInfo(@TypeOf(instr))) {
            .Struct => |st| {
                if (st.layout == .@"packed") {
                    self.write(instr);
                } else {
                    inline for (st.fields) |field| {
                        self.add(@field(instr, field.name));
                    }
                }
            },
            .Union => |un| {
                const Tag = un.tag_type orelse @compileError("Cannot handle untagged union");
                const tag: Tag = instr;
                return self.add(@field(instr, @tagName(tag)));
            },
            .Array => for (instr) |element| self.add(element),
            .Pointer => |pt| {
                switch (pt.size) {
                    .Slice => for (instr) |element| self.add(element),
                    else => @compileError("Cannot handle non-slice pointers"),
                }
            },
            .Optional => if (instr) |value| self.add(value),
            .Enum => self.add(@intFromEnum(instr)),
            .Int, .Float, .Bool => self.write(instr),
            else => @compileError("Cannot handle " ++ @typeName(@TypeOf(instr))),
        }
    }

    test "add" {
        var bytes: [32]u8 = undefined;
        var encoder: InstructionEncoder = .{ .bytes = &bytes };
        const u: u32 = 123;
        encoder.add(u);
        const o: ?u32 = null;
        encoder.add(o);
        const s: packed struct {
            a: u32 = 456,
            b: u32 = 789,
        } = .{};
        encoder.add(s);
        try expect(@as(*align(1) u32, @ptrCast(&bytes[0])).* == 123);
        try expect(@as(*align(1) u32, @ptrCast(&bytes[4])).* == 456);
        try expect(@as(*align(1) u32, @ptrCast(&bytes[8])).* == 789);
    }

    fn write(self: *@This(), instr: anytype) void {
        const T = @TypeOf(instr);
        if (self.bytes) |b| {
            const ptr: *align(1) T = @ptrCast(&b[self.len]);
            ptr.* = instr;
        }
        self.len += @bitSizeOf(T) / 8;
    }

    test "write" {
        var bytes: [32]u8 = undefined;
        var encoder: InstructionEncoder = .{ .bytes = &bytes };
        const u: u32 = 123;
        encoder.write(u);
        const s: packed struct {
            a: u32 = 456,
            b: u32 = 789,
        } = .{};
        encoder.write(s);
        try expect(@as(*align(1) u32, @ptrCast(&bytes[0])).* == 123);
        try expect(@as(*align(1) u32, @ptrCast(&bytes[4])).* == 456);
        try expect(@as(*align(1) u32, @ptrCast(&bytes[8])).* == 789);
    }
};

test {
    const TestContext = struct {
        index: usize,
        id: usize = 1234,

        pub fn create(index: usize) @This() {
            return .{ .index = index };
        }

        pub fn check(self: @This()) bool {
            return self.id == 1234;
        }
    };
    // _ = Factory(TestContext);
    _ = Instance(TestContext);
    _ = InstructionEncoder;
}
