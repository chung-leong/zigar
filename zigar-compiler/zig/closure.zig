const std = @import("std");
const builtin = @import("builtin");
const fn_transform = @import("./fn-transform.zig");
const expect = std.testing.expect;

pub fn Instance(comptime T: type) type {
    return struct {
        const single_threaded = builtin.single_threaded;
        const code_size = switch (builtin.target.cpu.arch) {
            .x86_64 => 49,
            .aarch64 => 72,
            .riscv64 => 66,
            .powerpc64le => 72,
            .x86 => 43,
            .arm => 52,
            else => @compileError("No support for closure on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
        };

        context: ?T,
        bytes: [code_size]u8 = undefined,

        pub fn fromFn(fn_ptr: *const anyopaque) *@This() {
            const bytes: *const [code_size]u8 = @ptrCast(fn_ptr);
            return @alignCast(@fieldParentPtr("bytes", @constCast(bytes)));
        }

        test "fromFn()" {}

        pub fn FunctionOf(comptime handler: anytype) type {
            const FT = @TypeOf(handler);
            switch (@typeInfo(FT)) {
                .Fn => |f| {
                    const valid = switch (f.params.len) {
                        0 => false,
                        else => if (f.params[f.params.len - 1].type) |PT| switch (@typeInfo(PT)) {
                            .Pointer => |pt| pt.child == T and pt.is_const,
                            else => false,
                        } else false,
                    };
                    if (!valid) {
                        @compileError("The last parameter must be " ++ @typeName(*const T));
                    }
                },
                else => @compileError("Handler must be a function"),
            }
            var f = @typeInfo(FT).Fn;
            f.params = f.params[0 .. f.params.len - 1];
            return @Type(.{ .Fn = f });
        }

        fn construct(self: *@This(), comptime handler: anytype, ctx: T) *const FunctionOf(handler) {
            self.* = .{ .context = ctx };
            self.createInstructions(handler);
            return @ptrCast(@alignCast(&self.bytes));
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
            // simple case
            const ns1 = struct {
                fn check(number_ptr: *usize, a1: usize, a2: usize, ctx: *const T) usize {
                    if (ctx.check()) {
                        number_ptr.* = a1;
                        return a1 + a2;
                    } else {
                        return 0;
                    }
                }
            };
            const f1 = closure.construct(ns1.check, context);
            var number1: usize = 0;
            const result1 = f1(&number1, 123, 456);
            try expect(result1 == 123 + 456);
            try expect(number1 == 123);
            try expect(f1(&number1, 123, 456) == result1);
            // stack usage
            const ns2 = struct {
                fn check(number_ptr: *usize, a1: usize, a2: usize, a3: usize, a4: usize, a5: usize, a6: usize, ctx: *const T) usize {
                    if (ctx.check()) {
                        number_ptr.* = a1;
                        return a1 + a2 + a3 + a4 + a5 + a6;
                    } else {
                        return 0;
                    }
                }
            };
            const f2 = closure.construct(ns2.check, context);
            var number2: usize = 0;
            const result2 = f2(&number2, 123, 456, 3, 4, 5, 6);
            try expect(result2 == 123 + 456 + 3 + 4 + 5 + 6);
            try expect(number2 == 123);
        }

        fn createInstructions(self: *@This(), comptime handler: anytype) void {
            var code: InstructionEncoder = .{ .bytes = &self.bytes };
            // create a unique signature so that we can find the context pointer in unused stack space
            const signature = comptime createSignature(handler);
            // this number need to be larger than the stack frame of functions from createCaller()
            const signature_offset = 1024;
            const self_addr = @intFromPtr(self);
            const caller = createCaller(handler, signature);
            const caller_addr = @intFromPtr(&caller);
            const I = Instruction;
            switch (builtin.target.cpu.arch) {
                .x86_64 => {
                    const O = I.Opcode;
                    // mov rax, signature
                    code.add(I{
                        .rex = .{},
                        .opcode = O.MOV_AX,
                        .imm64 = signature,
                    });
                    // mov [rsp - signature_offset], rax
                    code.add(I{
                        .rex = .{},
                        .opcode = O.MOV,
                        .mod_rm = .{ .rm = 4, .mod = 2 },
                        .sib = .{ .base = 4, .index = 4 },
                        .disp32 = -signature_offset,
                    });
                    // mov rax, self_addr
                    code.add(I{
                        .rex = .{},
                        .opcode = O.MOV_AX,
                        .imm64 = self_addr,
                    });
                    // mov [rsp - signature_offset + 8], rax
                    code.add(I{
                        .rex = .{},
                        .opcode = O.MOV,
                        .mod_rm = .{ .rm = 4, .mod = 2 },
                        .sib = .{ .base = 4, .index = 4 },
                        .disp32 = -signature_offset + 8,
                    });
                    // mov rax, caller_addr
                    code.add(I{
                        .rex = .{},
                        .opcode = O.MOV_AX,
                        .imm64 = caller_addr,
                    });
                    // jmp [rax]
                    code.add(I{
                        .rex = .{},
                        .opcode = O.JMP,
                        .mod_rm = .{ .reg = 4, .mod = 3 },
                    });
                },
                .aarch64 => {
                    // sub x10, sp, signature_offset
                    code.add(I.SUB{
                        .rd = 10,
                        .rn = 31,
                        .imm12 = signature_offset,
                    });
                    code.add(I.SUB{
                        .rd = 11,
                        .rn = 31,
                        .imm12 = signature_offset,
                    });
                    code.add(I.SUB{
                        .rd = 12,
                        .rn = 31,
                        .imm12 = 0,
                    });
                    // mov x9, signature
                    code.add(I.MOV_IMM64.init(9, signature));
                    // sd [x10], x9
                    code.add(I.STR{ .rn = 10, .rt = 9 });
                    // mov x9, self_addr
                    code.add(I.MOV_IMM64.init(9, self_addr));
                    // sd [x10 + 8], x9
                    code.add(I.STR{ .rn = 10, .rt = 9, .imm12 = 1 });
                    // mov x9, caller_addr
                    code.add(I.MOV_IMM64.init(9, caller_addr));
                    // br x9
                    code.add(I.BR{ .rn = 9 });
                },
                .riscv64 => {},
                .powerpc64le => {},
                .x86 => {
                    const O = I.Opcode;
                    // mov eax, (signature & 0xffffffff)
                    code.add(I{
                        .opcode = O.MOV_AX,
                        .imm32 = signature & 0xffff_ffff,
                    });
                    // mov [esp - signature_offset], eax
                    code.add(I{
                        .opcode = O.MOV,
                        .mod_rm = .{ .rm = 4, .mod = 2 },
                        .sib = .{ .base = 4, .index = 4 },
                        .disp32 = -signature_offset,
                    });
                    // mov eax, (signature >> 32)
                    code.add(I{
                        .opcode = O.MOV_AX,
                        .imm32 = signature >> 32,
                    });
                    // mov [esp - signature_offset + 4], eax
                    code.add(I{
                        .opcode = O.MOV,
                        .mod_rm = .{ .rm = 4, .mod = 2 },
                        .sib = .{ .base = 4, .index = 4 },
                        .disp32 = -signature_offset + 4,
                    });
                    // mov eax, self_addr
                    code.add(I{
                        .opcode = O.MOV_AX,
                        .imm32 = self_addr,
                    });
                    // mov [esp - signature_offset + 8], rax
                    code.add(I{
                        .opcode = O.MOV,
                        .mod_rm = .{ .rm = 4, .mod = 2 },
                        .sib = .{ .base = 4, .index = 4 },
                        .disp32 = -signature_offset + 8,
                    });
                    // mov eax, caller_addr
                    code.add(I{
                        .opcode = O.MOV_AX,
                        .imm32 = caller_addr,
                    });
                    // jmp [eax]
                    code.add(I{
                        .opcode = O.JMP,
                        .mod_rm = .{ .reg = 4, .mod = 3 },
                    });
                },
                .arm => {
                    // sub r5, sp, signature_offset
                    code.add(I.SUB{
                        .rd = 5,
                        .rn = 13,
                        .imm12 = comptime I.imm12(signature_offset),
                    });
                    // mov r4, (signature & 0xffffffff)
                    code.add(I.MOV_IMM32.init(4, signature & 0xffff_ffff));
                    // str [r5], r4
                    code.add(I.STR{ .rn = 5, .rt = 4 });
                    // mov r4, (signature >> 32)
                    code.add(I.MOV_IMM32.init(4, signature >> 32));
                    // str [r5 + 4], r4
                    code.add(I.STR{ .rn = 5, .rt = 4, .imm12 = 4 });
                    // mov r4, self_addr
                    code.add(I.MOV_IMM32.init(4, self_addr));
                    // str [r5 + 8], r4
                    code.add(I.STR{ .rn = 5, .rt = 4, .imm12 = 8 });
                    // mov r4, caller_addr
                    code.add(I.MOV_IMM32.init(4, caller_addr));
                    // bx [r4]
                    code.add(I.BX{ .rm = 4 });
                },
                else => unreachable,
            }
        }

        fn createCaller(comptime handler: anytype, comptime signature: u64) FunctionOf(handler) {
            const HT = @TypeOf(handler);
            const FT = FunctionOf(handler);
            const f = @typeInfo(FT).Fn;
            const RT = f.return_type orelse @compileError("Handler must have a fixed return type");
            const cc = f.calling_convention;
            const ns = struct {
                var context_pos: ?usize = null;

                fn call(args: std.meta.ArgsTuple(FT)) RT {
                    const sp_address = switch (builtin.target.cpu.arch) {
                        .x86_64 => asm (""
                            : [ret] "={rsp}" (-> usize),
                        ),
                        .x86 => asm (""
                            : [ret] "={esp}" (-> usize),
                        ),
                        else => asm (""
                            : [ret] "={sp}" (-> usize),
                        ),
                    };
                    // look for context pointer in memory above the stack
                    const ptr: [*]usize = @ptrFromInt(sp_address - 1024);
                    const index = context_pos orelse search_result: {
                        var index: usize = 0;
                        while (index >= 0) {
                            const match = switch (@bitSizeOf(usize)) {
                                64 => ptr[index] == signature,
                                32 => ptr[index] == (signature & 0xffff_ffff) and ptr[index + 1] == (signature >> 32),
                                else => unreachable,
                            };
                            index += 1;
                            if (match) {
                                if (@bitSizeOf(usize) == 32) {
                                    index += 1;
                                }
                                // the context pointer is right below the signature (larger address)
                                context_pos = index;
                                break :search_result index;
                            }
                        }
                    };
                    const context_address = ptr[index];
                    var arg_tuple: std.meta.ArgsTuple(HT) = undefined;
                    inline for (args, 0..) |arg, i| {
                        arg_tuple[i] = arg;
                    }
                    // the last argument is the context pointer
                    arg_tuple[args.len] = @ptrFromInt(context_address);
                    return @call(.never_inline, handler, arg_tuple);
                }
            };
            return fn_transform.spreadArgs(ns.call, cc);
        }

        fn createSignature(_: anytype) u64 {
            // TODO: use a fixed constant for now
            return 0xbc51_10c3_592d_717e;
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

const Instruction = switch (builtin.target.cpu.arch) {
    .x86, .x86_64 => struct {
        pub const Opcode = enum(u8) {
            MOV = 0x89,
            NOP = 0x90,
            MOV_AX = 0xb8,
            JMP = 0xff,
            _,
        };
        pub const Prefix = enum(u8) {
            _,
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
        mod_rm: ?ModRM = null,
        sib: ?SIB = null,
        disp8: ?i8 = null,
        disp32: ?i32 = null,
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
    .riscv64 => void,
    .powerpc64le => void,
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

    pub fn add(self: *@This(), instr: anytype) void {
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
