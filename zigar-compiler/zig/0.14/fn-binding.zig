const std = @import("std");
const builtin = @import("builtin");
const fn_transform = @import("fn-transform.zig");
const expect = std.testing.expect;

usingnamespace fn_transform;

pub const BindingError = error{
    TooManyInstructions,
    PlaceholderNotFound,
};

pub fn executable() std.heap.GeneralPurposeAllocator(.{}) {
    return .{
        .backing_allocator = .{
            .ptr = undefined,
            .vtable = &ExecutablePageAllocator.vtable,
        },
    };
}

test "executable" {
    protect(false);
    var ea = executable();
    var allocator = ea.allocator();
    const memory = try allocator.alloc(u8, 256);
    allocator.free(memory);
    try expect(ea.detectLeaks() == false);
    protect(true);
}

pub fn Binding(comptime T: type, comptime TT: type) type {
    const FT = FnType(T);
    const CT = ContextType(TT);
    const BFT = BoundFunction(FT, CT);
    const arg_mapping = getArgumentMapping(FT, CT);
    const ctx_mapping = getContextMapping(FT, CT);
    const code_align = @alignOf(fn () void);
    const binding_signature: u64 = 0xef20_90b6_415d_2fe3;

    return extern struct {
        signature: u64 = binding_signature,
        size: usize,
        fn_address: usize,
        context_bytes: [@sizeOf(CT)]u8 align(@alignOf(CT)),
        code: [0]u8 align(code_align) = undefined,

        var code_len: ?usize = null;
        var self_offset: ?isize = null;

        pub fn bind(allocator: std.mem.Allocator, func: T, vars: TT) !*const BFT {
            const binding = try init(allocator, func, vars);
            return binding.function();
        }

        pub fn unbind(allocator: std.mem.Allocator, func: *const BFT) ?CT {
            if (fromFunction(func)) |self| {
                defer self.deinit(allocator);
                return self.context().*;
            } else {
                return null;
            }
        }

        pub fn init(allocator: std.mem.Allocator, func: T, vars: TT) !*@This() {
            protect(false);
            defer protect(true);
            const len = code_len orelse init: {
                // determine the code len by doing a dry-run of the encoding process
                const instrs = try getInstructions(0);
                var encoder: InstructionEncoder = .{};
                encoder.encode(&instrs);
                code_len = encoder.len;
                break :init encoder.len;
            };
            const instance_size = @offsetOf(@This(), "code") + len;
            const new_bytes = try allocator.alignedAlloc(u8, @alignOf(@This()), instance_size);
            const self: *@This() = @ptrCast(new_bytes);
            var ctx: CT = undefined;
            const fields = @typeInfo(CT).@"struct".fields;
            inline for (fields) |field| {
                @field(ctx, field.name) = @field(vars, field.name);
            }
            const fn_ptr = switch (@typeInfo(T)) {
                .@"fn" => &func,
                .pointer => func,
                else => unreachable,
            };
            self.* = .{
                .size = instance_size,
                .fn_address = @intFromPtr(fn_ptr),
                .context_bytes = std.mem.toBytes(ctx),
            };
            const self_address = @intFromPtr(self);
            const instrs = try getInstructions(self_address);
            const output_ptr = @as([*]u8, @ptrCast(&self.code));
            var encoder: InstructionEncoder = .{ .output = output_ptr[0..len] };
            encoder.encode(&instrs);
            invalidate(new_bytes);
            return self;
        }

        pub fn deinit(self: *@This(), allocator: std.mem.Allocator) void {
            protect(false);
            defer protect(true);
            self.signature = 0;
            // free memory using correct alignment to avoid warning
            const alignment = @alignOf(@This());
            const ST = []align(alignment) u8;
            const MT = [*]align(alignment) u8;
            const slice: ST = @as(MT, @ptrCast(self))[0..self.size];
            allocator.free(slice);
        }

        pub inline fn function(self: *const @This()) *const BFT {
            return @ptrCast(&self.code);
        }

        test "function" {
            const b: @This() = .{ .context_bytes = undefined, .fn_address = 0, .size = 0 };
            const func = b.function();
            try expect(@TypeOf(func) == *const BFT);
        }

        pub inline fn context(self: *const @This()) *const CT {
            return @ptrCast(&self.context_bytes);
        }

        test "context" {
            const b: @This() = .{ .context_bytes = undefined, .fn_address = 0, .size = 0 };
            const ctx = b.context();
            try expect(@TypeOf(ctx) == *const CT);
        }

        pub fn fromFunction(fn_ptr: *align(code_align) const anyopaque) ?*@This() {
            const code: *align(code_align) const [0]u8 = @ptrCast(fn_ptr);
            const ptr: *align(1) @This() = @fieldParentPtr("code", @constCast(code));
            if (!std.mem.isAligned(@intFromPtr(ptr), @alignOf(@This()))) return null;
            const self: *@This() = @alignCast(ptr);
            return if (self.signature == binding_signature) self else null;
        }

        test "fromFunction" {
            const b: @This() = .{ .context_bytes = undefined, .fn_address = 0, .size = 0 };
            const func = b.function();
            const ptr1 = fromFunction(func);
            try expect(ptr1 == &b);
            const ns = struct {
                fn hello() void {}
            };
            const ptr2 = fromFunction(&ns.hello);
            try expect(ptr2 == null);
        }

        fn getInstructions(self_address: usize) !return_type: {
            const count = switch (builtin.target.cpu.arch) {
                .x86_64 => 4,
                .aarch64 => 11,
                .riscv64 => 15,
                .powerpc64le => 19,
                .x86 => 4,
                .arm => 15,
                else => unreachable,
            };
            break :return_type [count]Instruction;
        } {
            const trampoline = getTrampoline();
            const trampoline_address = @intFromPtr(&trampoline);
            const self_address_offset = self_offset orelse init: {
                const offset = try findAddressOffset(&trampoline);
                self_offset = offset;
                break :init offset;
            };
            // std.debug.print("self_address = {d}\n", .{self_address});
            // std.debug.print("self_address_offset = {d}\n", .{self_address_offset});
            return switch (builtin.target.cpu.arch) {
                .x86_64 => .{
                    .{ // mov rax, self_address
                        .rex = .{},
                        .opcode = Instruction.Opcode.mov_ax_imm,
                        .imm64 = self_address,
                    },
                    .{ // mov [rsp + self_address_offset], rax
                        .rex = .{},
                        .opcode = Instruction.Opcode.mov_rm_r,
                        .mod_rm = .{ .rm = 4, .mod = 2, .reg = 0 },
                        .sib = .{ .base = 4, .index = 4 },
                        .disp32 = @truncate(self_address_offset),
                    },
                    .{ // mov rax, trampoline_address
                        .rex = .{},
                        .opcode = Instruction.Opcode.mov_ax_imm,
                        .imm64 = trampoline_address,
                    },
                    .{ // jmp [rax]
                        .rex = .{},
                        .opcode = Instruction.Opcode.jmp_rm,
                        .mod_rm = .{ .reg = 4, .mod = 3 },
                    },
                },
                // .aarch64 => .{
                //     .{ // sub x10, sp, signature_offset
                //         .sub = .{
                //             .rd = 10,
                //             .rn = 31,
                //             .imm12 = if (signature_offset < 0x1000) signature_offset else signature_offset >> 12,
                //             .shift = if (signature_offset < 0x1000) 0 else 1,
                //         },
                //     },
                //     .{ // ldr x9, [pc + 28] (signature)
                //         .ldr = .{ .rt = 9, .imm19 = 7 },
                //     },
                //     .{ // mvn x9, x9
                //         .mvn = .{ .rd = 9, .rm = 9 },
                //     },
                //     .{ // str [x10], x9
                //         .str = .{ .rn = 10, .rt = 9, .imm12 = 0 },
                //     },
                //     .{ // ldr x9, [pc + 24] (self_address)
                //         .ldr = .{ .rt = 9, .imm19 = 4 + 2 },
                //     },
                //     .{ // str [x10 + 8], x9
                //         .str = .{ .rn = 10, .rt = 9, .imm12 = 1 },
                //     },
                //     .{ // ldr x9, [pc + 24] (caller_address)
                //         .ldr = .{ .rt = 9, .imm19 = 2 + 4 },
                //     },
                //     .{ // br [x9]
                //         .br = .{ .rn = 9 },
                //     },
                //     .{ .literal = signature },
                //     .{ .literal = self_address },
                //     .{ .literal = caller_address },
                // },
                // .riscv64 => .{
                //     .{ // lui x5, signature_offset >> 12 + (sign adjustment)
                //         .lui = .{ .rd = 5, .imm20 = (signature_offset >> 12) + ((signature_offset >> 11) & 1) },
                //     },
                //     .{ // mv x5, (signature_offset & 0xff_ffff)
                //         .addi = .{ .rd = 5, .rs = 0, .imm12 = @bitCast(@as(u12, signature_offset & 0xfff)) },
                //     },
                //     .{ // sub x6, sp, x5
                //         .sub = .{ .rd = 31, .rs1 = 2, .rs2 = 5 },
                //     },
                //     .{ // auipc x7, pc
                //         .auipc = .{ .rd = 7 },
                //     },
                //     .{ // ld x5, [x7 + 32] (signature)
                //         .ld = .{ .rd = 5, .rs = 7, .imm12 = @sizeOf(u32) * 9 + @sizeOf(usize) * 0 },
                //     },
                //     .{
                //         .xor = .{ .rd = 5, .rs = 5, .imm12 = -1 },
                //     },
                //     .{ // sd [x6], x5
                //         .sd = .{ .rs1 = 31, .rs2 = 5, .imm12_4_0 = @sizeOf(usize) * 0 },
                //     },
                //     .{ // ld x5, [x7 + 40] (self_address)
                //         .ld = .{ .rd = 5, .rs = 7, .imm12 = @sizeOf(u32) * 9 + @sizeOf(usize) * 1 },
                //     },
                //     .{ // sd [x6 + 8], x5
                //         .sd = .{ .rs1 = 31, .rs2 = 5, .imm12_4_0 = @sizeOf(usize) * 1 },
                //     },
                //     .{ // ld x5, [x7 + 48] (caller_address)
                //         .ld = .{ .rd = 5, .rs = 7, .imm12 = @sizeOf(u32) * 9 + @sizeOf(usize) * 2 },
                //     },
                //     .{ // jmp [x5]
                //         .jalr = .{ .rd = 0, .rs = 5 },
                //     },
                //     .{ // nop
                //         .addi = .{ .rd = 0, .rs = 0, .imm12 = 0 },
                //     },
                //     .{ .literal = signature },
                //     .{ .literal = self_address },
                //     .{ .literal = caller_address },
                // },
                // .powerpc64le => .{
                //     .{ // lis r11, (code_address >> 48) & 0xffff
                //         .addi = .{
                //             .rt = 11,
                //             .ra = 0,
                //             .imm16 = @bitCast(@as(u16, @truncate((code_address >> 48) & 0xffff))),
                //         },
                //     },
                //     .{ // ori r11, r11, (code_address >> 32) & 0xffff
                //         .ori = .{
                //             .ra = 11,
                //             .rs = 11,
                //             .imm16 = @truncate((code_address >> 32) & 0xffff),
                //         },
                //     },
                //     .{ // rldic r11, r11, 32
                //         .rldic = .{
                //             .rs = 11,
                //             .ra = 11,
                //             .sh = 0,
                //             .sh2 = 1,
                //         },
                //     },
                //     .{ // oris r11, r11, (code_address >> 16) & 0xffff
                //         .oris = .{
                //             .ra = 11,
                //             .rs = 11,
                //             .imm16 = @truncate((code_address >> 16) & 0xffff),
                //         },
                //     },
                //     .{ // ori r11, r11, (code_address >> 0) & 0xffff
                //         .ori = .{
                //             .ra = 11,
                //             .rs = 11,
                //             .imm16 = @truncate((code_address >> 0) & 0xffff),
                //         },
                //     },
                //     .{ // ld r12, [r11 + 48] (signature)
                //         .ld = .{ .rt = 12, .ra = 11, .ds = 16 + 0 },
                //     },
                //     .{ // std [sp - 8], r11
                //         .std = .{ .ra = 1, .rs = 11, .ds = -2 },
                //     },
                //     .{ // lis r11. -1
                //         .addi = .{
                //             .rt = 11,
                //             .ra = 0,
                //             .imm16 = -1,
                //         },
                //     },
                //     .{ // xor r12, r12, r11
                //         .xor = .{ .ra = 12, .rs = 12, .rb = 11 },
                //     },
                //     .{ // std [sp - signature_offset], r12
                //         .std = .{ .ra = 1, .rs = 12, .ds = -signature_offset / 4 + 0 },
                //     },
                //     .{ // ld r11, [sp - 8]
                //         .ld = .{ .rt = 11, .ra = 1, .ds = -2 },
                //     },
                //     .{ // ld r12, [r11 + 56] (self_address)
                //         .ld = .{ .rt = 12, .ra = 11, .ds = 16 + 2 },
                //     },
                //     .{ // std [sp - signature_offset + 8], r12
                //         .std = .{ .ra = 1, .rs = 12, .ds = -signature_offset / 4 + 2 },
                //     },
                //     .{ // ld r12, [r11 + 64] (caller_address)
                //         .ld = .{ .rt = 12, .ra = 11, .ds = 16 + 4 },
                //     },
                //     .{ // mtctr r12
                //         .mtctr = .{ .rs = 12 },
                //     },
                //     .{ // bctrl
                //         .bctrl = .{},
                //     },
                //     .{ .literal = signature },
                //     .{ .literal = self_address },
                //     .{ .literal = caller_address },
                // },
                .x86 => .{
                    .{ // mov eax, self_address
                        .opcode = Instruction.Opcode.mov_ax_imm,
                        .imm32 = self_address,
                    },
                    .{ // mov [esp + self_address_offset], eax
                        .opcode = Instruction.Opcode.mov_rm_r,
                        .mod_rm = .{ .rm = 4, .mod = 2, .reg = 0 },
                        .sib = .{ .base = 4, .index = 4 },
                        .disp32 = @truncate(self_address_offset),
                    },
                    .{ // mov eax, trampoline_address
                        .opcode = Instruction.Opcode.mov_ax_imm,
                        .imm32 = trampoline_address,
                    },
                    .{ // jmp [eax]
                        .opcode = Instruction.Opcode.jmp_rm,
                        .mod_rm = .{ .reg = 4, .mod = 3 },
                    },
                },
                // .arm => .{
                //     .{ // sub r5, sp, signature_offset
                //         .sub = .{
                //             .rd = 5,
                //             .rn = 13,
                //             .imm12 = comptime Instruction.imm12(signature_offset),
                //         },
                //     },
                //     .{ // ldr r4, [pc + 32] (signature & 0xffffffff)
                //         .ldr = .{ .rt = 4, .rn = 15, .imm12 = comptime Instruction.imm12(@sizeOf(u32) * 8 + @sizeOf(u32) * 0) },
                //     },
                //     .{ // not r4, r4
                //         .mvn = .{ .rd = 4, .rm = 4 },
                //     },
                //     .{ // str [r5], r4
                //         .str = .{ .rn = 5, .rt = 4 },
                //     },
                //     .{ // ldr r4, [pc + ?] (signature >> 32)
                //         .ldr = .{ .rt = 4, .rn = 15, .imm12 = comptime Instruction.imm12(@sizeOf(u32) * 5 + @sizeOf(u32) * 1) },
                //     },
                //     .{ // not r4, r4
                //         .mvn = .{ .rd = 4, .rm = 4 },
                //     },
                //     .{ // str [r5 + 4], r4
                //         .str = .{ .rn = 5, .rt = 4, .imm12 = 4 },
                //     },
                //     .{ // ldr r4, [pc + ?] (self_address)
                //         .ldr = .{ .rt = 4, .rn = 15, .imm12 = comptime Instruction.imm12(@sizeOf(u32) * 2 + @sizeOf(u32) * 2) },
                //     },
                //     .{ // str [r5 + 8], r4
                //         .str = .{ .rn = 5, .rt = 4, .imm12 = 8 },
                //     },
                //     .{ // ldr r4, [pc + ?] (caller_addr)
                //         .ldr = .{ .rt = 4, .rn = 15, .imm12 = comptime Instruction.imm12(@sizeOf(u32) * 0 + @sizeOf(u32) * 3) },
                //     },
                //     .{ // bx [r4]
                //         .bx = .{ .rm = 4 },
                //     },
                //     .{ .literal = signature & 0xffff_ffff },
                //     .{ .literal = signature >> 32 },
                //     .{ .literal = self_address },
                //     .{ .literal = caller_address },
                // },
                else => .{},
            };
        }

        fn getTrampoline() BFT {
            const bf = @typeInfo(BFT).@"fn";
            const RT = bf.return_type.?;
            const cc = bf.calling_convention;
            const Self = @This();
            const ns = struct {
                inline fn call(bf_args: std.meta.ArgsTuple(BFT)) RT {
                    // disable runtime safety so self_address isn't written with 0xaa when optimize = Debug
                    @setRuntimeSafety(false);
                    // this variable will be set by dynamically generated code before the jump
                    var self_address: usize = undefined;
                    // insert nop x 3 so we can find the displacement for self_address in the instruction stream
                    const asm_code =
                        \\ nop
                        \\ nop
                        \\ nop
                    ;
                    switch (builtin.target.cpu.arch) {
                        .x86_64 => asm volatile (asm_code
                            :
                            : [arg1] "{rax}" (&self_address),
                        ),
                        .x86 => asm volatile (asm_code
                            :
                            : [arg1] "{eax}" (&self_address),
                        ),
                        else => unreachable,
                    }
                    // std.debug.print("self_address(r) = {d}\n", .{self_address});
                    const self: *const Self = @ptrFromInt(self_address);
                    std.debug.assert(self.signature == binding_signature);
                    var args: std.meta.ArgsTuple(FT) = undefined;
                    inline for (arg_mapping) |m| {
                        @field(args, m.dest) = @field(bf_args, m.src);
                    }
                    const ctx = self.context();
                    inline for (ctx_mapping) |m| {
                        @field(args, m.dest) = @field(ctx, m.src);
                    }
                    const fn_ptr: *const FT = @ptrFromInt(self.fn_address);
                    return @call(.never_inline, fn_ptr, args);
                }
            };
            return fn_transform.spreadArgs(ns.call, cc);
        }

        fn findAddressOffset(ptr: *const anyopaque) !isize {
            switch (builtin.target.cpu.arch) {
                .x86, .x86_64 => {
                    const instrs: [*]const u8 = @ptrCast(ptr);
                    for (0..65536) |i| {
                        if (instrs[i] == 0x90 and instrs[i + 1] == 0x90 and instrs[i + 2] == 0x90) {
                            for ([_]usize{ i - 3, i - 6 }) |j| { // disp is either i8 or i32
                                if (instrs[j] == @intFromEnum(Instruction.Opcode.lea_r_r)) {
                                    const mod_rm: Instruction.ModRM = @bitCast(instrs[j + 1]);
                                    if (mod_rm.rm == 5) { // EBP/RBP
                                        const disp: isize = switch (mod_rm.mod) {
                                            1 => std.mem.bytesToValue(i8, instrs[j + 2 .. j + 3]),
                                            2 => std.mem.bytesToValue(i32, instrs[j + 2 .. j + 6]),
                                            else => unreachable,
                                        };
                                        // account for EBP/RBP being pushed at function start
                                        return disp - @sizeOf(usize);
                                    }
                                }
                            }
                        }
                    }
                    return error.Unexpected;
                },
                else => unreachable,
            }
        }
    };
}

