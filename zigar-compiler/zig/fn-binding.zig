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
    return std.heap.GeneralPurposeAllocator(.{}){
        .backing_allocator = .{
            .ptr = undefined,
            .vtable = &ExecutablePageAllocator.vtable,
        },
    };
}

test "executable" {
    var gpa = executable();
    var allocator = gpa.allocator();
    try expect(@TypeOf(gpa) == std.heap.GeneralPurposeAllocator(.{}));
    const memory = try allocator.alloc(u8, 256);
    allocator.free(memory);
}

pub fn Binding(comptime T: type, comptime TT: type) type {
    const FT = FnType(T);
    const CT = ContextType(TT);
    const BFT = BoundFunction(FT, CT);
    const arg_mapping = getArgumentMapping(FT, CT);
    const ctx_mapping = getContextMapping(FT, CT);
    const code_align = @alignOf(fn () void);
    const binding_signature: u64 = 0xef20_90b6_415d_2fe3;
    const context_placeholder: usize = switch (@bitSizeOf(usize)) {
        32 => 0xbaad_beef,
        // high word of 64 bit signature needs to be odd for PowerPC,
        // in order to force the RLDIC instruction to use a shift of 32
        64 => 0xdead_beef_baad_f00d,
        else => unreachable,
    };
    const fn_placeholder: usize = switch (@bitSizeOf(usize)) {
        32 => 0xbabe_feed,
        64 => 0xbabe_feed_decaf_ee1,
        else => unreachable,
    };

    return extern struct {
        signature: u64 = binding_signature,
        size: usize,
        context_bytes: [@sizeOf(CT)]u8 align(@alignOf(CT)),
        code: [0]u8 align(code_align) = undefined,

        pub fn bind(allocator: std.mem.Allocator, func: T, vars: TT) !*const BFT {
            const binding = try init(allocator, func, vars);
            return binding.function();
        }

        pub fn unbind(allocator: std.mem.Allocator, func: *const BFT) void {
            if (fromFunction(func)) |self| {
                self.deinit(allocator);
            }
        }

        pub fn init(allocator: std.mem.Allocator, func: T, vars: TT) !*@This() {
            const code_ptr = getTemplate();
            var buffer: [1024]Instruction = undefined;
            var decoder: InstructionDecoder = .{};
            var instr_count = decoder.decode(code_ptr, &buffer);
            if (instr_count > buffer.len) {
                return BindingError.TooManyInstructions;
            }
            var instrs = buffer[0..instr_count];
            const max_jmp: usize = result: {
                // look for backward jumps
                var max_offset: usize = 0;
                for (instrs) |instr| {
                    const pc_rel: ?isize = switch (builtin.target.cpu.arch) {
                        .x86, .x86_64 => switch (instr.op.code) {
                            .jmp_imm8 => @intCast(@as(i8, @bitCast(instr.op.imm8.?))),
                            else => null,
                        },
                        else => null,
                    };
                    if (pc_rel) |diff| {
                        if (diff > 0) {
                            const offset = instr.pc_offset + @as(usize, @intCast(diff));
                            max_offset = @max(max_offset, offset);
                        }
                    }
                }
                break :result max_offset;
            };
            if (max_jmp != 0) {
                const end_offset: usize = instrs[instrs.len - 1].pc_offset;
                if (max_jmp >= end_offset) {
                    const extra_code_ptr: [*]const u8 = @ptrCast(&code_ptr[end_offset]);
                    const extra_instr_count = decoder.decode(extra_code_ptr, buffer[instr_count..buffer.len]);
                    instr_count += extra_instr_count;
                    instrs = buffer[0..instr_count];
                }
            }
            // determine the code len by doing a dry-run of the encoding process
            var encoder: InstructionEncoder = .{};
            const code_len = encoder.encode(instrs, null);
            const code_len_aligned = std.mem.alignForward(usize, code_len, @alignOf(usize));
            const extra = switch (builtin.target.cpu.arch) {
                // extra space for constants
                .arm, .riscv64 => @sizeOf(usize) * 2,
                else => 0,
            };
            const instance_size = @offsetOf(@This(), "code") + code_len_aligned + extra;
            const new_bytes = try allocator.alignedAlloc(u8, @alignOf(@This()), instance_size);
            const self: *@This() = @ptrCast(new_bytes);
            var context: CT = undefined;
            const fields = @typeInfo(CT).Struct.fields;
            inline for (fields) |field| {
                @field(context, field.name) = @field(vars, field.name);
            }
            self.* = .{
                .size = instance_size,
                .context_bytes = std.mem.toBytes(context),
            };
            const fn_ptr = opaquePointerOf(func);
            // replace placeholders with actual address
            const context_address = @intFromPtr(&self.context_bytes);
            const fn_address = @intFromPtr(fn_ptr);
            var replacements: [2]struct {
                placeholder: usize,
                actual: usize,
                performed: bool = false,
            } = .{
                .{ .placeholder = context_placeholder, .actual = context_address },
                .{ .placeholder = fn_placeholder, .actual = fn_address },
            };
            for (instrs, 0..) |*instr, instr_index| {
                switch (builtin.target.cpu.arch) {
                    .x86_64 => {
                        if (instr.op.code == .mov_ax_imm) {
                            for (&replacements) |*r| {
                                if (instr.op.imm64 != null and instr.op.imm64.? == r.placeholder) {
                                    instr.op.imm64 = r.actual;
                                    r.performed = true;
                                    break;
                                }
                            }
                        }
                    },
                    .aarch64 => {
                        switch (instr.op) {
                            .movz => |*op| {
                                for (&replacements) |*r| {
                                    if (op.imm16 == (r.placeholder & @as(usize, 0xffff))) {
                                        op.imm16 = @truncate(r.actual & @as(usize, 0xffff));
                                        break;
                                    }
                                }
                            },
                            .movk => |*op| {
                                for (&replacements) |*r| {
                                    inline for (1..4) |n| {
                                        if (op.imm16 == ((r.placeholder >> (n * 16)) & @as(usize, 0xffff))) {
                                            op.imm16 = @truncate((r.actual >> (n * 16)) & @as(usize, 0xffff));
                                            r.performed = true;
                                            break;
                                        }
                                    }
                                }
                            },
                            else => {},
                        }
                    },
                    .riscv64 => {
                        switch (instr.op) {
                            .ld => |*op| if (instr_index > 0) {
                                const prev_instr = &instrs[instr_index - 1];
                                const prev_op = prev_instr.op;
                                if (prev_op == .lui and prev_op.lui.rd == op.rs) {
                                    const ptr_address: usize = @bitCast((@as(isize, prev_op.lui.imm20) << 12) + @as(isize, @intCast(op.imm12)));
                                    const ptr: *const usize = @ptrFromInt(ptr_address);
                                    const constant = ptr.*;
                                    const prev_instr_offset = if (instr_index > 1) instrs[instr_index - 2].pc_offset else 0;
                                    for (&replacements, 0..) |*r, index| {
                                        if (constant == r.placeholder) {
                                            // replace lui with auipc for pc-relative addressing
                                            prev_instr.op = .{ .auipc = .{ .imm20 = 0, .rd = prev_op.lui.rd } };
                                            // change offset so that it points to the correct literal at the end of code
                                            op.imm12 = @intCast(code_len_aligned - prev_instr_offset + index * @sizeOf(usize));
                                            r.performed = true;
                                            break;
                                        }
                                    }
                                }
                            },
                            else => {},
                        }
                    },
                    .powerpc64le => {
                        switch (instr.op) {
                            .addis => |*op| {
                                if (op.ra == 0) {
                                    // bits 63-48
                                    for (&replacements) |*r| {
                                        if (op.imm16 == ((r.placeholder >> 48) & @as(usize, 0xffff))) {
                                            op.imm16 = @truncate((r.actual >> 48) & @as(usize, 0xffff));
                                        }
                                    }
                                }
                            },
                            .oris => |*op| {
                                if (op.ra == op.rs) {
                                    // bits 31-16
                                    for (&replacements) |*r| {
                                        if (op.imm16 == ((r.placeholder >> 16) & @as(usize, 0xffff))) {
                                            op.imm16 = @truncate((r.actual >> 16) & @as(usize, 0xffff));
                                        }
                                    }
                                }
                            },
                            .ori => |*op| {
                                // bits 47-32, 15-0
                                outer: for (&replacements) |*r| {
                                    inline for (0..2) |n| {
                                        if (op.imm16 == ((r.placeholder >> (n * 32)) & @as(usize, 0xffff))) {
                                            op.imm16 = @truncate((r.actual >> (n * 32)) & @as(usize, 0xffff));
                                            r.performed = true;
                                            break :outer;
                                        }
                                    }
                                }
                            },
                            else => {},
                        }
                    },
                    .x86 => {
                        if (instr.op.code == .mov_ax_imm) {
                            for (&replacements) |*r| {
                                if (instr.op.imm32 != null and instr.op.imm32.? == r.placeholder) {
                                    instr.op.imm32 = r.actual;
                                    r.performed = true;
                                    break;
                                }
                            }
                        }
                    },
                    .arm => {
                        switch (instr.op) {
                            .ldr => |*op| {
                                if (op.rn == 15) {
                                    // ARM quirk: pc points to the instruction AFTER the next one, hence the +4
                                    const ptr: *const usize = @ptrCast(@alignCast(&code_ptr[instr.pc_offset + 4 + op.imm12]));
                                    const constant = ptr.*;
                                    for (&replacements, 0..) |*r, index| {
                                        if (constant == r.placeholder) {
                                            // change offset so that it points to the correct literal at the end of code
                                            op.imm12 = @intCast(code_len_aligned - instr.pc_offset - 4 + index * @sizeOf(usize));
                                            r.performed = true;
                                        }
                                    }
                                }
                            },
                            else => {},
                        }
                    },
                    else => unreachable,
                }
            }
            for (replacements) |r| {
                if (!r.performed) {
                    // return BindingError.PlaceholderNotFound;
                }
            }
            // encode the instructions (for real this time)
            const output_ptr = @as([*]u8, @ptrCast(&self.code));
            _ = encoder.encode(instrs, output_ptr[0..code_len]);
            if (extra > 0) {
                // add constants
                const literal_ptr = @as([*]usize, @ptrCast(@alignCast(&output_ptr[code_len_aligned])));
                literal_ptr[0] = context_address;
                literal_ptr[1] = fn_address;
            }
            return self;
        }

        pub fn deinit(self: *@This(), allocator: std.mem.Allocator) void {
            self.signature = 0;
            // free memory using correct alignment to avoid warning
            const alignment = @alignOf(@This());
            const ST = []align(alignment) u8;
            const MT = [*]align(alignment) u8;
            const ptr: ST = @as(MT, @ptrCast(self))[0..self.size];
            allocator.free(ptr);
        }

        pub fn function(self: *const @This()) *const BFT {
            return @ptrCast(&self.code);
        }

        test "function" {
            const b: @This() = .{ .context_bytes = undefined, .size = 0 };
            const func = b.function();
            try expect(@TypeOf(func) == *const BFT);
        }

        pub fn fromFunction(fn_ptr: *align(code_align) const anyopaque) ?*@This() {
            const code: *align(code_align) const [0]u8 = @ptrCast(fn_ptr);
            const self: *@This() = @alignCast(@fieldParentPtr("code", @constCast(code)));
            return if (self.signature == binding_signature) self else null;
        }

        test "fromFunction" {
            const b: @This() = .{ .context_bytes = undefined, .size = 0 };
            const func = b.function();
            const ptr1 = fromFunction(func);
            try expect(ptr1 == &b);
            const ns = struct {
                fn hello() void {}
            };
            const ptr2 = fromFunction(&ns.hello);
            try expect(ptr2 == null);
        }

        fn getTemplate() [*]const u8 {
            if (builtin.mode == .Debug) {
                // @compileError("This file cannot be compiled at optimize=Debug");
            }
            const caller = getTemplateFn();
            return @ptrCast(&caller);
        }

        test "getTemplate" {
            _ = getTemplate();
        }

        fn getTemplateFn() BFT {
            const f = @typeInfo(FT).Fn;
            const ns = struct {
                inline fn call(bf_args: std.meta.ArgsTuple(BFT)) f.return_type.? {
                    var args: std.meta.ArgsTuple(FT) = undefined;
                    inline for (arg_mapping) |m| {
                        @field(args, m.dest) = @field(bf_args, m.src);
                    }
                    const ctx_address = loadConstant(context_placeholder);
                    const ctx: *const CT = @ptrFromInt(ctx_address);
                    inline for (ctx_mapping) |m| {
                        @field(args, m.dest) = @field(ctx, m.src);
                    }
                    const fn_address = loadConstant(fn_placeholder);
                    const func: *const FT = @ptrFromInt(fn_address);
                    return @call(.never_inline, func, args);
                }
            };
            return fn_transform.spreadArgs(ns.call, f.calling_convention);
        }

        test "getTemplateFn" {
            const func = getTemplateFn();
            try expect(@TypeOf(func) == BFT);
        }

        inline fn loadConstant(comptime constant: usize) usize {
            // use inline assembly to guarantee the generation of expected op(s)
            return switch (builtin.target.cpu.arch) {
                .x86_64 => asm (""
                    : [ret] "={rax}" (-> usize),
                    : [constant] "{rax}" (constant),
                ),
                .aarch64 => asm (""
                    : [ret] "={x8}" (-> usize),
                    : [constant] "{x8}" (constant),
                ),
                .riscv64 => asm (""
                    : [ret] "={x5}" (-> usize),
                    : [constant] "{x5}" (constant),
                ),
                .powerpc64le => asm (""
                    : [ret] "={r11}" (-> usize),
                    : [constant] "{r11}" (constant),
                ),
                .x86 => asm (""
                    : [ret] "={eax}" (-> usize),
                    : [constant] "{eax}" (constant),
                ),
                .arm => asm (""
                    : [ret] "={r0}" (-> usize),
                    : [constant] "{r0}" (constant),
                ),
                else => unreachable,
            };
        }
    };
}

