const std = @import("std");
const builtin = @import("builtin");
const fn_template = @import("./fn-template.zig");
const expect = std.testing.expect;

pub fn HandlerOf(comptime FT: type, comptime CT: type) type {
    const f = @typeInfo(FT).Fn;
    if (f.is_generic or f.is_var_args) {
        @compileError("Cannot create closure of generic or variadic function");
    }
    if (f.return_type == null) {
        @compileError("Cannot create closre of function without fixed return type");
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

        context: ?CT,
        bytes: [code_len]u8 align(@alignOf(fn () void)) = undefined,

        pub fn fromFn(fn_ptr: *const anyopaque) *@This() {
            const bytes: *const [code_len]u8 = @ptrCast(fn_ptr);
            return @alignCast(@fieldParentPtr("bytes", @constCast(bytes)));
        }

        test "fromFn()" {}

        fn construct(self: *@This(), comptime FT: type, handler: HandlerOf(FT, CT), ctx: CT) !*const FT {
            self.* = .{ .context = ctx };
            try self.writeInstructions(FT, handler);
            return @ptrCast(&self.bytes);
        }

        test "construct" {
            // const bytes = try std.posix.mmap(
            //     null,
            //     1024 * 4,
            //     std.posix.PROT.READ | std.posix.PROT.WRITE | std.posix.PROT.EXEC,
            //     .{ .TYPE = .PRIVATE, .ANONYMOUS = true },
            //     -1,
            //     0,
            // );
            // defer std.posix.munmap(bytes);
            // const closure: *@This() = @ptrCast(bytes);
            // const context = CT.create(1234);
            // // simple case
            // const ns1 = struct {
            //     fn check(number_ptr: *usize, a1: usize, a2: usize, ctx: *const CT) usize {
            //         if (ctx.check()) {
            //             number_ptr.* = a1;
            //             return a1 + a2;
            //         } else {
            //             return 0;
            //         }
            //     }
            // };
            // const FT = fn (*usize, usize, usize) usize;
            // const f1 = try closure.construct(FT, ns1.check, context);
            // var number1: usize = 0;
            // const result1 = f1(&number1, 123, 456);
            // try expect(result1 == 123 + 456);
            // try expect(number1 == 123);
            // try expect(f1(&number1, 123, 456) == result1);
            // // stack usage
            // const ns2 = struct {
            //     fn check(number_ptr: *usize, a1: usize, a2: usize, a3: usize, a4: usize, a5: usize, a6: usize, ctx: *const CT) usize {
            //         if (ctx.check()) {
            //             number_ptr.* = a1;
            //             return a1 + a2 + a3 + a4 + a5 + a6;
            //         } else {
            //             return 0;
            //         }
            //     }
            // };
            // const f2 = closure.construct(ns2.check, context);
            // var number2: usize = 0;
            // const result2 = f2(&number2, 123, 456, 3, 4, 5, 6);
            // try expect(result2 == 123 + 456 + 3 + 4 + 5 + 6);
            // try expect(number2 == 123);
            // try expect(f2(&number2, 123, 456, 3, 4, 5, 6) == result1);
        }

        fn writeInstructions(self: *@This(), comptime FT: type, handler: anytype) !void {
            const context_address = @intFromPtr(&self.context);
            const handler_address = @intFromPtr(&handler);
            const code_ptr = fn_template.get(FT, @TypeOf(handler));
            var instr_buffer: [256]Instruction = undefined;
            const instrs = Instruction.decode(code_ptr, &instr_buffer);
            var context_replaced = false;
            var fn_replaced = false;
            for (instrs) |*instr| {
                switch (builtin.target.cpu.arch) {
                    .x86_64 => {
                        switch (instr.opcode) {
                            .MOV_AX_IMM,
                            .MOV_CX_IMM,
                            .MOV_DX_IMM,
                            .MOV_BX_IMM,
                            .MOV_SP_IMM,
                            .MOV_BP_IMM,
                            .MOV_SI_IMM,
                            .MOV_DI_IMM,
                            => {
                                if (instr.imm64.? == fn_template.context_placeholder) {
                                    instr.imm64 = context_address;
                                    context_replaced = true;
                                } else if (instr.imm64.? == fn_template.fn_placeholder) {
                                    instr.imm64 = handler_address;
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
            encoder.encode(instrs);
            std.debug.print("Decoding encoded binary:\n", .{});
            _ = Instruction.decode(&self.bytes, &instr_buffer);
        }

        test "writeInstructions" {
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
            const ns1 = struct {
                fn check(a1: i32, a2: i32, a3: i32, ctx: *const CT) i32 {
                    if (ctx.check()) {
                        return a1 + a2 + a3;
                    } else {
                        return 0;
                    }
                }
            };
            const FT = fn (i32, i32, i32) i32;
            try closure.writeInstructions(FT, ns1.check);
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

const Instruction = switch (builtin.target.cpu.arch) {
    .x86, .x86_64 => struct {
        pub const Opcode = enum(u8) {
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
            CALL_IMM32 = 0xe8,
            JMP_IMM8 = 0xeb,
            JMP_IMM32 = 0xe9,
            JMP_RM = 0xff,
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
        opcode: Opcode = .NOP,
        opcode_ext: ?u8 = null,
        mod_rm: ?ModRM = null,
        sib: ?SIB = null,
        disp8: ?i8 = null,
        disp32: ?i32 = null,
        imm8: ?u8 = null,
        imm32: ?u32 = null,
        imm64: ?u64 = null,

        pub fn decode(bytes: [*]const u8, buffer: []@This()) []@This() {
            var len: usize = 0;
            var i: usize = 0;
            while (len < buffer.len) {
                var instr: @This() = .{};
                // look for legacy prefix
                instr.prefix = result: {
                    const prefix = std.meta.intToEnum(Prefix, bytes[i]) catch null;
                    if (prefix != null) i += 1;
                    break :result prefix;
                };
                // look for rex prefix
                instr.rex = result: {
                    const rex: REX = @bitCast(bytes[i]);
                    if (rex.pat == 4) {
                        i += 1;
                        break :result rex;
                    } else {
                        break :result rex;
                    }
                };
                // see if op has ModR/M byte
                instr.opcode = @enumFromInt(bytes[i]);
                if (instr.opcode == .LEA_RM_R) {
                    std.debug.print("\nMystery LEA:\n", .{});
                    for (0..16) |offset| {
                        std.debug.print("{x} ", .{bytes[i + offset]});
                    }
                    std.debug.print("\n\n", .{});
                }

                i += 1;
                const has_mod_rm = switch (instr.opcode) {
                    .ADD_RM_IMM32,
                    .ADD_RM_IMM8,
                    .PUSH_IMM32,
                    .MOV_RM_R,
                    .MOV_R_M,
                    .LEA_RM_R,
                    => true,
                    else => false,
                };
                var has_sib = false;
                var disp_size: ?u8 = null;
                if (has_mod_rm) {
                    // decode ModR/M
                    const mod_rm: ModRM = @bitCast(bytes[i]);
                    i += 1;
                    if (mod_rm.mod == 2 or (mod_rm.mod == 0 and mod_rm.rm == 5)) {
                        disp_size = 32;
                    } else if (mod_rm.mod == 1) {
                        disp_size = 8;
                    }
                    has_sib = mod_rm.rm == 4;
                    instr.mod_rm = mod_rm;
                }
                if (has_sib) {
                    // decode SIB
                    const sib: SIB = @bitCast(bytes[i]);
                    i += 1;
                    if (sib.base == 5) {
                        disp_size = 32;
                    }
                    instr.sib = sib;
                }
                if (disp_size) |size| {
                    // get displacement
                    if (size == 8) {
                        instr.disp8 = std.mem.bytesToValue(i8, bytes[i .. i + 1]);
                        i += 1;
                    } else if (size == 32) {
                        instr.disp32 = std.mem.bytesToValue(i32, bytes[i .. i + 4]);
                        i += 4;
                    }
                }
                // get size of immediate (if any)
                const wide = if (instr.rex) |rex| rex.w == 1 else false;
                const imm_size: ?u8 = switch (instr.opcode) {
                    .ADD_AX_IMM8,
                    .SUB_AX_IMM8,
                    .ADD_RM_IMM8,
                    .JMP_IMM8,
                    => 8,
                    .ADD_AX_IMM32,
                    .SUB_AX_IMM32,
                    .ADD_RM_IMM32,
                    .PUSH_IMM32,
                    .CALL_IMM32,
                    .JMP_IMM32,
                    => 32,
                    .MOV_AX_IMM,
                    .MOV_CX_IMM,
                    .MOV_DX_IMM,
                    .MOV_BX_IMM,
                    .MOV_SP_IMM,
                    .MOV_BP_IMM,
                    .MOV_SI_IMM,
                    .MOV_DI_IMM,
                    => if (wide) 64 else 32,
                    else => null,
                };
                if (imm_size) |size| {
                    switch (size) {
                        8 => instr.imm8 = bytes[i],
                        32 => instr.imm32 = std.mem.bytesToValue(u32, bytes[i .. i + 4]),
                        64 => instr.imm64 = std.mem.bytesToValue(u64, bytes[i .. i + 8]),
                        else => {},
                    }
                    i += size / 8;
                }
                buffer[len] = instr;
                std.debug.print("{any}\n", .{instr});
                len += 1;
                switch (instr.opcode) {
                    .RET,
                    .JMP_IMM32,
                    .JMP_IMM8,
                    .JMP_RM,
                    => break,
                    else => {},
                }
            }
            return buffer[0..len];
        }
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
                std.debug.print("imm64 = {x}\n", .{imm64});
                std.debug.print("{d}\n", .{imm64 >> 15 & 1});
                std.debug.print("{d}\n", .{imm64 >> 31 & 1});
                std.debug.print("{d}\n", .{imm64 >> 47 & 1});
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

const InstructionEncoder = struct {
    bytes: [*]u8,
    len: usize = 0,

    pub fn encode(self: *@This(), instr: anytype) void {
        switch (@typeInfo(@TypeOf(instr))) {
            .Struct => |st| {
                if (st.layout == .@"packed") {
                    self.write(instr);
                } else {
                    inline for (st.fields) |field| {
                        self.encode(@field(instr, field.name));
                    }
                }
            },
            .Union => |un| {
                const Tag = un.tag_type orelse @compileError("Cannot handle untagged union");
                const tag: Tag = instr;
                return self.encode(@field(instr, @tagName(tag)));
            },
            .Array => for (instr) |element| self.encode(element),
            .Pointer => |pt| {
                switch (pt.size) {
                    .Slice => for (instr) |element| self.encode(element),
                    else => @compileError("Cannot handle non-slice pointers"),
                }
            },
            .Optional => if (instr) |value| self.encode(value),
            .Enum => self.encode(@intFromEnum(instr)),
            .Int, .Float, .Bool => self.write(instr),
            else => @compileError("Cannot handle " ++ @typeName(@TypeOf(instr))),
        }
    }

    test "encode" {
        var bytes: [32]u8 = undefined;
        var encoder: InstructionEncoder = .{ .bytes = &bytes };
        const u: u32 = 123;
        encoder.encode(u);
        const o: ?u32 = null;
        encoder.encode(o);
        const s: packed struct {
            a: u32 = 456,
            b: u32 = 789,
        } = .{};
        encoder.encode(s);
        try expect(@as(*align(1) u32, @ptrCast(&bytes[0])).* == 123);
        try expect(@as(*align(1) u32, @ptrCast(&bytes[4])).* == 456);
        try expect(@as(*align(1) u32, @ptrCast(&bytes[8])).* == 789);
    }

    fn write(self: *@This(), instr: anytype) void {
        const T = @TypeOf(instr);
        const ptr: *align(1) T = @ptrCast(&self.bytes[self.len]);
        ptr.* = instr;
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