test "Binding (i64 x 3 + i64 x 1)" {
    const ns = struct {
        var called = false;

        fn add(a1: i64, a2: i64, a3: i64, a4: i64) callconv(.C) i64 {
            called = true;
            return a1 + a2 + a3 + a4;
        }
    };
    var number: i64 = 1234;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    try expect(@TypeOf(bf) == *const fn (i64, i64, i64) callconv(.C) i64);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum1 = bf(1, 2, 3);
    try expect(ns.called == true);
    try expect(sum1 == 1 + 2 + 3 + 1234);
}

test "Binding (i64 x 3 + *i64 x 1)" {
    const ns = struct {
        var called = false;

        fn add(a1: *i64, a2: i64, a3: i64, a4: i64) void {
            a1.* = a2 + a3 + a4;
        }
    };
    var number: i64 = undefined;
    const vars = .{&number};
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    bf(1, 2, 3);
    try expect(number == 1 + 2 + 3);
}

test "Binding ([no args] + i64 x 4)" {
    const ns = struct {
        var called = false;

        fn add(a1: i64, a2: i64, a3: i64, a4: i64) callconv(.C) i64 {
            called = true;
            return a1 + a2 + a3 + a4;
        }
    };
    var number1: i64 = 1;
    var number2: i64 = 2;
    var number3: i64 = 3;
    var number4: i64 = 4;
    _ = &number1;
    _ = &number2;
    _ = &number3;
    _ = &number4;
    const vars = .{ number1, number2, number3, number4 };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    try expect(@TypeOf(bf) == *const fn () callconv(.C) i64);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum1 = bf();
    try expect(ns.called == true);
    try expect(sum1 == 1 + 2 + 3 + 4);
}