test "Binding (basic)" {
    const ns1 = struct {
        var called = false;

        fn add(a1: i64, a2: i64, a3: i64, a4: i64) callconv(.C) i64 {
            called = true;
            return a1 + a2 + a3 + a4;
        }
    };
    var number: i64 = 1234;
    const vars1 = .{ .@"-1" = number };
    const Binding1 = Binding(@TypeOf(ns1.add), @TypeOf(vars1));
    var gpa = executable();
    const bf1 = try Binding1.bind(gpa.allocator(), ns1.add, vars1);
    try expect(@TypeOf(bf1) == *const fn (i64, i64, i64) callconv(.C) i64);
    defer Binding1.unbind(gpa.allocator(), bf1);
    const sum1 = bf1(1, 2, 3);
    try expect(ns1.called == true);
    try expect(sum1 == 1 + 2 + 3 + 1234);
    _ = &number;
    const ns2 = struct {
        var called = false;

        fn add(a1: *i64, a2: i64, a3: i64, a4: i64) void {
            a1.* = a2 + a3 + a4;
        }
    };
    const vars2 = .{&number};
    const Binding2 = Binding(@TypeOf(ns2.add), @TypeOf(vars2));
    const bf2 = try Binding2.bind(gpa.allocator(), ns2.add, vars2);
    defer Binding2.unbind(gpa.allocator(), bf2);
    bf2(1, 2, 3);
    try expect(number == 1 + 2 + 3);
    try expect(bf1(1, 2, 3) == 1 + 2 + 3 + 1234);
}