test "Binding (i64 x 6 + i64 x 1)" {
    const ns = struct {
        var called = false;

        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64) callconv(.C) i64 {
            called = true;
            return a1 + a2 + a3 + a4 + a5 + a6 + a7;
        }
    };
    var number: i64 = 7;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7);
}

test "Binding (i64 x 9 + i64 x 1)" {
    const ns = struct {
        var called = false;

        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64) callconv(.C) i64 {
            called = true;
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10;
        }
    };
    var number: i64 = 10;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10);
}

test "Binding (i64 x 12 + i64 x 1)" {
    const ns = struct {
        var called = false;

        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64) callconv(.C) i64 {
            called = true;
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13;
        }
    };
    var number: i64 = 13;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13);
}

pub fn BoundFunction(comptime FT: type, comptime CT: type) type {
    const f = @typeInfo(FT).@"fn";
    const params = @typeInfo(FT).@"fn".params;
    const fields = @typeInfo(CT).@"struct".fields;
    const context_mapping = getContextMapping(FT, CT);
    var new_params: [params.len - fields.len]std.builtin.Type.Fn.Param = undefined;
    var index = 0;
    for (params, 0..) |param, number| {
        const name = std.fmt.comptimePrint("{d}", .{number});
        if (!isMapped(&context_mapping, name)) {
            new_params[index] = param;
            index += 1;
        }
    }
    var new_f = f;
    new_f.params = &new_params;
    return @Type(.{ .@"fn" = new_f });
}

test "BoundFunction" {
    const FT = fn (i8, i16, i32, i64) i64;
    const CT = struct {
        @"2": i32,
    };
    const BFT = BoundFunction(FT, CT);
    try expect(BFT == fn (i8, i16, i64) i64);
}

fn ContextType(comptime TT: type) type {
    const fields = switch (@typeInfo(TT)) {
        .@"struct" => |st| st.fields,
        else => @compileError("Not a tuple or struct"),
    };
    var new_fields: [fields.len]std.builtin.Type.StructField = undefined;
    var index: usize = 0;
    for (fields) |field| {
        if (field.type != @TypeOf(undefined)) {
            new_fields[index] = field;
            index += 1;
        }
    }
    return @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .fields = new_fields[0..index],
            .decls = &.{},
            .is_tuple = false,
        },
    });
}

test "ContextType" {
    var number: i32 = 5;
    _ = &number;
    const args1 = .{ number, 1 };
    const CT1 = ContextType(@TypeOf(args1));
    const fields1 = @typeInfo(CT1).@"struct".fields;
    try expect(fields1.len == 2);
    try expect(fields1[0].is_comptime == false);
    try expect(fields1[1].is_comptime == true);
    const args2 = .{ undefined, 123, undefined, 456 };
    const CT2 = ContextType(@TypeOf(args2));
    const fields2 = @typeInfo(CT2).@"struct".fields;
    try expect(fields2.len == 2);
    try expect(fields2[0].name[0] == '1');
    try expect(fields2[1].name[0] == '3');
}