test "Binding (stack usage)" {
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
    const Binding1 = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var gpa = executable();
    const bf = try Binding1.bind(gpa.allocator(), ns.add, vars);
    defer Binding1.unbind(gpa.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10);
}

pub fn BoundFunction(comptime FT: type, comptime CT: type) type {
    const f = @typeInfo(FT).Fn;
    const params = @typeInfo(FT).Fn.params;
    const fields = @typeInfo(CT).Struct.fields;
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
    return @Type(.{ .Fn = new_f });
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
        .Struct => |st| st.fields,
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
        .Struct = .{
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
    const fields1 = @typeInfo(CT1).Struct.fields;
    try expect(fields1.len == 2);
    try expect(fields1[0].is_comptime == false);
    try expect(fields1[1].is_comptime == true);
    const args2 = .{ undefined, 123, undefined, 456 };
    const CT2 = ContextType(@TypeOf(args2));
    const fields2 = @typeInfo(CT2).Struct.fields;
    try expect(fields2.len == 2);
    try expect(fields2[0].name[0] == '1');
    try expect(fields2[1].name[0] == '3');
}

const Mapping = struct {
    src: [:0]const u8,
    dest: [:0]const u8,
};

fn getArgumentMapping(comptime FT: type, comptime CT: type) return_type: {
    const params = @typeInfo(FT).Fn.params;
    const fields = @typeInfo(CT).Struct.fields;
    break :return_type [params.len - fields.len]Mapping;
} {
    const params = @typeInfo(FT).Fn.params;
    const fields = @typeInfo(CT).Struct.fields;
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
    const fields = @typeInfo(CT).Struct.fields;
    break :return_type [fields.len]Mapping;
} {
    const params = @typeInfo(FT).Fn.params;
    const fields = @typeInfo(CT).Struct.fields;
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
        .Fn => T,
        .Pointer => |pt| switch (@typeInfo(pt.child)) {
            .Fn => pt.child,
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

fn opaquePointerOf(func: anytype) *const anyopaque {
    return switch (@typeInfo(@TypeOf(func))) {
        .Pointer => func,
        else => &func,
    };
}

test "opaquePointerOf" {
    const ns = struct {
        fn foo(arg: i32) i32 {
            return arg;
        }
    };
    try expect(opaquePointerOf(ns.foo) == @as(*const anyopaque, &ns.foo));
    try expect(opaquePointerOf(&ns.foo) == @as(*const anyopaque, &ns.foo));
}

const Instruction = struct {
    op: Op,
    pc_offset: usize,

    const Op = switch (builtin.target.cpu.arch) {
        .x86, .x86_64 => struct {
            pub const Code = enum(u16) {
                add_rm8_r8 = 0x00,
                add_ax_imm8 = 0x04,
                add_ax_imm32 = 0x05,
                or_ax_imm8 = 0x0c,
                or_ax_imm32 = 0x0d,
                push_ss = 0x16,
                pop_ss = 0x17,
                sub_rm_r = 0x28,
                sub_ax_imm8 = 0x2c,
                sub_ax_imm32 = 0x2d,
                xor_rm8_r8 = 0x30,
                xor_rm_r = 0x31,
                xor_r8_rm8 = 0x32,
                xor_r_rm = 0x33,
                cmp_rm8_r8 = 0x38,
                cmp_rm_r = 0x39,
                cmp_r8_rm8 = 0x3a,
                cmp_r_rm = 0x3b,
                cmp_al_imm8 = 0x3c,
                cmp_ax_imm32 = 0x3d,
                dec_ax = 0x48,
                dec_cx = 0x49,
                dec_dx = 0x4a,
                dec_bx = 0x4b,
                dec_sp = 0x4c,
                dec_bp = 0x4d,
                dec_si = 0x4e,
                dec_di = 0x4f,
                push_ax = 0x50,
                push_cx = 0x51,
                push_dx = 0x52,
                push_bx = 0x53,
                push_sp = 0x54,
                push_bp = 0x55,
                push_si = 0x56,
                push_di = 0x57,
                pop_ax = 0x58,
                pop_cx = 0x59,
                pop_dx = 0x5a,
                pop_bx = 0x5b,
                pop_sp = 0x5c,
                pop_bp = 0x5d,
                pop_si = 0x5e,
                pop_di = 0x5f,
                push_all = 0x60,
                pop_all = 0x61,
                arpl = 0x63,
                push_imm32 = 0x68,
                jo_imm8 = 0x70,
                jno_imm8 = 0x71,
                jb_imm8 = 0x72,
                jnb_imm8 = 0x73,
                jz_imm8 = 0x74,
                jnz_imm8 = 0x75,
                jbe_imm8 = 0x76,
                jnbe_imm8 = 0x77,
                js_imm8 = 0x78,
                jns_imm8 = 0x79,
                jp_imm8 = 0x7a,
                jnp_imm8 = 0x7b,
                jl_imm8 = 0x7c,
                jnl_imm8 = 0x7d,
                jle_imm8 = 0x7e,
                jnle_imm8 = 0x7f,
                add_rm_imm32 = 0x80,
                mux_rm_imm8 = 0x81,
                add_rm_imm8 = 0x83,
                xchg_rm_r = 0x87,
                mov_rm8_r8 = 0x88,
                mov_rm_r = 0x89,
                mov_r_m = 0x8b,
                lea_rm_r = 0x8d,
                nop = 0x90,
                xchg_cx_ax = 0x91,
                xchg_dx_ax = 0x92,
                xchg_bx_ax = 0x93,
                xchg_sp_ax = 0x94,
                xchg_bp_ax = 0x95,
                xchg_si_ax = 0x96,
                xchg_di_ax = 0x97,
                test_al_imm8 = 0xa8,
                test_ax_imm32 = 0xa9,
                mov_ax_imm8 = 0xb0,
                mov_cx_imm8 = 0xb1,
                mov_dx_imm8 = 0xb2,
                mov_bx_imm8 = 0xb3,
                mov_sp_imm8 = 0xb4,
                mov_bp_imm8 = 0xb5,
                mov_si_imm8 = 0xb6,
                mov_di_imm8 = 0xb7,
                mov_ax_imm = 0xb8,
                mov_cx_imm = 0xb9,
                mov_dx_imm = 0xba,
                mov_bx_imm = 0xbb,
                mov_sp_imm = 0xbc,
                mov_bp_imm = 0xbd,
                mov_si_imm = 0xbe,
                mov_di_imm = 0xbf,
                bw_rm_imm8 = 0xc1,
                enter_imm8 = 0xc8,
                leave = 0xc9,
                ret = 0xc3,
                mov_rm_imm32 = 0xc7,
                call_rel = 0xe8,
                jmp_rel = 0xe9,
                jmp_imm8 = 0xeb,
                clc = 0xf8,
                mux_rm = 0xff,
                hint_nop_rm = 0x0f1f,
                _,

                pub fn write(self: @This(), output: anytype) void {
                    const value = @intFromEnum(self);
                    if (@intFromEnum(self) <= 255) {
                        output.write(@as(u8, @intCast(value)));
                    } else {
                        output.write(@as(u8, @intCast(value & 0xff)));
                        output.write(@as(u8, @intCast(value >> 8)));
                    }
                }
            };
            pub const Prefix = enum(u8) {
                es = 0x26,
                cs = 0x2e,
                ss = 0x36,
                ds = 0x3e,
                fs = 0x64,
                gs = 0x65,
                os = 0x66,
                as = 0x67,
                f2 = 0xf2,
                f3 = 0xf3,
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

            prefix1: ?Prefix = null,
            prefix2: ?Prefix = null,
            prefix3: ?Prefix = null,
            prefix4: ?Prefix = null,
            rex: ?REX = null,
            code: Code = .nop,
            mod_rm: ?ModRM = null,
            sib: ?SIB = null,
            disp8: ?i8 = null,
            disp32: ?i32 = null,
            imm8: ?u8 = null,
            imm16: ?u16 = null,
            imm32: ?u32 = null,
            imm64: ?u64 = null,
        },
        .aarch64 => union(enum) {
            const MOVZ = packed struct(u32) {
                rd: u5,
                imm16: u16,
                hw: u2,
                opc: u9 = 0x1a5,
            };
            const MOVK = packed struct(u32) {
                rd: u5,
                imm16: u16,
                hw: u2,
                opc: u9 = 0x1e5,
            };
            const BR = packed struct(u32) {
                rm: u5 = 0,
                rn: u5,
                opc: u22 = 0x35_87c0,
            };
            const RET = packed struct(u32) {
                rm: u5 = 0,
                rn: u5,
                opc: u22 = 0x35_97c0,
            };
            const UNKNOWN = packed struct(u32) {
                bits: u32,
            };

            movz: MOVZ,
            movk: MOVK,
            br: BR,
            ret: RET,
            unknown: UNKNOWN,
        },
        .riscv64 => union(enum) {
            const LUI = packed struct(u32) {
                opc: u7 = 0x37,
                rd: u5,
                imm20: u20,
            };
            const AUIPC = packed struct(u32) {
                opc: u7 = 0x17,
                rd: u5,
                imm20: u20,
            };
            const LD = packed struct(u32) {
                opc: u7 = 0x3,
                rd: u5,
                func: u3 = 0x3,
                rs: u5,
                imm12: i12,
            };
            const RET = packed struct(u32) {
                opc: u7 = 0x67,
                rd: u5 = 0,
                func: u3 = 0,
                rs: u5 = 1,
                imm12: u12 = 0,
            };
            const JALR = packed struct(u32) {
                opc: u7 = 0x67,
                rd: u5,
                func: u3 = 0,
                rs: u5,
                imm12: u12 = 0,
            };
            const UNKNOWN = packed struct(u32) {
                opc_1_0: u2 = 0x3,
                opc_6_2: u5,
                bits: u25,
            };
            const C_LD = packed struct(u16) {
                opc: u2 = 0,
                rd: u3,
                uimm_7_6: u2,
                rs: u3,
                uimm_5_3: u3,
                func: u3 = 0x3,
            };
            const C_RET = packed struct(u16) {
                opc: u2 = 0x2,
                rs2: u5 = 0,
                rs: u5 = 1,
                func1: u1 = 0,
                func2: u3 = 0x6,
            };
            const C_JR = packed struct(u16) {
                opc: u2 = 0x2,
                rs2: u5 = 0,
                rs: u5,
                func1: u1 = 0,
                func2: u3 = 0x4,
            };
            const C_JALR = packed struct(u16) {
                opc: u2 = 0x2,
                rs2: u5 = 0,
                rs: u5,
                func1: u1 = 1,
                func2: u3 = 0x6,
            };
            const C_UNKNOWN = packed struct(u16) {
                bits: u16,
            };

            lui: LUI,
            auipc: AUIPC,
            ld: LD,
            ret: RET,
            jalr: JALR,
            unknown: UNKNOWN,
            c_ld: C_LD,
            c_jr: C_JR,
            c_jalr: C_JALR,
            c_ret: C_RET,
            c_unknown: C_UNKNOWN,
        },
        .powerpc64le => union(enum) {
            const ADDI = packed struct(u32) {
                imm16: u16,
                ra: u5,
                rt: u5,
                opc: u6 = 0x0e,
            };
            const ADDIS = packed struct(u32) {
                imm16: u16,
                ra: u5,
                rt: u5,
                opc: u6 = 0x0f,
            };
            const ORI = packed struct(u32) {
                imm16: u16,
                ra: u5,
                rs: u5,
                opc: u6 = 0x18,
            };
            const ORIS = packed struct(u32) {
                imm16: u16,
                ra: u5,
                rs: u5,
                opc: u6 = 0x19,
            };
            const RLDIC = packed struct(u32) {
                rc: u1,
                sh2: u1,
                _: u3 = 2,
                mb: u6,
                sh: u5,
                ra: u5,
                rs: u5,
                opc: u6 = 0x1e,
            };
            const MTCTR = packed struct(u32) {
                _: u1 = 0,
                func: u10 = 467,
                spr: u10 = 0x120,
                rs: u5,
                opc: u6 = 0x1f,
            };
            const BCTRL = packed struct(u32) {
                lk: u1 = 1,
                func: u10 = 528,
                bh: u2,
                _: u3,
                bi: u5,
                bo: u5,
                opc: u6 = 0x13,
            };
            const BLR = packed struct(u32) {
                lk: u1 = 0,
                func: u10 = 16,
                bh: u2,
                _: u3,
                bi: u5,
                bo: u5,
                opc: u6 = 0x13,
            };
            const UNKNOWN = packed struct(u32) {
                bits: u32,
            };

            addi: ADDI,
            addis: ADDIS,
            ori: ORI,
            oris: ORIS,
            rldic: RLDIC,
            mtctr: MTCTR,
            bctrl: BCTRL,
            blr: BLR,
            unknown: UNKNOWN,
        },
        .arm => union(enum) {
            const LDR = packed struct(u32) {
                imm12: u12,
                rt: u4,
                rn: u4,
                opc: u8 = 0x59,
                _: u4,
            };
            const PUSH = packed struct(u32) {
                reg_set: u16,
                opc: u12 = 0x92d,
                _: u4,
            };
            const POP = packed struct(u32) {
                reg_set: u16,
                opc: u12 = 0x8bd,
                _: u4,
            };
            const UNKNOWN = packed struct(u32) {
                bits: u32,
            };

            ldr: LDR,
            push: PUSH,
            pop: POP,
            unknown: UNKNOWN,
        },
        else => void,
    };
};

const InstructionDecoder = struct {
    pub fn decode(_: *@This(), bytes: [*]const u8, output: ?[]Instruction) usize {
        var len: usize = 0;
        switch (builtin.target.cpu.arch) {
            .x86, .x86_64 => {
                const Code = Instruction.Op.Code;
                // determine what classes a op belongs to based on its name
                // const mod_rm_codes, const imm8_codes, const imm32_codes, const imm_codes, const sz_codes =
                const codes_rel, const codes_mod_rm, const codes_imm8, const codes_imm32, const codes_imm = comptime result: {
                    @setEvalBranchQuota(10000);
                    const opcode_fields = @typeInfo(Code).Enum.fields;
                    var rel_list: [opcode_fields.len]Code = undefined;
                    var mod_rm_list: [opcode_fields.len]Code = undefined;
                    var imm8_list: [opcode_fields.len]Code = undefined;
                    var imm32_list: [opcode_fields.len]Code = undefined;
                    var imm_list: [opcode_fields.len]Code = undefined;
                    var mod_rm_len: usize = 0;
                    var imm8_len: usize = 0;
                    var imm32_len: usize = 0;
                    var imm_len: usize = 0;
                    var rel_len: usize = 0;
                    for (opcode_fields) |field| {
                        const opcode: Code = @enumFromInt(field.value);
                        if (std.mem.indexOf(u8, field.name, "_rel") != null) {
                            // uses a relative offset
                            rel_list[rel_len] = opcode;
                            rel_len += 1;
                        } else if (std.mem.indexOf(u8, field.name, "_r") != null) {
                            // uses a register/memory reference
                            mod_rm_list[mod_rm_len] = opcode;
                            mod_rm_len += 1;
                        }
                        if (std.mem.indexOf(u8, field.name, "_imm8") != null) {
                            // has an 8-bit immediate
                            imm8_list[imm8_len] = opcode;
                            imm8_len += 1;
                        } else if (std.mem.indexOf(u8, field.name, "_imm32") != null) {
                            // has an 32-bit immediate
                            imm32_list[imm32_len] = opcode;
                            imm32_len += 1;
                        } else if (std.mem.indexOf(u8, field.name, "_imm") != null) {
                            imm_list[imm_len] = opcode;
                            imm_len += 1;
                        }
                    }
                    var rel_array: [rel_len]Code = undefined;
                    var mod_rm_array: [mod_rm_len]Code = undefined;
                    var imm8_array: [imm8_len]Code = undefined;
                    var imm32_array: [imm32_len]Code = undefined;
                    var imm_array: [imm_len]Code = undefined;
                    @memcpy(&rel_array, rel_list[0..rel_len]);
                    @memcpy(&mod_rm_array, mod_rm_list[0..mod_rm_len]);
                    @memcpy(&imm8_array, imm8_list[0..imm8_len]);
                    @memcpy(&imm32_array, imm32_list[0..imm32_len]);
                    @memcpy(&imm_array, imm_list[0..imm_len]);
                    break :result .{
                        rel_array,
                        mod_rm_array,
                        imm8_array,
                        imm32_array,
                        imm_array,
                    };
                };

                var i: usize = 0;
                while (true) {
                    var op: Instruction.Op = .{};
                    // look for legacy prefixes
                    inline for (1..5) |num| {
                        if (std.meta.intToEnum(Instruction.Op.Prefix, bytes[i]) catch null) |prefix| {
                            const name = std.fmt.comptimePrint("prefix{d}", .{num});
                            @field(op, name) = prefix;
                            i += 1;
                        } else {
                            break;
                        }
                    }
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
                    op.code = result: {
                        var value: u16 = bytes[i];
                        i += 1;
                        if (value == 0x0f) {
                            value = (value << 8) | bytes[i];
                            i += 1;
                        }
                        break :result @enumFromInt(value);
                    };
                    var sib_present = false;
                    var disp_size: ?u8 = null;
                    if (std.mem.indexOfScalar(Code, &codes_mod_rm, op.code) != null) {
                        // decode ModR/M
                        const mod_rm: Instruction.Op.ModRM = @bitCast(bytes[i]);
                        i += 1;
                        if (mod_rm.mod == 2 or (mod_rm.mod == 0 and mod_rm.rm == 5)) {
                            disp_size = 32;
                        } else if (mod_rm.mod == 1) {
                            disp_size = 8;
                        }
                        sib_present = mod_rm.mod != 3 and mod_rm.rm == 4;
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
                    // copy 16-bit offset (if there's one)
                    if (op.code == .enter_imm8) {
                        op.imm16 = std.mem.bytesToValue(u16, bytes[i .. i + 2]);
                        i += 2;
                    }
                    // copy relative address
                    if (std.mem.indexOfScalar(Code, &codes_rel, op.code) != null) {
                        if (@bitSizeOf(usize) == 32) {
                            op.imm16 = std.mem.bytesToValue(u16, bytes[i .. i + 2]);
                            i += 2;
                        } else if (@bitSizeOf(usize) == 64) {
                            op.imm32 = std.mem.bytesToValue(u32, bytes[i .. i + 4]);
                            i += 4;
                        }
                    }
                    // copy immediate (if any)
                    if (std.mem.indexOfScalar(Code, &codes_imm8, op.code) != null) {
                        op.imm8 = bytes[i];
                        i += 1;
                    } else if (std.mem.indexOfScalar(Code, &codes_imm32, op.code) != null) {
                        op.imm32 = std.mem.bytesToValue(u32, bytes[i .. i + 4]);
                        i += 4;
                    } else if (std.mem.indexOfScalar(Code, &codes_imm, op.code) != null) {
                        if (op.rex != null and op.rex.?.w == 1) {
                            op.imm64 = std.mem.bytesToValue(u64, bytes[i .. i + 8]);
                            i += 8;
                        } else {
                            op.imm32 = std.mem.bytesToValue(u32, bytes[i .. i + 4]);
                            i += 4;
                        }
                    }
                    if (output) |buffer| {
                        if (len < buffer.len) {
                            buffer[len] = .{ .pc_offset = i, .op = op };
                        }
                    }
                    len += 1;
                    switch (op.code) {
                        .ret => break,
                        .mux_rm => switch (op.mod_rm.?.reg) {
                            0 => {}, // inc
                            1 => {}, // dec
                            2, 3 => {}, // call
                            4, 5 => break, // jmp
                            6 => {}, // push quad
                            else => {},
                        },
                        .jmp_imm8 => {
                            const offset: i8 = @bitCast(op.imm8.?);
                            if (offset < 0) {
                                if (i < @as(usize, @intCast(-offset))) {
                                    break;
                                }
                            }
                        },
                        else => {},
                    }
                }
            },
            .aarch64 => {
                const words: [*]const u32 = @ptrCast(@alignCast(bytes));
                var i: usize = 0;
                while (true) {
                    const Op = Instruction.Op;
                    const un = @typeInfo(Op).Union;
                    const op: Op = inline for (un.fields) |field| {
                        const specific_op: field.type = @bitCast(words[i]);
                        if (matchDefault(specific_op)) {
                            break @unionInit(Op, field.name, specific_op);
                        }
                    } else unreachable;
                    i += 1;
                    if (output) |buffer| {
                        if (len < buffer.len) {
                            buffer[len] = .{ .pc_offset = i * @sizeOf(u32), .op = op };
                        }
                    }
                    len += 1;
                    switch (op) {
                        .ret, .br => break,
                        else => {},
                    }
                }
            },
            .riscv64 => {
                var i: usize = 0;
                while (true) {
                    const Op = Instruction.Op;
                    const un = @typeInfo(Op).Union;
                    const op: Op, const op_size: usize = inline for (un.fields) |field| {
                        const specific_op_ptr: *align(2) const field.type = @alignCast(@ptrCast(&bytes[i]));
                        if (matchDefault(specific_op_ptr.*)) {
                            break .{ @unionInit(Op, field.name, specific_op_ptr.*), @sizeOf(field.type) };
                        }
                    } else unreachable;
                    i += op_size;
                    if (output) |buffer| {
                        if (len < buffer.len) {
                            buffer[len] = .{ .pc_offset = i, .op = op };
                        }
                    }
                    len += 1;
                    switch (op) {
                        inline .ret, .c_ret, .c_jr => break,
                        else => {},
                    }
                }
            },
            .powerpc64le => {
                const words: [*]const u32 = @ptrCast(@alignCast(bytes));
                var i: usize = 0;
                while (true) {
                    const Op = Instruction.Op;
                    const un = @typeInfo(Op).Union;
                    const op: Op = inline for (un.fields) |field| {
                        const specific_op: field.type = @bitCast(words[i]);
                        if (matchDefault(specific_op)) {
                            break @unionInit(Op, field.name, specific_op);
                        }
                    } else unreachable;
                    i += 1;
                    if (output) |buffer| {
                        if (len < buffer.len) {
                            buffer[len] = .{ .pc_offset = i * @sizeOf(u32), .op = op };
                        }
                    }
                    len += 1;
                    switch (op) {
                        .blr => break,
                        else => {},
                    }
                }
            },
            .arm => {
                const words: [*]const u32 = @ptrCast(@alignCast(bytes));
                var i: usize = 0;
                while (true) {
                    const Op = Instruction.Op;
                    const un = @typeInfo(Op).Union;
                    const op: Op = inline for (un.fields) |field| {
                        const specific_op: field.type = @bitCast(words[i]);
                        if (matchDefault(specific_op)) {
                            break @unionInit(Op, field.name, specific_op);
                        }
                    } else unreachable;
                    i += 1;
                    if (output) |buffer| {
                        if (len < buffer.len) {
                            buffer[len] = .{ .pc_offset = i * @sizeOf(u32), .op = op };
                        }
                    }
                    len += 1;
                    switch (op) {
                        .pop => break,
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
    output: ?[]u8 = null,
    len: usize = 0,

    pub fn encode(self: *@This(), instrs: []Instruction, output: ?[]u8) usize {
        self.output = output;
        self.len = 0;
        for (instrs) |instr| {
            self.add(instr.op);
        }
        return self.len;
    }

    fn add(self: *@This(), instr: anytype) void {
        const T = @TypeOf(instr);
        switch (@typeInfo(T)) {
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
                inline for (un.fields) |field| {
                    if (tag == @field(Tag, field.name)) {
                        self.add(@field(instr, field.name));
                        break;
                    }
                }
            },
            .Array => for (instr) |element| self.add(element),
            .Pointer => |pt| {
                switch (pt.size) {
                    .Slice => for (instr) |element| self.add(element),
                    else => @compileError("Cannot handle non-slice pointers"),
                }
            },
            .Optional => if (instr) |value| self.add(value),
            .Enum => {
                if (@hasDecl(T, "write")) {
                    instr.write(self);
                } else {
                    self.add(@intFromEnum(instr));
                }
            },
            .Int, .Float, .Bool => self.write(instr),
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

fn matchDefault(s: anytype) bool {
    const fields = switch (@typeInfo(@TypeOf(s))) {
        .Struct => |st| st.fields,
        else => @compileError("Not a struct"),
    };
    return inline for (fields) |field| {
        if (field.default_value) |opaque_ptr| {
            const default_ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
            if (@field(s, field.name) != default_ptr.*) {
                return false;
            }
        }
    } else true;
}

test "matchDefault" {
    const S = struct {
        number1: i32 = 123,
        number2: i32,
    };
    const s1: S = .{ .number2 = 456 };
    try expect(matchDefault(s1) == true);
    const s2: S = .{ .number1 = 100, .number2 = 456 };
    try expect(matchDefault(s2) == false);
}

const assert = std.debug.assert;
const maxInt = std.math.maxInt;
const mem = std.mem;
const native_os = builtin.os.tag;
const windows = std.os.windows;
const posix = std.posix;

pub const ExecutablePageAllocator = struct {
    const vtable: std.mem.Allocator.VTable = .{
        .alloc = alloc,
        .resize = std.heap.PageAllocator.vtable.resize,
        .free = std.heap.PageAllocator.vtable.free,
    };

    fn alloc(_: *anyopaque, n: usize, log2_align: u8, ra: usize) ?[*]u8 {
        _ = ra;
        _ = log2_align;
        assert(n > 0);
        if (n > maxInt(usize) - (mem.page_size - 1)) return null;

        if (native_os == .windows) {
            const addr = windows.VirtualAlloc(
                null,

                // VirtualAlloc will round the length to a multiple of page size.
                // VirtualAlloc docs: If the lpAddress parameter is NULL, this value is rounded up to the next page boundary
                n,

                windows.MEM_COMMIT | windows.MEM_RESERVE,
                windows.PAGE_EXECUTE_READWRITE,
            ) catch return null;
            return @ptrCast(addr);
        }

        const aligned_len = mem.alignForward(usize, n, mem.page_size);
        const hint = @atomicLoad(@TypeOf(std.heap.next_mmap_addr_hint), &std.heap.next_mmap_addr_hint, .unordered);
        const slice = posix.mmap(
            hint,
            aligned_len,
            posix.PROT.READ | posix.PROT.WRITE | std.posix.PROT.EXEC,
            .{ .TYPE = .PRIVATE, .ANONYMOUS = true },
            -1,
            0,
        ) catch return null;
        assert(mem.isAligned(@intFromPtr(slice.ptr), mem.page_size));
        const new_hint: [*]align(mem.page_size) u8 = @alignCast(slice.ptr + aligned_len);
        _ = @cmpxchgStrong(@TypeOf(std.heap.next_mmap_addr_hint), &std.heap.next_mmap_addr_hint, hint, new_hint, .monotonic, .monotonic);
        return slice.ptr;
    }
};