const Mapping = struct {
    src: [:0]const u8,
    dest: [:0]const u8,
};

fn getArgumentMapping(comptime FT: type, comptime CT: type) return_type: {
    const params = @typeInfo(FT).@"fn".params;
    const fields = @typeInfo(CT).@"struct".fields;
    break :return_type [params.len - fields.len]Mapping;
} {
    const params = @typeInfo(FT).@"fn".params;
    const fields = @typeInfo(CT).@"struct".fields;
    const context_mapping = getContextMapping(FT, CT);
    var mapping: [params.len - fields.len]Mapping = undefined;
    var src_index = params.len - fields.len;
    var dest_index = params.len;
    while (dest_index >= 1) {
        dest_index -= 1;
        const dest_name = std.fmt.comptimePrint("{d}", .{dest_index});
        if (!isMapped(&context_mapping, dest_name)) {
            src_index -= 1;
            const src_name = std.fmt.comptimePrint("{d}", .{src_index});
            mapping[src_index] = .{ .src = src_name, .dest = dest_name };
        }
    }
    return mapping;
}

test "getArgumentMapping" {
    const FT = fn (i32, i32, i32, i32) i32;
    const CT = @TypeOf(.{
        .@"1" = @as(i32, 123),
    });
    const mapping = comptime getArgumentMapping(FT, CT);
    try expect(mapping[0].src[0] == '0');
    try expect(mapping[0].dest[0] == '0');
    try expect(mapping[1].src[0] == '1');
    try expect(mapping[1].dest[0] == '2');
    try expect(mapping[2].src[0] == '2');
    try expect(mapping[2].dest[0] == '3');
}

fn getContextMapping(comptime FT: type, comptime CT: type) return_type: {
    const fields = @typeInfo(CT).@"struct".fields;
    break :return_type [fields.len]Mapping;
} {
    const params = @typeInfo(FT).@"fn".params;
    const fields = @typeInfo(CT).@"struct".fields;
    var mapping: [fields.len]Mapping = undefined;
    for (fields, 0..) |field, index| {
        var number = std.fmt.parseInt(isize, field.name, 10) catch @compileError("Invalid argument specifier");
        if (number >= params.len) {
            @compileError("Index exceeds argument count");
        } else if (number < 0) {
            number = @as(i32, @intCast(params.len)) + number;
            if (number < 0) {
                @compileError("Negative index points to non-existing argument");
            }
        }
        const dest_name = std.fmt.comptimePrint("{d}", .{number});
        mapping[index] = .{ .src = field.name, .dest = dest_name };
    }
    return mapping;
}

test "getContextMapping" {
    const CT = @TypeOf(.{
        .@"1" = @as(i32, 123),
        .@"-1" = 456,
    });
    const FT = fn (i32, i32, i32, i32) i32;
    const mapping = comptime getContextMapping(FT, CT);
    try expect(mapping[0].src[0] == '1');
    try expect(mapping[0].dest[0] == '1');
    try expect(mapping[1].src[0] == '-');
    try expect(mapping[1].dest[0] == '3');
}

fn isMapped(mapping: []const Mapping, name: [:0]const u8) bool {
    return for (mapping) |m| {
        if (std.mem.orderZ(u8, m.dest, name) == .eq) {
            break true;
        }
    } else false;
}

test "isMapped" {
    const CT = @TypeOf(.{
        .@"1" = @as(i32, 123),
        .@"-1" = 456,
    });
    const FT = fn (i32, i32, i32, i32) i32;
    const mapping = comptime getContextMapping(FT, CT);
    try expect(isMapped(&mapping, "1") == true);
    try expect(isMapped(&mapping, "3") == true);
    try expect(isMapped(&mapping, "2") == false);
}

fn FnType(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .@"fn" => T,
        .pointer => |pt| switch (@typeInfo(pt.child)) {
            .@"fn" => pt.child,
            else => @compileError("Not a function pointer"),
        },
        else => @compileError("Not a function"),
    };
}

test "FnType" {
    const ns = struct {
        fn foo(arg: i32) i32 {
            return arg;
        }
    };
    try expect(FnType(@TypeOf(ns.foo)) == fn (i32) i32);
    try expect(FnType(@TypeOf(&ns.foo)) == fn (i32) i32);
}

const Instruction = switch (builtin.target.cpu.arch) {
    .x86, .x86_64 => struct {
        pub const Opcode = enum(u8) {
            mov_rm_r = 0x89,
            lea_r_r = 0x8d,
            nop = 0x90,
            mov_ax_imm = 0xb8,
            calc_rm = 0xf7,
            jmp_rm = 0xff,
            _,
        };
        pub const Prefix = enum(u8) {
            _,
        };

        pub const REX = packed struct {
            b: u1 = 0,
            x: u1 = 0,
            r: u1 = 0,
            w: u1 = 1,
            pat: u4 = 4,
        };
        pub const ModRM = packed struct {
            rm: u3 = 0,
            reg: u3 = 0,
            mod: u2 = 0,
        };
        pub const SIB = packed struct {
            base: u3 = 0,
            index: u3 = 0,
            scale: u2 = 0,
        };

        prefix: ?Prefix = null,
        rex: ?REX = null,
        opcode: Opcode = .nop,
        mod_rm: ?ModRM = null,
        sib: ?SIB = null,
        disp8: ?i8 = null,
        disp32: ?i32 = null,
        imm8: ?u8 = null,
        imm32: ?u32 = null,
        imm64: ?u64 = null,
    },
    .aarch64 => union(enum) {
        movz: packed struct(u32) {
            rd: u5,
            imm16: u16,
            hw: u2,
            opc: u9 = 0x1a5,
        },
        sub: packed struct(u32) {
            rd: u5,
            rn: u5,
            imm12: u12,
            shift: u1 = 0,
            opc: u9 = 0x162,
        },
        mvn: packed struct(u32) {
            rd: u5,
            rn: u5 = 0x1f,
            imm6: u6 = 0,
            rm: u5,
            _: u1 = 1,
            shift: u2 = 0,
            opc: u8 = 0xaa,
        },
        ldr: packed struct(u32) {
            rt: u5,
            imm19: u19,
            opc: u8 = 0x58,
        },
        str: packed struct(u32) {
            rt: u5,
            rn: u5,
            imm12: u12 = 0,
            opc: u10 = 0x3e4,
        },
        br: packed struct(u32) {
            rm: u5 = 0,
            rn: u5,
            opc: u22 = 0x35_87c0,
        },
        nop: packed struct(u32) {
            opc: u32 = 0xd503_201f,
        },
        literal: usize,
    },
    .riscv64 => union(enum) {
        lui: packed struct(u32) {
            opc: u7 = 0x37,
            rd: u5,
            imm20: i20 = 0,
        },
        auipc: packed struct(u32) {
            opc: u7 = 0x17,
            rd: u5,
            imm20: i20 = 0,
        },
        ld: packed struct(u32) {
            opc: u7 = 0x3,
            rd: u5,
            func: u3 = 0x3,
            rs: u5,
            imm12: i12 = 0,
        },
        sd: packed struct(u32) {
            opc: u7 = 0x23,
            imm12_4_0: u5 = 0,
            func: u3 = 0x3,
            rs1: u5,
            rs2: u5,
            imm12_11_5: i7 = 0,
        },
        xor: packed struct(u32) {
            opc: u7 = 0x13,
            rs: u5,
            func: u3 = 4,
            rd: u5,
            imm12: i12,
        },
        sub: packed struct(u32) {
            opc: u7 = 0x33,
            rd: u5,
            func: u3 = 0,
            rs1: u5,
            rs2: u5,
            offset_11_5: u7 = 0x20,
        },
        jalr: packed struct(u32) {
            opc: u7 = 0x67,
            rd: u5,
            func: u3 = 0,
            rs: u5,
            imm12: i12 = 0,
        },
        addi: packed struct(u32) {
            opc: u7 = 0x13,
            rs: u5,
            func: u3 = 0,
            rd: u5,
            imm12: i12 = 0,
        },
        literal: usize,
    },
    .powerpc64le => union(enum) {
        addi: packed struct(u32) {
            imm16: i16,
            ra: u5,
            rt: u5,
            opc: u6 = 0x0e,
        },
        ori: packed struct(u32) {
            imm16: u16,
            ra: u5,
            rs: u5,
            opc: u6 = 0x18,
        },
        oris: packed struct(u32) {
            imm16: u16,
            ra: u5,
            rs: u5,
            opc: u6 = 0x19,
        },
        rldic: packed struct(u32) {
            rc: u1 = 0,
            sh2: u1,
            _: u3 = 2,
            mb: u6 = 0,
            sh: u5,
            ra: u5,
            rs: u5,
            opc: u6 = 0x1e,
        },
        ld: packed struct {
            _: u2 = 0,
            ds: i14 = 0,
            ra: u5,
            rt: u5,
            opc: u6 = 0x3a,
        },
        xor: packed struct(u32) {
            rc: u1 = 0,
            func: u10 = 316,
            rb: u5,
            ra: u5,
            rs: u5,
            opc: u6 = 0x1f,
        },
        std: packed struct {
            _: u2 = 0,
            ds: i14 = 0,
            ra: u5,
            rs: u5,
            opc: u6 = 0x3e,
        },
        mtctr: packed struct(u32) {
            _: u1 = 0,
            func: u10 = 467,
            spr: u10 = 0x120,
            rs: u5,
            opc: u6 = 0x1f,
        },
        bctrl: packed struct(u32) {
            lk: u1 = 0,
            func: u10 = 528,
            bh: u2 = 0,
            _: u3 = 0,
            bi: u5 = 0,
            bo: u5 = 0x14,
            opc: u6 = 0x13,
        },
        literal: usize,
    },
    .arm => union(enum) {
        ldr: packed struct(u32) {
            imm12: u12,
            rt: u4,
            rn: u4,
            opc: u8 = 0x59,
            _: u4 = 0,
        },
        sub: packed struct(u32) {
            imm12: u12,
            rd: u4,
            rn: u4,
            opc: u8 = 0x24,
            _: u4 = 0,
        },
        mvn: packed struct(u32) {
            rm: u4,
            ___: u1 = 0,
            type: u2 = 0,
            imm5: u5 = 0,
            rd: u4,
            __: u4 = 0,
            opc: u8 = 0x1e,
            _: u4 = 0,
        },
        str: packed struct(u32) {
            imm12: u12 = 0,
            rt: u4,
            rn: u4,
            opc: u8 = 0x58,
            _: u4 = 0,
        },
        bx: packed struct(u32) {
            rm: u4,
            flags: u4 = 0x1,
            imm12: u12 = 0xfff,
            opc: u8 = 0x12,
            _: u4 = 0,
        },
        nop: packed struct(u32) {
            _____: u8 = 0,
            ____: u4 = 0,
            ___: u4 = 0xf,
            __: u4 = 0,
            opc: u8 = 0x32,
            _: u4 = 0,
        },
        literal: usize,

        fn imm12(comptime value: u32) u12 {
            comptime {
                var r: u32 = 0;
                var v: u32 = value;
                // keep rotating left, attaching overflow on the right side, until v fits an 8-bit int
                while (v & ~@as(u32, 0xff) != 0) {
                    v = (v << 2) | (v >> 30);
                    r += 1;
                    if (r > 15) {
                        @compileError(std.fmt.comptimePrint("Cannot encode value as imm12: {d}", .{value}));
                    }
                }
                return r << 8 | v;
            }
        }
    },
    else => void,
};

const InstructionEncoder = struct {
    output: ?[]u8 = null,
    len: usize = 0,

    pub fn encode(self: *@This(), instrs: []const Instruction) void {
        for (instrs) |instr| {
            self.add(instr);
        }
    }

    fn add(self: *@This(), instr: anytype) void {
        switch (@typeInfo(@TypeOf(instr))) {
            .@"struct" => |st| {
                if (st.layout == .@"packed") {
                    self.write(instr);
                } else {
                    inline for (st.fields) |field| {
                        self.add(@field(instr, field.name));
                    }
                }
            },
            .@"union" => |un| {
                const Tag = un.tag_type orelse @compileError("Cannot handle untagged union");
                const tag: Tag = instr;
                inline for (un.fields) |field| {
                    if (tag == @field(Tag, field.name)) {
                        self.add(@field(instr, field.name));
                        break;
                    }
                }
            },
            .array => for (instr) |element| self.add(element),
            .pointer => |pt| {
                switch (pt.size) {
                    .Slice => for (instr) |element| self.add(element),
                    else => @compileError("Cannot handle non-slice pointers"),
                }
            },
            .optional => if (instr) |value| self.add(value),
            .@"enum" => self.add(@intFromEnum(instr)),
            .int, .float, .bool => self.write(instr),
            else => @compileError("Cannot handle " ++ @typeName(@TypeOf(instr))),
        }
    }

    test "add" {
        var bytes: [32]u8 = undefined;
        var encoder: InstructionEncoder = .{ .output = &bytes };
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
        // get size of struct without alignment padding
        const size = @bitSizeOf(T) / 8;
        if (self.output) |buffer| {
            const bytes = std.mem.toBytes(instr);
            if (self.len + size <= buffer.len) {
                @memcpy(buffer[self.len .. self.len + size], bytes[0..size]);
            }
        }
        self.len += size;
    }

    test "write" {
        var bytes: [32]u8 = undefined;
        var encoder: InstructionEncoder = .{ .output = &bytes };
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

test "InstructionEncoder" {
    _ = InstructionEncoder;
}

const assert = std.debug.assert;
const maxInt = std.math.maxInt;
const mem = std.mem;
const native_os = builtin.os.tag;
const windows = std.os.windows;
const posix = std.posix;
const page_size_min = std.heap.page_size_min;

pub const ExecutablePageAllocator = struct {
    const vtable: std.mem.Allocator.VTable = .{
        .alloc = alloc,
        .remap = std.heap.PageAllocator.vtable.remap,
        .resize = std.heap.PageAllocator.vtable.resize,
        .free = std.heap.PageAllocator.vtable.free,
    };

    pub fn map(n: usize, alignment: mem.Alignment) ?[*]u8 {
        const page_size = std.heap.pageSize();
        if (n >= maxInt(usize) - page_size) return null;
        const alignment_bytes = alignment.toByteUnits();

        if (native_os == .windows) {
            // According to official documentation, VirtualAlloc aligns to page
            // boundary, however, empirically it reserves pages on a 64K boundary.
            // Since it is very likely the requested alignment will be honored,
            // this logic first tries a call with exactly the size requested,
            // before falling back to the loop below.
            // https://devblogs.microsoft.com/oldnewthing/?p=42223
            const addr = windows.VirtualAlloc(
                null,
                // VirtualAlloc will round the length to a multiple of page size.
                // "If the lpAddress parameter is NULL, this value is rounded up to
                // the next page boundary".
                n,
                windows.MEM_COMMIT | windows.MEM_RESERVE,
                windows.PAGE_EXECUTE_READWRITE,
            ) catch return null;

            if (mem.isAligned(@intFromPtr(addr), alignment_bytes))
                return @ptrCast(addr);

            // Fallback: reserve a range of memory large enough to find a
            // sufficiently aligned address, then free the entire range and
            // immediately allocate the desired subset. Another thread may have won
            // the race to map the target range, in which case a retry is needed.
            windows.VirtualFree(addr, 0, windows.MEM_RELEASE);

            const overalloc_len = n + alignment_bytes - page_size;
            const aligned_len = mem.alignForward(usize, n, page_size);

            while (true) {
                const reserved_addr = windows.VirtualAlloc(
                    null,
                    overalloc_len,
                    windows.MEM_RESERVE,
                    windows.PAGE_NOACCESS,
                ) catch return null;
                const aligned_addr = mem.alignForward(usize, @intFromPtr(reserved_addr), alignment_bytes);
                windows.VirtualFree(reserved_addr, 0, windows.MEM_RELEASE);
                const ptr = windows.VirtualAlloc(
                    @ptrFromInt(aligned_addr),
                    aligned_len,
                    windows.MEM_COMMIT | windows.MEM_RESERVE,
                    windows.PAGE_READWRITE,
                ) catch continue;
                return @ptrCast(ptr);
            }
        }

        const aligned_len = mem.alignForward(usize, n, page_size);
        const max_drop_len = alignment_bytes - @min(alignment_bytes, page_size);
        const overalloc_len = if (max_drop_len <= aligned_len - n)
            aligned_len
        else
            mem.alignForward(usize, aligned_len + max_drop_len, page_size);
        const hint = @atomicLoad(@TypeOf(std.heap.next_mmap_addr_hint), &std.heap.next_mmap_addr_hint, .unordered);
        var map_flags: std.posix.MAP = .{ .TYPE = .PRIVATE, .ANONYMOUS = true };
        if (builtin.target.os.tag.isDarwin()) {
            // set MAP_JIT
            var map_flags_u32: u32 = @bitCast(map_flags);
            map_flags_u32 |= 0x0800;
            map_flags = @bitCast(map_flags_u32);
        }
        const slice = posix.mmap(
            hint,
            overalloc_len,
            posix.PROT.READ | posix.PROT.WRITE | std.posix.PROT.EXEC,
            map_flags,
            -1,
            0,
        ) catch return null;
        const result_ptr = mem.alignPointer(slice.ptr, alignment_bytes) orelse return null;
        // Unmap the extra bytes that were only requested in order to guarantee
        // that the range of memory we were provided had a proper alignment in it
        // somewhere. The extra bytes could be at the beginning, or end, or both.
        const drop_len = result_ptr - slice.ptr;
        if (drop_len != 0) posix.munmap(slice[0..drop_len]);
        const remaining_len = overalloc_len - drop_len;
        if (remaining_len > aligned_len) posix.munmap(@alignCast(result_ptr[aligned_len..remaining_len]));
        const new_hint: [*]align(page_size_min) u8 = @alignCast(result_ptr + aligned_len);
        _ = @cmpxchgStrong(@TypeOf(std.heap.next_mmap_addr_hint), &std.heap.next_mmap_addr_hint, hint, new_hint, .monotonic, .monotonic);
        return result_ptr;
    }

    fn alloc(context: *anyopaque, n: usize, alignment: mem.Alignment, ra: usize) ?[*]u8 {
        _ = context;
        _ = ra;
        assert(n > 0);
        return map(n, alignment);
    }

    test "alloc" {
        const ptr: *anyopaque = @ptrFromInt(0x1_0000);
        const len = 16384;
        const alignment: mem.Alignment = .@"64";
        const result = alloc(ptr, len, alignment, 0);
        try expect(result != null);
    }
};

test "ExecutablePageAllocator" {
    _ = ExecutablePageAllocator;
}

fn protect(state: bool) void {
    if (builtin.target.os.tag.isDarwin()) {
        const c = @cImport({
            @cInclude("pthread.h");
        });
        c.pthread_jit_write_protect_np(if (state) 1 else 0);
    }
}

fn invalidate(slice: []u8) void {
    if (builtin.target.os.tag.isDarwin()) {
        const c = @cImport({
            @cInclude("libkern/OSCacheControl.h");
        });
        c.sys_icache_invalidate(slice.ptr, slice.len);
    }
}
