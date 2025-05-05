const std = @import("std");
const builtin = @import("builtin");
const fn_transform = @import("fn-transform.zig");

const expect = std.testing.expect;
const expectEqualSlices = std.testing.expectEqualSlices;
const expectEqual = std.testing.expectEqual;

/// Create a binding using an user-provided allocator instead of the default.
///
/// The allocator should use an instance of ExecutablePageAllocator as its backing allocator.
pub fn create(allocator: std.mem.Allocator, func: anytype, vars: anytype) !*const BoundFn(@TypeOf(func), @TypeOf(vars)) {
    const binding = Binding(@TypeOf(func), @TypeOf(vars), null);
    return if (!@inComptime())
        binding.createRuntime(allocator, func, vars)
    else
        binding.getComptime(func, vars);
}

/// Create a binding with a different calling convention.
pub fn createWithCallConv(
    allocator: std.mem.Allocator,
    func: anytype,
    vars: anytype,
    comptime cc: std.builtin.CallingConvention,
) !*const BoundFnWithCallConv(@TypeOf(func), @TypeOf(vars), cc) {
    const binding = Binding(@TypeOf(func), @TypeOf(vars), cc);
    return if (!@inComptime())
        binding.createRuntime(allocator, func, vars)
    else
        binding.getComptime(func, vars);
}

/// Free a binding using an user-provided allocator instead of the default.
pub fn destroy(allocator: std.mem.Allocator, fn_ptr: *const anyopaque) void {
    const fn_addr = @intFromPtr(fn_ptr);
    if (fn_addr >= @sizeOf(Header) and std.mem.isAligned(fn_addr - @sizeOf(Header), @alignOf(Header))) {
        const header_ptr: *Header = @ptrFromInt(fn_addr - @sizeOf(Header));
        if (header_ptr.signature == Header.magic_number) {
            protect(false);
            defer protect(true);
            header_ptr.signature = 0;
            const binding_ptr: [*]u8 = @ptrCast(header_ptr);
            const alignment: std.mem.Alignment = @enumFromInt(@ctz(header_ptr.alignment));
            allocator.rawFree(binding_ptr[0..header_ptr.len], alignment, 0);
        }
    }
}

/// Obtain a pointer to the tuple holding variables bound to a function.
///
/// Before modifying the tuple, you need to call protect() to disable write protection and again
/// afterward to reenable it.
pub fn bound(comptime T: type, fn_ptr: *const anyopaque) ?*T {
    const fn_addr = @intFromPtr(fn_ptr);
    if (fn_addr >= @sizeOf(Header) and std.mem.isAligned(fn_addr - @sizeOf(Header), @alignOf(Header))) {
        const header_ptr: *Header = @ptrFromInt(fn_addr - @sizeOf(Header));
        if (header_ptr.signature == Header.magic_number) {
            return @ptrFromInt(fn_addr + header_ptr.ctx_offset);
        }
    }
    return null;
}

/// Create a new function by binding values to some (possibly all) of its arguments.
///
/// When called in a comptime context the binding will occur at comptime. That is to say,
/// you will get a normal function.
pub fn bind(func: anytype, vars: anytype) !*const BoundFn(@TypeOf(func), @TypeOf(vars)) {
    return create(exec_allocator, func, vars);
}

/// Create a new function with a different calling convention and bind values to its arguments.
pub fn bindWithCallConv(
    func: anytype,
    vars: anytype,
    comptime cc: std.builtin.CallingConvention,
) !*const BoundFnWithCallConv(@TypeOf(func), @TypeOf(vars), cc) {
    return createWithCallConv(exec_allocator, func, vars, cc);
}

/// Free memory associated with a function binding.
///
/// Nothing happens if the given pointer does not actually point at a bound function.
pub fn unbind(fn_ptr: *const anyopaque) void {
    destroy(exec_allocator, fn_ptr);
}

/// Bind a function at comptime.
pub fn define(func: anytype, vars: anytype) BoundFn(@TypeOf(func), @TypeOf(vars)) {
    if (!@inComptime()) @compileError("This function can only be called in comptime");
    return Binding(@TypeOf(func), @TypeOf(vars), null).getComptime(func, vars).*;
}

/// Bind a function at comptime with a different calling convention.
pub fn defineWithCallConv(
    func: anytype,
    vars: anytype,
    comptime cc: std.builtin.CallingConvention,
) BoundFn(@TypeOf(func), @TypeOf(vars)) {
    if (!@inComptime()) @compileError("This function can only be called in comptime");
    return Binding(@TypeOf(func), @TypeOf(vars), cc).getComptime(func, vars).*;
}

/// Create a function closure.
pub fn close(comptime T: type, vars: T) !*const BoundFn(@TypeOf(onlyFn(T)), std.meta.Tuple(&.{T})) {
    const func = onlyFn(T);
    return try bind(func, .{vars});
}

/// Create a function closure with a different calling convention.
pub fn closeWithCallConv(
    comptime T: type,
    vars: T,
    comptime cc: std.builtin.CallingConvention,
) !*const BoundFnWithCallConv(@TypeOf(onlyFn(T)), std.meta.Tuple(&.{T}), cc) {
    const func = onlyFn(T);
    return try bindWithCallConv(func, .{vars}, cc);
}

/// Enable or disable write protection on executable memory on platforms that has the feature.
pub fn protect(state: bool) void {
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

/// Return the only public function that exists in the given namespace.
pub fn onlyFn(comptime ns: type) find: {
    const T: type = for (std.meta.declarations(ns)) |decl| {
        const DT = @TypeOf(@field(ns, decl.name));
        if (@typeInfo(DT) == .@"fn") break DT;
    } else @TypeOf(undefined);
    break :find T;
} {
    var fn_name: ?[]const u8 = null;
    inline for (std.meta.declarations(ns)) |decl| {
        if (@typeInfo(@TypeOf(@field(ns, decl.name))) == .@"fn") {
            if (fn_name == null) fn_name = decl.name else {
                @compileError("Found multiple public functions in " ++ @typeName(ns));
            }
        }
    }
    return if (fn_name) |name| @field(ns, name) else {
        @compileError("Unable to find a public function in " ++ @typeName(ns));
    };
}

var exec_da: std.heap.DebugAllocator(.{}) = .{
    .backing_allocator = .{
        .ptr = undefined,
        .vtable = &ExecutablePageAllocator.vtable,
    },
};
const exec_allocator = exec_da.allocator();

const Header = extern struct {
    signature: u64 = magic_number,
    len: u32,
    alignment: u16,
    ctx_offset: u16,

    const magic_number: u64 = 0x380f_fc59_7bac_4e96;
};

fn Binding(comptime T: type, comptime CT: type, comptime cc: ?std.builtin.CallingConvention) type {
    const FT = FnType(T);
    const calling_convention: std.builtin.CallingConvention = cc orelse @typeInfo(FT).@"fn".calling_convention;
    const BFT = BoundFnWithCallConv(FT, CT, calling_convention);
    const AddressPosition = struct { offset: isize, stack_offset: isize, stack_align_mask: ?isize };
    const arg_mapping = getArgumentMapping(FT, CT);
    const ctx_mapping = getContextMapping(FT, CT);
    const BFArgsTuple = std.meta.ArgsTuple(BFT);
    const ArgsTuple = init: {
        // std.meta.ArgsTuple() fails when anytype is in the argument list
        const params = @typeInfo(FT).@"fn".params;
        var tuple_fields: [params.len]std.builtin.Type.StructField = undefined;
        inline for (params, 0..) |param, index| {
            const name = std.fmt.comptimePrint("{d}", .{index});
            const var_type: ?type, const var_def_ptr: ?*const anyopaque = find: {
                // find the variable bound to this param, if any
                inline for (ctx_mapping) |m| {
                    if (std.mem.eql(u8, name, m.dest)) {
                        // find the type (and default value) from the bound variable
                        const ctx_fields = @typeInfo(CT).@"struct".fields;
                        inline for (ctx_fields) |field| {
                            if (std.mem.eql(u8, m.src, field.name))
                                break :find .{ field.type, field.default_value_ptr };
                        }
                    }
                } else break :find .{ null, null };
            };
            tuple_fields[index] = .{
                .name = name,
                .type = var_type orelse (param.type orelse unreachable),
                .default_value_ptr = var_def_ptr,
                .is_comptime = var_def_ptr != null,
                .alignment = 0,
            };
        }
        break :init @Type(.{
            .@"struct" = .{
                .is_tuple = true,
                .layout = .auto,
                .decls = &.{},
                .fields = &tuple_fields,
            },
        });
    };

    return struct {
        var instr_encoded_len: ?usize = null;
        var address_pos: ?AddressPosition = null;

        pub fn createRuntime(allocator: std.mem.Allocator, func: anytype, vars: anytype) !*const BFT {
            // binding structure: [header][instructions][context][?fn_address]
            const instr_index = std.mem.alignForward(usize, @sizeOf(Header), @alignOf(fn () void));
            const instr_len = instr_encoded_len orelse init: {
                const len = try encodeInstructions(null, 0, func);
                instr_encoded_len = len;
                break :init len;
            };
            const ctx_index = std.mem.alignForward(usize, instr_index + instr_len, @alignOf(CT));
            const fn_address_index = std.mem.alignForward(usize, ctx_index + @sizeOf(CT), @alignOf(usize));
            const binding_len = switch (@typeInfo(@TypeOf(func))) {
                .@"fn" => ctx_index + @sizeOf(CT),
                .pointer => fn_address_index + @sizeOf(usize),
                else => unreachable,
            };
            const max_align = @max(@alignOf(Header), @alignOf(CT));
            const new_bytes = try allocator.alignedAlloc(u8, max_align, binding_len);
            const header_ptr: *Header = @ptrCast(@alignCast(new_bytes.ptr));
            const instr_slice: []u8 = new_bytes[instr_index .. instr_index + instr_len];
            const ctx_ptr: *CT = @ptrCast(@alignCast(new_bytes.ptr + ctx_index));
            const fn_address_ptr: *usize = @ptrCast(@alignCast(new_bytes.ptr + fn_address_index));
            protect(false);
            defer protect(true);
            header_ptr.* = .{
                .ctx_offset = @intCast(ctx_index - instr_index),
                .len = @intCast(binding_len),
                .alignment = @intCast(max_align),
            };
            const actual_instr_len = try encodeInstructions(instr_slice, @intFromPtr(ctx_ptr), func);
            assert(instr_len == actual_instr_len);
            ctx_ptr.* = vars;
            if (@typeInfo(@TypeOf(func)) == .pointer) fn_address_ptr.* = @intFromPtr(func);
            invalidate(new_bytes);
            return @ptrCast(@alignCast(instr_slice));
        }

        pub fn getComptime(comptime func: anytype, comptime vars: anytype) *const BFT {
            const ns = struct {
                inline fn call(bf_args: BFArgsTuple) @typeInfo(BFT).@"fn".return_type.? {
                    var args: ArgsTuple = undefined;
                    inline for (arg_mapping) |m| @field(args, m.dest) = @field(bf_args, m.src);
                    inline for (ctx_mapping) |m| @field(args, m.dest) = @field(vars, m.src);
                    return @call(.auto, func, args);
                }
            };
            return fn_transform.spreadArgs(ns.call, calling_convention);
        }

        fn getTrampoline(func: anytype) *const BFT {
            const ns = struct {
                inline fn call(bf_args: BFArgsTuple) @typeInfo(BFT).@"fn".return_type.? {
                    // disable runtime safety so target isn't written with 0xaa when optimize = Debug
                    @setRuntimeSafety(false);
                    // this variable will be set by dynamically generated code before it jumps here;
                    // a two-element array is used to so the compiler doesn't attempt to keep it in a register
                    var target: [2]usize = undefined;
                    // insert nop x 3 so we can find the displacement for target in the instruction stream
                    insertNOPs(&target);
                    const ctx_ptr: *const CT = @ptrFromInt(target[0]);
                    var args: ArgsTuple = undefined;
                    inline for (arg_mapping) |m| @field(args, m.dest) = @field(bf_args, m.src);
                    inline for (ctx_mapping) |m| @field(args, m.dest) = @field(ctx_ptr.*, m.src);
                    switch (@typeInfo(@TypeOf(func))) {
                        .@"fn" => {
                            return @call(.never_inline, uninline(func), args);
                        },
                        .pointer => {
                            // expect address of function to be stored immediately after the context
                            const fn_address_address = std.mem.alignForward(usize, target[0] + @sizeOf(CT), @alignOf(usize));
                            const fn_address_ptr: *const usize = @ptrFromInt(fn_address_address);
                            const fn_ptr: *const FT = @ptrFromInt(fn_address_ptr.*);
                            return @call(.never_inline, fn_ptr, args);
                        },
                        else => unreachable,
                    }
                }
            };
            return fn_transform.spreadArgs(ns.call, calling_convention);
        }

        inline fn insertNOPs(ptr: *const anyopaque) void {
            const asm_code =
                \\ nop
                \\ nop
                \\ nop
            ;
            switch (builtin.target.cpu.arch) {
                .x86_64 => asm volatile (asm_code
                    :
                    : [arg] "{rax}" (ptr),
                ),
                .aarch64 => asm volatile (asm_code
                    :
                    : [arg] "{x9}" (ptr),
                ),
                .riscv32, .riscv64 => asm volatile (asm_code
                    :
                    : [arg] "{x6}" (ptr),
                ),
                .powerpc, .powerpcle, .powerpc64, .powerpc64le => asm volatile (
                // actual nop's would get reordered for some reason despite the use of "volatile"
                    \\ li %r0, %r0
                    \\ li %r0, %r0
                    \\ li %r0, %r0        
                    :
                    : [arg] "{r11}" (ptr),
                ),
                .x86 => asm volatile (asm_code
                    :
                    : [arg] "{eax}" (ptr),
                ),
                .arm => asm volatile (asm_code
                    :
                    : [arg] "{r4}" (ptr),
                ),
                else => unreachable,
            }
        }

        fn encodeInstructions(output: ?[]u8, address: usize, func: anytype) !usize {
            const trampoline = getTrampoline(func);
            const trampoline_address = @intFromPtr(trampoline);
            // find the offset of target inside the trampoline function
            const pos = address_pos orelse init: {
                const offset = try findAddressPosition(trampoline);
                address_pos = offset;
                break :init offset;
            };
            var encoder: InstructionEncoder = .{ .output = output };
            switch (builtin.target.cpu.arch) {
                .x86_64 => {
                    // mov rax, address
                    encoder.encode(.{
                        .rex = .{},
                        .opcode = .@"mov ax imm32/64",
                        .imm64 = address,
                    });
                    if (pos.stack_align_mask) |mask| {
                        // mov r11, rsp
                        encoder.encode(.{
                            .rex = .{ .b = 1 },
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 3, .mod = 3, .reg = 4 },
                        });
                        // add rsp, pos.stack_offset
                        encoder.encode(.{
                            .rex = .{},
                            .opcode = .@"add/or/etc r/m imm32",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 0 },
                            .imm32 = @bitCast(@as(i32, @truncate(pos.stack_offset))),
                        });
                        // and rsp, mask
                        encoder.encode(.{
                            .rex = .{},
                            .opcode = .@"add/or/etc r/m imm8",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 4 },
                            .imm8 = @bitCast(@as(i8, @truncate(mask))),
                        });
                    }
                    // mov [rsp + po.offset], rax
                    if (pos.offset >= std.math.minInt(i8) and pos.offset <= std.math.maxInt(i8)) {
                        encoder.encode(.{
                            .rex = .{},
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 1, .reg = 0 },
                            .sib = .{ .base = 4, .index = 4, .scale = 0 },
                            .disp8 = @truncate(pos.offset),
                        });
                    } else {
                        encoder.encode(.{
                            .rex = .{},
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 2, .reg = 0 },
                            .sib = .{ .base = 4, .index = 4, .scale = 0 },
                            .disp32 = @truncate(pos.offset),
                        });
                    }
                    if (pos.stack_align_mask) |_| {
                        // mov rsp, r11
                        encoder.encode(.{
                            .rex = .{ .r = 1 },
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 3 },
                        });
                    }
                    // mov rax, trampoline_address
                    encoder.encode(.{
                        .rex = .{},
                        .opcode = .@"mov ax imm32/64",
                        .imm64 = trampoline_address,
                    });
                    // jmp [rax]
                    encoder.encode(.{
                        .rex = .{},
                        .opcode = .@"jmp/call/etc r/m",
                        .mod_rm = .{ .reg = 4, .mod = 3, .rm = 0 },
                    });
                },
                .aarch64 => {
                    if (pos.stack_align_mask) |mask| {
                        // sub x10, sp, -pos.stack_offset
                        encoder.encode(.{
                            .sub = .{
                                .rd = 10,
                                .rn = 31,
                                .imm12 = @truncate(@as(usize, @bitCast(-pos.stack_offset))),
                                .shift = 0,
                            },
                        });
                        // and x10, x10, mask
                        encoder.encode(.{
                            .@"and" = .{
                                .rd = 10,
                                .rn = 10,
                                .imm = @truncate(@as(usize, @bitCast(mask))),
                            },
                        });
                        // add x10, x10, pos.offset
                        encoder.encode(.{
                            .add = .{
                                .rd = 10,
                                .rn = 10,
                                .imm12 = @truncate(@as(usize, @bitCast(pos.offset))),
                                .shift = 0,
                            },
                        });
                    } else {
                        // sub x10, sp, -pos.offset
                        encoder.encode(.{
                            .sub = .{
                                .rd = 10,
                                .rn = 31,
                                .imm12 = @truncate(@as(usize, @bitCast(-pos.offset))),
                                .shift = 0,
                            },
                        });
                    }
                    // ldr x9, [pc + 16] (address)
                    encoder.encode(.{
                        .ldr = .{ .rt = 9, .imm19 = 4 },
                    });
                    // str [x10], x9
                    encoder.encode(.{
                        .str = .{ .rn = 10, .rt = 9, .imm12 = 0 },
                    });
                    // ldr x9, [pc + 16] (trampoline_address)
                    encoder.encode(.{
                        .ldr = .{ .rt = 9, .imm19 = 2 + 2 },
                    });
                    // br [x9]
                    encoder.encode(.{
                        .br = .{ .rn = 9 },
                    });
                    encoder.encode(.{ .literal = address });
                    encoder.encode(.{ .literal = trampoline_address });
                },
                .riscv64 => {
                    // lui x5, pos.offset >> 12 + (sign adjustment)
                    encoder.encode(.{
                        .lui = .{ .rd = 5, .imm20 = @truncate((pos.offset >> 12) + ((pos.offset >> 11) & 1)) },
                    });
                    // addi x5, (pos.offset & 0xfff)
                    encoder.encode(.{
                        .addi = .{ .rd = 5, .rs = 0, .imm12 = @truncate(pos.offset & 0xfff) },
                    });
                    // add x6, sp, x5
                    encoder.encode(.{
                        .add = .{ .rd = 6, .rs1 = 2, .rs2 = 5 },
                    });
                    // auipc x7, pc
                    encoder.encode(.{
                        .auipc = .{ .rd = 7, .imm20 = 0 },
                    });
                    // ld x5, [x7 + 20] (address)
                    encoder.encode(.{
                        .ld = .{ .rd = 5, .rs = 7, .imm12 = @sizeOf(u32) * 5 + @sizeOf(usize) * 0 },
                    });
                    // sd [x6], x5
                    encoder.encode(.{
                        .sd = .{ .rs1 = 6, .rs2 = 5, .imm12_4_0 = 0, .imm12_11_5 = 0 },
                    });
                    // ld x5, [x7 + 28] (trampoline_address)
                    encoder.encode(.{
                        .ld = .{ .rd = 5, .rs = 7, .imm12 = @sizeOf(u32) * 5 + @sizeOf(usize) * 1 },
                    });
                    // jmp [x5]
                    encoder.encode(.{
                        .jalr = .{ .rd = 0, .rs = 5, .imm12 = 0 },
                    });
                    encoder.encode(.{ .literal = address });
                    encoder.encode(.{ .literal = trampoline_address });
                },
                .powerpc64, .powerpc64le => {
                    const code_address: usize = if (output) |slice| @intFromPtr(slice.ptr) else 0;
                    const code_addr_63_48: u16 = @truncate((code_address >> 48) & 0xffff);
                    const code_addr_47_32: u16 = @truncate((code_address >> 32) & 0xffff);
                    const code_addr_31_16: u16 = @truncate((code_address >> 16) & 0xffff);
                    const code_addr_15_0: u16 = @truncate((code_address >> 0) & 0xffff);
                    // lis r11, code_addr_63_48
                    encoder.encode(.{
                        .addis = .{ .rt = 11, .ra = 0, .imm16 = @bitCast(code_addr_63_48) },
                    });
                    // ori r11, r11, code_addr_47_32
                    encoder.encode(.{
                        .ori = .{ .ra = 11, .rs = 11, .imm16 = @bitCast(code_addr_47_32) },
                    });
                    // rldic r11, r11, 32
                    encoder.encode(.{
                        .rldic = .{ .rs = 11, .ra = 11, .sh = 0, .sh2 = 1, .mb = 0, .rc = 0 },
                    });
                    // oris r11, r11, code_addr_31_16
                    encoder.encode(.{
                        .oris = .{ .ra = 11, .rs = 11, .imm16 = @bitCast(code_addr_31_16) },
                    });
                    // ori r11, r11, code_addr_15_0
                    encoder.encode(.{
                        .ori = .{ .ra = 11, .rs = 11, .imm16 = @bitCast(code_addr_15_0) },
                    });
                    // ld r12, [r11 + 40] (address)
                    encoder.encode(.{
                        .ld = .{ .rt = 12, .ra = 11, .ds = 40 >> 2 },
                    });
                    // std [sp + pos.offset], r12
                    encoder.encode(.{
                        .std = .{ .ra = 1, .rs = 12, .ds = @intCast(pos.offset >> 2) },
                    });
                    // ld r12, [r11 + 48] (trampoline_address)
                    encoder.encode(.{
                        .ld = .{ .rt = 12, .ra = 11, .ds = 48 >> 2 },
                    });
                    // mtctr r12
                    encoder.encode(.{
                        .mtctr = .{ .rs = 12 },
                    });
                    // bctrl
                    encoder.encode(.{
                        .bctrl = .{},
                    });
                    encoder.encode(.{ .literal = address });
                    encoder.encode(.{ .literal = trampoline_address });
                },
                .x86 => {
                    // mov eax, address
                    encoder.encode(.{
                        .opcode = .@"mov ax imm32/64",
                        .imm32 = address,
                    });
                    if (pos.stack_align_mask) |mask| {
                        // push ecx
                        encoder.encode(.{
                            .opcode = .@"push cx",
                        });
                        // mov ecx, esp
                        encoder.encode(.{
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 1, .mod = 3, .reg = 4 },
                        });
                        // add esp, pos.stack_offset + 4 (to offset the earlier push)
                        encoder.encode(.{
                            .opcode = .@"add/or/etc r/m imm32",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 0 },
                            .imm32 = @bitCast(@as(i32, @truncate(pos.stack_offset + 4))),
                        });
                        // and esp, mask
                        encoder.encode(.{
                            .opcode = .@"add/or/etc r/m imm8",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 4 },
                            .imm8 = @bitCast(@as(i8, @truncate(mask))),
                        });
                    }
                    // mov [esp + pos.offset], eax
                    if (pos.offset >= std.math.minInt(i8) and pos.offset <= std.math.maxInt(i8)) {
                        encoder.encode(.{
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 1, .reg = 0 },
                            .sib = .{ .base = 4, .index = 4, .scale = 0 },
                            .disp8 = @truncate(pos.offset),
                        });
                    } else {
                        encoder.encode(.{
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 2, .reg = 0 },
                            .sib = .{ .base = 4, .index = 4, .scale = 0 },
                            .disp32 = @truncate(pos.offset),
                        });
                    }
                    if (pos.stack_align_mask) |_| {
                        // mov esp, ecx
                        encoder.encode(.{
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 1 },
                        });
                        // pop ecx
                        encoder.encode(.{
                            .opcode = .@"pop cx",
                        });
                    }
                    // mov eax, trampoline_address
                    encoder.encode(.{
                        .opcode = .@"mov ax imm32/64",
                        .imm32 = trampoline_address,
                    });
                    // jmp [eax]
                    encoder.encode(.{
                        .opcode = .@"jmp/call/etc r/m",
                        .mod_rm = .{ .reg = 4, .mod = 3, .rm = 0 },
                    });
                },
                .arm => {
                    const total_amount: u32 = @abs(pos.offset);
                    const offset1 = Instruction.getNearestIMM12(total_amount);
                    const remainder = total_amount - Instruction.decodeIMM12(offset1);
                    const offset2 = Instruction.getNearestIMM12(remainder);
                    // sub r5, sp, offset1
                    encoder.encode(.{
                        .sub = .{
                            .rd = 5,
                            .rn = 13,
                            .imm12 = offset1,
                        },
                    });
                    if (offset2 > 0) {
                        // sub r5, sp, offset2
                        encoder.encode(.{
                            .sub = .{
                                .rd = 5,
                                .rn = 5,
                                .imm12 = offset2,
                            },
                        });
                    }
                    // ldr r4, [pc + 8] (address)
                    encoder.encode(.{
                        .ldr = .{ .rt = 4, .rn = 15, .imm12 = @sizeOf(u32) * 2 },
                    });
                    // str [r5], r4
                    encoder.encode(.{
                        .str = .{ .rn = 5, .rt = 4, .imm12 = 0 },
                    });
                    // ldr r4, [pc + 4] (trampoline_address)
                    encoder.encode(.{
                        .ldr = .{ .rt = 4, .rn = 15, .imm12 = @sizeOf(u32) },
                    });
                    // bx [r4]
                    encoder.encode(.{
                        .bx = .{ .rm = 4 },
                    });
                    encoder.encode(.{ .literal = address });
                    encoder.encode(.{ .literal = trampoline_address });
                },
                .riscv32 => {
                    // lui x5, pos.offset >> 12 + (sign adjustment)
                    encoder.encode(.{
                        .lui = .{ .rd = 5, .imm20 = @truncate((pos.offset >> 12) + ((pos.offset >> 11) & 1)) },
                    });
                    // addi x5, (pos.offset & 0xfff)
                    encoder.encode(.{
                        .addi = .{ .rd = 5, .rs = 0, .imm12 = @truncate(pos.offset & 0xfff) },
                    });
                    // add x6, sp, x5
                    encoder.encode(.{
                        .add = .{ .rd = 6, .rs1 = 2, .rs2 = 5 },
                    });
                    // auipc x7, pc
                    encoder.encode(.{
                        .auipc = .{ .rd = 7, .imm20 = 0 },
                    });
                    // lw x5, [x7 + 20] (address)
                    encoder.encode(.{
                        .lw = .{ .rd = 5, .rs = 7, .imm12 = @sizeOf(u32) * 5 + @sizeOf(usize) * 0 },
                    });
                    // sw [x6], x5
                    encoder.encode(.{
                        .sw = .{ .rs1 = 6, .rs2 = 5, .imm12_4_0 = 0, .imm12_11_5 = 0 },
                    });
                    // lw x5, [x7 + 24] (trampoline_address)
                    encoder.encode(.{
                        .lw = .{ .rd = 5, .rs = 7, .imm12 = @sizeOf(u32) * 5 + @sizeOf(usize) * 1 },
                    });
                    // jmp [x5]
                    encoder.encode(.{
                        .jalr = .{ .rd = 0, .rs = 5, .imm12 = 0 },
                    });
                    encoder.encode(.{ .literal = address });
                    encoder.encode(.{ .literal = trampoline_address });
                },
                .powerpc, .powerpcle => {
                    const code_address: usize = if (output) |slice| @intFromPtr(slice.ptr) else 0;
                    const code_addr_31_16: u16 = @truncate((code_address >> 16) & 0xffff);
                    const code_addr_15_0: u16 = @truncate((code_address >> 0) & 0xffff);
                    // lis r11, code_addr_31_16
                    encoder.encode(.{
                        .addis = .{ .rt = 11, .ra = 0, .imm16 = @bitCast(code_addr_31_16) },
                    });
                    // ori r11, r11, code_addr_15_0
                    encoder.encode(.{
                        .ori = .{ .ra = 11, .rs = 11, .imm16 = @bitCast(code_addr_15_0) },
                    });
                    // lw r12, [r11 + 28] (address)
                    encoder.encode(.{
                        .lw = .{ .rt = 12, .ra = 11, .ds = 28 },
                    });
                    // stw [sp + pos.offset], r12
                    encoder.encode(.{
                        .stw = .{ .ra = 1, .rs = 12, .ds = @intCast(pos.offset) },
                    });
                    // lw r12, [r11 + 32] (trampoline_address)
                    encoder.encode(.{
                        .lw = .{ .rt = 12, .ra = 11, .ds = 32 },
                    });
                    // mtctr r12
                    encoder.encode(.{
                        .mtctr = .{ .rs = 12 },
                    });
                    // bctrl
                    encoder.encode(.{
                        .bctrl = .{},
                    });
                    encoder.encode(.{ .literal = address });
                    encoder.encode(.{ .literal = trampoline_address });
                },
                else => @compileError("No support for '" ++ @tagName(builtin.target.cpu.arch) ++ "'"),
            }
            return encoder.len;
        }

        fn findAddressPosition(ptr: *const anyopaque) !AddressPosition {
            var stack_align_mask: ?isize = null;
            var stack_offset: isize = 0;
            var index: ?isize = null;
            switch (builtin.target.cpu.arch) {
                .x86, .x86_64 => {
                    const instrs: [*]const u8 = @ptrCast(ptr);
                    const nop = @intFromEnum(Instruction.Opcode.nop);
                    const sp = 4;
                    var registers = [1]isize{0} ** switch (@bitSizeOf(usize)) {
                        32 => 8,
                        64 => 16,
                        else => unreachable,
                    };
                    var i: usize = 0;
                    while (i < 262144) {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            index = registers[0];
                            break;
                        } else {
                            const instr, const attrs, const len = Instruction.decode(instrs[i..]);
                            i += len;
                            if (instr.getMod()) |mod| {
                                switch (instr.opcode) {
                                    .@"mov r/m r" => if (mod == 3) {
                                        const rs = instr.getReg();
                                        const rd = instr.getRM();
                                        registers[rd] = registers[rs];
                                    },
                                    .@"lea r/m r" => {
                                        const disp = instr.getDisp();
                                        const rs = instr.getRM();
                                        const rd = instr.getReg();
                                        registers[rd] = registers[rs] + disp;
                                    },
                                    .@"add/or/etc r/m imm8", .@"add/or/etc r/m imm32" => if (mod == 3) {
                                        const imm = instr.getImm(isize);
                                        const rd = instr.getRM();
                                        switch (instr.mod_rm.?.reg) {
                                            0 => registers[rd] += imm,
                                            4 => if (rd == sp) {
                                                // stack alignment
                                                stack_align_mask = imm;
                                                stack_offset = registers[rd];
                                                registers[rd] = 0;
                                            } else {
                                                registers[rd] &= imm;
                                            },
                                            5 => registers[rd] -= imm,
                                            else => {},
                                        }
                                    },
                                    else => {},
                                }
                            }
                            const change: isize = if (attrs.affects_all) @sizeOf(usize) * registers.len else @sizeOf(usize);
                            if (attrs.pushes) {
                                registers[sp] -= change;
                            } else if (attrs.pops) {
                                registers[sp] += change;
                            }
                        }
                    }
                },
                .aarch64 => {
                    var instrs: [*]const u32 = @ptrCast(@alignCast(ptr));
                    const nop: u32 = @bitCast(Instruction.NOP{});
                    var registers = [1]isize{0} ** 32;
                    var prev_index: ?usize = null;
                    var i: usize = 0;
                    while (i < 65536) : (i += 1) {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            index = registers[9];
                            break;
                        } else {
                            const instr = instrs[i];
                            if (match(Instruction.ADD, instr)) |add| {
                                const amount: isize = switch (add.shift) {
                                    0 => add.imm12,
                                    1 => @as(isize, @intCast(add.imm12)) << 12,
                                };
                                registers[add.rd] = registers[add.rn] + amount;
                            } else if (match(Instruction.SUB, instr)) |sub| {
                                const amount: isize = switch (sub.shift) {
                                    0 => sub.imm12,
                                    1 => @as(isize, @intCast(sub.imm12)) << 12,
                                };
                                registers[sub.rd] = registers[sub.rn] - amount;
                            } else if (match(Instruction.MOV, instr)) |mov| {
                                registers[mov.rd] = registers[mov.rm];
                            } else if (match(Instruction.STR.PRE, instr)) |str| {
                                registers[str.rn] += @as(isize, str.imm9);
                            } else if (match(Instruction.STR.POST, instr)) |str| {
                                registers[str.rn] += @as(isize, str.imm9);
                            } else if (match(Instruction.STP.PRE, instr)) |stp| {
                                registers[stp.rn] += @as(isize, stp.imm7) * 8;
                            } else if (match(Instruction.STP.POST, instr)) |stp| {
                                registers[stp.rn] += @as(isize, stp.imm7) * 8;
                            } else if (match(Instruction.AND, instr)) |@"and"| {
                                if (@"and".rd == 31) {
                                    // stack alignment
                                    stack_align_mask = @"and".imm;
                                    stack_offset = registers[@"and".rn];
                                    registers[31] = 0;
                                }
                            } else if (match(Instruction.BL, instr)) |bl| {
                                if (builtin.mode == .ReleaseSmall) {
                                    // jump to outlined section (happen only when optimizing for size)
                                    if (prev_index != null) break;
                                    const old_pc: isize = @bitCast(@intFromPtr(&instrs[i]));
                                    const new_pc: usize = @bitCast(old_pc + bl.imm26 * 4);
                                    // subtract @sizeOf(u32) to account for the while loop's (i += 1)
                                    instrs = @ptrFromInt(new_pc - @sizeOf(u32));
                                    prev_index = i;
                                    i = 0;
                                }
                            } else if (match(Instruction.RET, instr)) |_| {
                                if (builtin.mode == .ReleaseSmall) {
                                    // return from outlined section
                                    if (prev_index == null) break;
                                    instrs = @ptrCast(@alignCast(ptr));
                                    i = prev_index.?;
                                    prev_index = null;
                                }
                            }
                        }
                    }
                },
                .riscv32, .riscv64 => {
                    var instrs: [*]const u16 = @ptrCast(@alignCast(ptr));
                    const nop: u16 = @bitCast(Instruction.NOP.C{});
                    const sp = 2;
                    var registers = [1]isize{0} ** 32;
                    var prev_index: ?usize = null;
                    var i: usize = 0;
                    while (i < 131072) : (i += 1) {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            index = registers[6];
                            break;
                        } else if (instrs[i] & 3 == 3) {
                            const instr32_ptr: *align(@alignOf(u16)) const u32 = @ptrCast(&instrs[i]);
                            const instr = instr32_ptr.*;
                            i += 1;
                            if (match(Instruction.ADDI, instr)) |addi| {
                                const amount: isize = addi.imm12;
                                registers[addi.rd] = registers[addi.rs] + amount;
                            } else if (match(Instruction.AUIPC, instr)) |auipc| {
                                if (builtin.mode == .ReleaseSmall) {
                                    const pc: isize = @bitCast(@intFromPtr(&instrs[i - 1]));
                                    registers[auipc.rd] = pc + (@as(isize, auipc.imm20) << 12);
                                }
                            } else if (match(Instruction.JALR, instr)) |jalr| {
                                if (builtin.mode == .ReleaseSmall) {
                                    // jump to outlined section (happen only when optimizing for size)
                                    if (prev_index != null) break;
                                    const new_pc: usize = @bitCast(registers[jalr.rs] + jalr.imm12);
                                    // subtract @sizeOf(u16) to account for the while loop's (i += 1)
                                    instrs = @ptrFromInt(new_pc - @sizeOf(u16));
                                    prev_index = i;
                                    i = 0;
                                }
                            }
                        } else {
                            const instr = instrs[i];
                            if (match(Instruction.ADDI.C, instr)) |addi| {
                                const IntRemaining = std.meta.Int(.signed, @bitSizeOf(isize) - 5);
                                const int: packed struct(isize) {
                                    @"4:0": u5,
                                    @"63:5": IntRemaining,
                                } = .{ .@"4:0" = addi.nzimm_0_4, .@"63:5" = addi.nzimm_5 };
                                const amount: isize = @bitCast(int);
                                registers[addi.rd] = registers[addi.rd] + amount;
                            } else if (match(Instruction.ADDI.C.SP, instr)) |addisp| {
                                const IntRemaining = std.meta.Int(.signed, @bitSizeOf(isize) - 9);
                                const int: packed struct(isize) {
                                    @"3:0": u4 = 0,
                                    @"4": u1,
                                    @"5": u1,
                                    @"6": u1,
                                    @"8:7": u2,
                                    @"63:9": IntRemaining,
                                } = .{
                                    .@"5" = @intCast((addisp.nzimm_46875 >> 0) & 0x01),
                                    .@"8:7" = @intCast((addisp.nzimm_46875 >> 1) & 0x03),
                                    .@"6" = @intCast((addisp.nzimm_46875 >> 3) & 0x01),
                                    .@"4" = @intCast((addisp.nzimm_46875 >> 4) & 0x01),
                                    .@"63:9" = addisp.imm_9,
                                };
                                const amount: isize = @bitCast(int);
                                registers[sp] = registers[sp] + amount;
                            } else if (match(Instruction.JALR.C, instr)) |_| {
                                if (builtin.mode == .ReleaseSmall) {
                                    // return from outlined section
                                    // this check need to happen before the one for ADD.C since
                                    // JALR.C looks like ADD.C with rs = 0
                                    if (prev_index == null) break;
                                    instrs = @ptrCast(@alignCast(ptr));
                                    i = prev_index.?;
                                    prev_index = null;
                                }
                            } else if (match(Instruction.ADD.C, instr)) |add| {
                                // compressed form of ADD is actual a MOV
                                registers[add.rd] = registers[add.rs];
                            }
                        }
                    }
                },
                .powerpc, .powerpcle, .powerpc64, .powerpc64le => {
                    const instrs: [*]const u32 = @ptrCast(@alignCast(ptr));
                    // li 0, 0 is used as nop instead of regular nop
                    const nop: u32 = @bitCast(Instruction.ADDI{ .ra = 0, .rt = 0, .imm16 = 0 });
                    var registers = [1]isize{0} ** 32;
                    for (0..65536) |i| {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            index = registers[11];
                            break;
                        } else {
                            const instr = instrs[i];
                            if (match(Instruction.ADDI, instr)) |addi| {
                                registers[addi.rt] = registers[addi.ra] + addi.imm16;
                            } else if (match(Instruction.SUBFIC, instr)) |subfic| {
                                registers[subfic.rt] = registers[subfic.ra] + subfic.imm16;
                            } else if (match(Instruction.OR, instr)) |@"or"| {
                                if (@"or".rb == @"or".rs) { // => mr ra rs
                                    registers[@"or".ra] = registers[@"or".rs];
                                }
                            } else if (@bitSizeOf(usize) == 64) {
                                if (match(Instruction.STDU, instr)) |stdu| {
                                    registers[stdu.ra] += @as(isize, stdu.ds) << 2;
                                } else if (match(Instruction.STDUX, instr)) |stdux| {
                                    registers[stdux.rs] = registers[stdux.ra] + registers[stdux.rb];
                                }
                            } else if (@bitSizeOf(usize) == 32) {
                                if (match(Instruction.STWU, instr)) |stwu| {
                                    registers[stwu.ra] += stwu.ds;
                                } else if (match(Instruction.STWUX, instr)) |stwux| {
                                    registers[stwux.rs] = registers[stwux.ra] + registers[stwux.rb];
                                }
                            }
                        }
                    }
                },
                .arm => {
                    const instrs: [*]const u32 = @ptrCast(@alignCast(ptr));
                    const nop: u32 = @bitCast(Instruction.NOP{});
                    var registers = [1]isize{0} ** 16;
                    for (0..65536) |i| {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            index = registers[4];
                            break;
                        } else {
                            const instr = instrs[i];
                            if (match(Instruction.ADD, instr)) |add| {
                                const amount: isize = @intCast(Instruction.decodeIMM12(add.imm12));
                                registers[add.rd] = registers[add.rn] + amount;
                            } else if (match(Instruction.SUB, instr)) |sub| {
                                const amount: isize = @intCast(Instruction.decodeIMM12(sub.imm12));
                                registers[sub.rd] = registers[sub.rn] - amount;
                            } else if (match(Instruction.MOV, instr)) |mov| {
                                registers[mov.rd] = registers[mov.rm];
                            } else if (match(Instruction.PUSH, instr)) |push| {
                                const count: isize = @popCount(push.regs);
                                registers[13] -= count * 4;
                            }
                        }
                    }
                },
                else => unreachable,
            }
            if (index) |i| {
                return .{
                    .offset = i,
                    .stack_offset = stack_offset,
                    .stack_align_mask = stack_align_mask,
                };
            } else return error.Unexpected;
        }
    };
}

/// Return type of bindWithCallConv(), createWithCallConv(), etc.
pub fn BoundFnWithCallConv(comptime T: type, comptime CT: type, cc: ?std.builtin.CallingConvention) type {
    const FT = FnType(T);
    const f = @typeInfo(FT).@"fn";
    const params = @typeInfo(FT).@"fn".params;
    const fields = @typeInfo(CT).@"struct".fields;
    const context_mapping = getContextMapping(FT, CT);
    var new_params: [params.len - fields.len]std.builtin.Type.Fn.Param = undefined;
    var index = 0;
    for (params, 0..) |param, number| {
        const name = std.fmt.comptimePrint("{d}", .{number});
        if (!isMapped(&context_mapping, name)) {
            if (param.type == null) {
                @compileError("A variable must be bound to an 'anytype' parameter");
            }
            new_params[index] = param;
            index += 1;
        }
    }
    var new_f = f;
    new_f.params = &new_params;
    new_f.is_generic = false;
    if (cc) |c| new_f.calling_convention = c;
    return @Type(.{ .@"fn" = new_f });
}

/// Return type of bind(), create(), etc.
pub fn BoundFn(comptime T: type, comptime CT: type) type {
    return BoundFnWithCallConv(T, CT, null);
}

test "BoundFn" {
    const FT = fn (i8, i16, i32, i64) i64;
    const CT = struct {
        @"2": i32,
    };
    const BFT = BoundFn(FT, CT);
    try expectEqual(fn (i8, i16, i64) i64, BFT);
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
    try expectEqualSlices(u8, "0", mapping[0].src);
    try expectEqualSlices(u8, "0", mapping[0].dest);
    try expectEqualSlices(u8, "1", mapping[1].src);
    try expectEqualSlices(u8, "2", mapping[1].dest);
    try expectEqualSlices(u8, "2", mapping[2].src);
    try expectEqualSlices(u8, "3", mapping[2].dest);
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
    try expectEqualSlices(u8, "1", mapping[0].src);
    try expectEqualSlices(u8, "1", mapping[0].dest);
    try expectEqualSlices(u8, "-1", mapping[1].src);
    try expectEqualSlices(u8, "3", mapping[1].dest);
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
    try expectEqual(true, isMapped(&mapping, "1"));
    try expectEqual(true, isMapped(&mapping, "3"));
    try expectEqual(false, isMapped(&mapping, "2"));
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
    try expectEqual(fn (i32) i32, FnType(@TypeOf(ns.foo)));
    try expectEqual(fn (i32) i32, FnType(@TypeOf(&ns.foo)));
}

fn Uninlined(comptime FT: type) type {
    const f = @typeInfo(FT).@"fn";
    if (f.calling_convention != .@"inline") return FT;
    return @Type(.{
        .@"fn" = .{
            .calling_convention = .auto,
            .is_generic = f.is_generic,
            .is_var_args = f.is_var_args,
            .return_type = f.return_type,
            .params = f.params,
        },
    });
}

fn uninline(func: anytype) Uninlined(@TypeOf(func)) {
    const FT = @TypeOf(func);
    const f = @typeInfo(FT).@"fn";
    if (f.calling_convention != .@"inline") return func;
    const ns = struct {
        inline fn call(args: std.meta.ArgsTuple(FT)) f.return_type.? {
            return @call(.auto, func, args);
        }
    };
    return fn_transform.spreadArgs(ns.call, .auto);
}

const Instruction = switch (builtin.target.cpu.arch) {
    .x86, .x86_64 => struct {
        pub const Opcode = enum(u8) {
            @"add r/m8 r8" = 0x00,
            @"add r/m r" = 0x01,
            @"add r8 r/m8" = 0x02,
            @"add r r/m" = 0x03,
            @"add ax8 imm8" = 0x04,
            @"add ax imm32" = 0x05,
            @"push es" = 0x06,
            @"pop es" = 0x07,
            @"or r/m8 r8" = 0x08,
            @"or r/m r" = 0x09,
            @"or r8 r/m8" = 0x0a,
            @"or r r/m" = 0x0b,
            @"or ax8 imm8" = 0x0c,
            @"or ax imm32" = 0x0d,
            @"push cs" = 0x0e,
            ext = 0x0f,
            @"adc r/m8 r8" = 0x10,
            @"adc r/m r" = 0x11,
            @"adc r8 r/m8" = 0x12,
            @"adc r r/m" = 0x13,
            @"adc ax8 imm8" = 0x14,
            @"adc ax imm32" = 0x15,
            @"push ss" = 0x16,
            @"pop ss" = 0x17,
            @"sbb r/m8 r8" = 0x18,
            @"sbb r/m r" = 0x19,
            @"sbb r8 r/m8" = 0x1a,
            @"sbb r r/m" = 0x1b,
            @"sbb ax8 imm8" = 0x1c,
            @"sbb ax imm32" = 0x1d,
            @"push ds" = 0x1e,
            @"pop ds" = 0x1f,
            @"and r/m8 r8" = 0x20,
            @"and r/m r" = 0x21,
            @"and r8 r/m8" = 0x22,
            @"and r r/m" = 0x23,
            @"and ax8 imm8" = 0x24,
            @"and ax imm32" = 0x25,
            @"daa ax" = 0x27,
            @"sub r/m8 r8" = 0x28,
            @"sub r/m r" = 0x29,
            @"sub r8 r/m8" = 0x2a,
            @"sub r r/m" = 0x2b,
            @"sub ax8 imm8" = 0x2c,
            @"sub ax imm32" = 0x2d,
            @"das ax" = 0x2f,
            @"xor r/m8 r8" = 0x30,
            @"xor r/m r" = 0x31,
            @"xor r8 r/m8" = 0x32,
            @"xor r r/m" = 0x33,
            @"xor ax8 imm8" = 0x34,
            @"xor ax imm32" = 0x35,
            @"aaa ax" = 0x37,
            @"cmp r/m8 r8" = 0x38,
            @"cmp r/m r" = 0x39,
            @"cmp r8 r/m8" = 0x3a,
            @"cmp r r/m" = 0x3b,
            @"cmp ax8 imm8" = 0x3c,
            @"cmp ax imm32" = 0x3d,
            @"aas ax" = 0x3f,
            @"inc ax" = 0x40,
            @"inc cx" = 0x41,
            @"inc dx" = 0x42,
            @"inc bx" = 0x43,
            @"inc sp" = 0x44,
            @"inc bp" = 0x45,
            @"inc si" = 0x46,
            @"inc di" = 0x47,
            @"dec ax" = 0x48,
            @"dec cx" = 0x49,
            @"dec dx" = 0x4a,
            @"dec bx" = 0x4b,
            @"dec sp" = 0x4c,
            @"dec bp" = 0x4d,
            @"dec si" = 0x4e,
            @"dec di" = 0x4f,
            @"push ax" = 0x50,
            @"push cx" = 0x51,
            @"push dx" = 0x52,
            @"push bx" = 0x53,
            @"push sp" = 0x54,
            @"push bp" = 0x55,
            @"push si" = 0x56,
            @"push di" = 0x57,
            @"pop ax" = 0x58,
            @"pop cx" = 0x59,
            @"pop dx" = 0x5a,
            @"pop bx" = 0x5b,
            @"pop sp" = 0x5c,
            @"pop bp" = 0x5d,
            @"pop si" = 0x5e,
            @"pop di" = 0x5f,
            pusha = 0x60,
            popa = 0x61,
            @"bound r r/m" = 0x62,
            arpl = 0x63,
            @"push imm32" = 0x68,
            @"imul r r/m imm32" = 0x69,
            @"push imm8" = 0x6a,
            @"imul r r/m imm8" = 0x6b,
            @"ins m8 dx" = 0x6c,
            @"ins m32 dx" = 0x6d,
            @"outs dx m8" = 0x6e,
            @"outs dx m32" = 0x6f,
            @"jo moffs8" = 0x70,
            @"jno moffs8" = 0x71,
            @"jb moffs8" = 0x72,
            @"jnb moffs8" = 0x73,
            @"jz moffs8" = 0x74,
            @"jnz moffs8" = 0x75,
            @"jbe moffs8" = 0x76,
            @"jnbe moffs8" = 0x77,
            @"js moffs8" = 0x78,
            @"jns moffs8" = 0x79,
            @"jp moffs8" = 0x7a,
            @"jnp moffs8" = 0x7b,
            @"jl moffs8" = 0x7c,
            @"jnl moffs8" = 0x7d,
            @"jle moffs8" = 0x7e,
            @"jnle moffs8" = 0x7f,
            @"add/or/etc (no sign ext) r/m imm8" = 0x80,
            @"add/or/etc r/m imm32" = 0x81,
            @"add/or/etc r/m8 imm8" = 0x82,
            @"add/or/etc r/m imm8" = 0x83,
            @"test r/m8 r8" = 0x84,
            @"test r/m r" = 0x85,
            @"xchg r8 r8" = 0x86,
            @"xchg r/m r" = 0x87,
            @"mov r/m8 r8" = 0x88,
            @"mov r/m r" = 0x89,
            @"mov r8 r/m8" = 0x8a,
            @"mov r r/m" = 0x8b,
            @"mov r sreg" = 0x8c,
            @"lea r/m r" = 0x8d,
            @"mov sreg r/m" = 0x8e,
            @"xop imm16" = 0x8f,
            nop = 0x90,
            @"xchg cx ax" = 0x91,
            @"xchg dx ax" = 0x92,
            @"xchg bx ax" = 0x93,
            @"xchg sp ax" = 0x94,
            @"xchg bp ax" = 0x95,
            @"xchg si ax" = 0x96,
            @"xchg di ax" = 0x97,
            @"cwde/cdqe ax ax" = 0x98,
            @"cdq/cqo dx ax" = 0x99,
            @"call ptr16:32" = 0x9a,
            @"push flags" = 0x9c,
            @"pop flags" = 0x9d,
            @"sahf ax8" = 0x9e,
            @"lahf ax8" = 0x9f,
            @"mov ax8 moffs8" = 0xa0,
            @"mov ax moffs32/64" = 0xa1,
            @"mov moffs8 ax8" = 0xa2,
            @"mov moffs32/64 ax" = 0xa3,
            movsb = 0xa4,
            @"movsd/q" = 0xa5,
            @"cmps m8" = 0xa6,
            @"cmps m32/64" = 0xa7,
            @"test ax8 imm8" = 0xa8,
            @"test ax imm32" = 0xa9,
            @"stos m8" = 0xaa,
            @"stos m32/64" = 0xab,
            @"lods m8" = 0xac,
            @"lods m32/64" = 0xad,
            @"scas m8" = 0xae,
            @"scas m32/64" = 0xaf,
            @"mov ax8 imm8" = 0xb0,
            @"mov cx8 imm8" = 0xb1,
            @"mov dx8 imm8" = 0xb2,
            @"mov bx8 imm8" = 0xb3,
            @"mov sp8 imm8" = 0xb4,
            @"mov bp8 imm8" = 0xb5,
            @"mov si8 imm8" = 0xb6,
            @"mov di imm8" = 0xb7,
            @"mov ax imm32/64" = 0xb8,
            @"mov cx imm32/64" = 0xb9,
            @"mov dx imm32/64" = 0xba,
            @"mov bx imm32/64" = 0xbb,
            @"mov sp imm32/64" = 0xbc,
            @"mov bp imm32/64" = 0xbd,
            @"mov si imm32/64" = 0xbe,
            @"mov di imm32/64" = 0xbf,
            @"rol/ror/etc r/m8 imm8" = 0xc0,
            @"rol/ror/etc r/m imm8" = 0xc1,
            @"ret imm16" = 0xc2,
            ret = 0xc3,
            @"vex imm16" = 0xc4,
            @"vex imm8" = 0xc5,
            @"mov r/m8 imm8" = 0xc6,
            @"mov r/m imm32" = 0xc7,
            @"enter imm16 imm8" = 0xc8,
            leave = 0xc9,
            @"retf imm16" = 0xca,
            retf = 0xcb,
            @"int 3 flags" = 0xcc,
            @"int 0 flags" = 0xce,
            @"int imm8" = 0xcd,
            @"iret flags" = 0xcf,
            @"ro/ror/etc r/m8 1" = 0xd0,
            @"ro/ror/etc r/m 1" = 0xd1,
            @"ro/ror/etc r/m8 cx" = 0xd2,
            @"ro/ror/etc r/m cx" = 0xd3,
            @"amx ax8 imm8" = 0xd4,
            @"aad ax8 imm8" = 0xd5,
            @"salc ax8" = 0xd6,
            @"xlat ax8 m8" = 0xd7,
            @"fadd/fmul/etc st m32" = 0xd8,
            @"fld/fxch/etc st m32" = 0xd9,
            @"fiadd/fimul/etc st m32" = 0xda,
            @"fisttp/fist/etc m32 st" = 0xdb,
            @"fadd/fmul/etc st m64" = 0xdc,
            @"fld/fxch/etc st m64" = 0xdd,
            @"fiadd/fimul/etc st m16" = 0xde,
            @"fisttp/fist/etc m16 st" = 0xdf,
            @"loopne cx moffs8" = 0xe0,
            @"loope cx moffs8" = 0xe1,
            @"loop cx moffs8" = 0xe2,
            @"jz moffs8 cx" = 0xe3,
            @"in ax8 imm8" = 0xe4,
            @"in ax imm8" = 0xe5,
            @"out imm8 ax8 " = 0xe6,
            @"out imm8 ax" = 0xe7,
            @"call moffs32" = 0xe8,
            @"jmp moffs32" = 0xe9,
            @"jmp ptr16:32" = 0xea,
            @"jmp moffs8" = 0xeb,
            @"in ax8 dx" = 0xec,
            @"in ax dx" = 0xed,
            @"out dx ax8" = 0xee,
            @"out dx ax" = 0xef,
            @"int 1 flags" = 0xf1,
            hlt = 0xf4,
            cmc = 0xf5,
            @"not/neg/etc r/m8" = 0xf6,
            @"not/neg/etc r/m" = 0xf7,
            clc = 0xf8,
            stc = 0xf9,
            cli = 0xfa,
            sti = 0xfb,
            cld = 0xfc,
            std = 0xfd,
            @"inc/dev r/m8" = 0xfe,
            @"jmp/call/etc r/m" = 0xff,
            _,
        };
        const ExtOpcode = enum(u8) {
            @"sldt/str m16 tr" = 0x00,
            @"sgdt/vmcall/etc" = 0x01,
            @"lar rm r" = 0x02,
            @"lsl rm r" = 0x03,
            @"clts cr0" = 0x06,
            invd = 0x08,
            wbinvd = 0x09,
            @"movups xmm xmm/m128" = 0x10,
            @"movups xmm/m128 xmm" = 0x11,
            @"movhlps xmm xmm" = 0x12,
            @"movlps m64 xmm" = 0x13,
            @"unpcklps xmm xmm/m64" = 0x14,
            @"unpckhps xmm xmm/m64" = 0x15,
            @"movlhps xmm xmm" = 0x16,
            @"movhps m64 xmm" = 0x17,
            @"mov r32 cr" = 0x20,
            @"mov r32 dr" = 0x21,
            @"mov cr r32" = 0x22,
            @"mov dr r" = 0x23,
            @"movaps xmm xmm/m128" = 0x28,
            @"movaps xmm/m128 xmm1" = 0x29,
            @"cvtpi2ps xmm m64" = 0x2a,
            @"movntps xmm m64" = 0x2b,
            @"cvttps2pi m128 xmm" = 0x2c,
            @"cvtps2pi mm xmm/m64" = 0x2d,
            @"ucomiss xmm xmm/m32" = 0x2e,
            @"comiss xmm xmm/m32" = 0x2f,
            @"wrmsr msr cx" = 0x30,
            @"rdtsc ax dx" = 0x31,
            @"rdmsr ax dx" = 0x32,
            @"rdpmc ax dx" = 0x33,
            @"sysenter ss sp" = 0x34,
            @"sysexit ss sp" = 0x35,
            @"getsec ax" = 0x37,
            @"pshufb/phaddw/etc xmm m64" = 0x38,
            @"roundps/blendps/etc xmm m128" = 0x3a,
            @"cmovo r r/m" = 0x40,
            @"cmovno r r/m" = 0x41,
            @"cmovb r r/m" = 0x42,
            @"cmovnb r r/m" = 0x43,
            @"cmovz r r/m" = 0x44,
            @"cmovnz r r/m" = 0x45,
            @"cmovbe r r/m" = 0x46,
            @"cmovnbe r r/m" = 0x47,
            @"cmovs r r/m" = 0x48,
            @"cmovns r r/m" = 0x49,
            @"cmovp r r/m" = 0x4a,
            @"cmovnp r r/m" = 0x4b,
            @"cmovl r r/m" = 0x4c,
            @"cmovnl r r/m" = 0x4d,
            @"cmovle r r/m" = 0x4e,
            @"cmovnle r r/m" = 0x4f,
            @"movmskps r xmm" = 0x50,
            @"sqrtps xmm xmm/m128" = 0x51,
            @"rsqrtps xmm xmm/m128" = 0x52,
            @"rcpps xmm xmm/m128" = 0x53,
            @"andps xmm xmm/m128" = 0x54,
            @"andnps xmm xmm/m128" = 0x55,
            @"orps xmm xmm/m128" = 0x56,
            @"xorps xmm xmm/m128" = 0x57,
            @"addps xmm xmm/m128" = 0x58,
            @"mulps xmm xmm/m128" = 0x59,
            @"cvtps2pd xmm xmm/m128" = 0x5a,
            @"cvtdq2ps xmm xmm/m128" = 0x5b,
            @"subps xmm xmm/m128" = 0x5c,
            @"minps xmm xmm/m128" = 0x5d,
            @"divps xmm xmm/m128" = 0x5e,
            @"maxps xmm xmm/m128" = 0x5f,
            @"punpcklbw xmm mm/m128" = 0x60,
            @"punpcklwd xmm mm/m128" = 0x61,
            @"punpckldq xmm mm/m128" = 0x62,
            @"packsswb xmm mm/m128" = 0x63,
            @"pcmpgtb xmm mm/m128" = 0x64,
            @"pcmpgtw xmm mm/m128" = 0x65,
            @"pcmpgtd xmm mm/m128" = 0x66,
            @"packuswb xmm mm/m128" = 0x67,
            @"punpckhbw xmm mm/m128" = 0x68,
            @"punpckhwd xmm mm/m128" = 0x69,
            @"punpckhdq xmm mm/m128" = 0x6a,
            @"packssdw xmm mm/m128" = 0x6b,
            @"punpcklqdq xmm mm/m128" = 0x6c,
            @"punpckhqdq xmm mm/m128" = 0x6d,
            @"movd xmm mm/m128" = 0x6e,
            @"movq xmm mm/m128" = 0x6f,
            @"pshuflw xmm imm8" = 0x70,
            @"psrlw xmm imm8" = 0x71,
            @"psrld xmm imm8" = 0x72,
            @"psrlq xmm imm8" = 0x73,
            @"pcmpeqb xmm xmm/m128" = 0x74,
            @"pcmpeqw xmm xmm/m128" = 0x75,
            @"pcmpeqd xmm xmm/m128" = 0x76,
            emms = 0x77,
            @"vmread r/m32 r" = 0x78,
            @"vmwrite r r/m32" = 0x79,
            @"haddpd xmm xmm/m128" = 0x7c,
            @"haddps xmm xmm/m128" = 0x7d,
            @"movd xmm xmm/m128" = 0x7e,
            @"movq xmm xmm/m128" = 0x7f,
            @"jo moffs32" = 0x80,
            @"jno moffs32" = 0x81,
            @"jb moffs32" = 0x82,
            @"jnb moffs32" = 0x83,
            @"jz moffs32" = 0x84,
            @"jnz moffs32" = 0x85,
            @"jbe moffs32" = 0x86,
            @"jnbe moffs32" = 0x87,
            @"js moffs32" = 0x88,
            @"jns moffs32" = 0x89,
            @"jp moffs32" = 0x8a,
            @"jnp moffs32" = 0x8b,
            @"jl moffs32" = 0x8c,
            @"jnl moffs32" = 0x8d,
            @"jle moffs32" = 0x8e,
            @"jnle moffs32" = 0x8f,
            @"seto r/m8" = 0x90,
            @"setno r/m8" = 0x91,
            @"setb r/m8" = 0x92,
            @"setnb r/m8" = 0x93,
            @"setz r/m8" = 0x94,
            @"setnz r/m8" = 0x95,
            @"setbe r/m8" = 0x96,
            @"setnbe r/m8" = 0x97,
            @"sets r/m8" = 0x98,
            @"setns r/m8" = 0x99,
            @"setp r/m8" = 0x9a,
            @"setnp r/m8" = 0x9b,
            @"setl r/m8" = 0x9c,
            @"setnl r/m8" = 0x9d,
            @"setle r/m8" = 0x9e,
            @"setnle r/m8" = 0x9f,
            @"push fs" = 0xa0,
            @"pop fs" = 0xa1,
            cpuid = 0xa2,
            @"bt r/m r" = 0xa3,
            @"shld r/m r" = 0xa4,
            @"push gs" = 0xa8,
            @"pop gs" = 0xa9,
            @"rsm flags" = 0xaa,
            @"bts r/m r" = 0xab,
            @"shrd r/m r imm8" = 0xac,
            @"shrd r/m r cx8" = 0xad,
            @"fxsave m512 st st" = 0xae,
            @"imul r r" = 0xaf,
            @"cmpxchg r/m8 ax8" = 0xb0,
            @"cmpxchg r/m ax" = 0xb1,
            @"lss r ptr16:32" = 0xb2,
            @"btr r/m r" = 0xb3,
            @"lfs r ptr16:32" = 0xb4,
            @"lgs r ptr16:32" = 0xb5,
            @"movzx r r/m8" = 0xb6,
            @"movzx r r/m16" = 0xb7,
            @"popcnt r r/m" = 0xb8,
            @"ud r r/m" = 0xb9,
            @"bt r/m imm8" = 0xba,
            @"btc r/m imm8" = 0xbb,
            @"bsf r r/m" = 0xbc,
            @"bsr r r/m8" = 0xbd,
            @"movsx r r/m8" = 0xbe,
            @"movsx r r/m16" = 0xbf,
            @"xadd r/m8 r8" = 0xc0,
            @"xadd r r" = 0xc1,
            @"cmpps xmm xmm/m128" = 0xc2,
            @"movnti m32 r" = 0xc3,
            @"pinsrw xmm r" = 0xc4,
            @"pextrw r xmm" = 0xc5,
            @"shufps xmm xmm/m128" = 0xc6,
            @"cmpxchg8b r/m64 ax" = 0xc7,
            @"bswap ax" = 0xc8,
            @"bswap cx" = 0xc9,
            @"bswap dx" = 0xca,
            @"bswap bx" = 0xcb,
            @"bswap sp" = 0xcc,
            @"bswap bp" = 0xcd,
            @"bswap si" = 0xce,
            @"bswap di" = 0xcf,
            @"addsubpd xmm xmm/m128" = 0xd0,
            @"psrlw xmm xmm/m128" = 0xd1,
            @"psrld xmm xmm/m128" = 0xd2,
            @"psrlq xmm xmm/m128" = 0xd3,
            @"paddq xmm xmm/m128" = 0xd4,
            @"pmullw xmm xmm/m128" = 0xd5,
            @"movq xmm/m64 xmm/m128" = 0xd6,
            @"pmovmskb r xmm" = 0xd7,
            @"psubusb xmm xmm/m128" = 0xd8,
            @"psubusw xmm xmm/m128" = 0xd9,
            @"pminub xmm xmm/m128" = 0xda,
            @"pand xmm xmm/m128" = 0xdb,
            @"paddusb xmm xmm/m128" = 0xdc,
            @"paddusw xmm xmm/m128" = 0xdd,
            @"pmaxub xmm xmm/m128" = 0xde,
            @"pandn xmm xmm/m128" = 0xdf,
            @"pavgb xmm xmm/m128" = 0xe0,
            @"psraw xmm xmm/m128" = 0xe1,
            @"parad xmm xmm/m128" = 0xe2,
            @"pavgw xmm xmm/m128" = 0xe3,
            @"pmulhuw xmm xmm/m128" = 0xe4,
            @"pmulhw xmm xmm/m128" = 0xe5,
            @"cvtpd2dq xmm xmm/m128" = 0xe6,
            @"movntq m128 xmmm" = 0xe7,
            @"psubsb xmm xmm/m128" = 0xe8,
            @"psubsw xmm xmm/m128" = 0xe9,
            @"pminsw xmm xmm/m128" = 0xea,
            @"por xmm xmm/m128" = 0xeb,
            @"paddsb xmm xmm/m128" = 0xec,
            @"paddsw xmm xmm/m128" = 0xed,
            @"pmaxsw xmm xmm/m128" = 0xee,
            @"pxor xmm xmm/m128" = 0xef,
            @"lddqu xmm m128" = 0xf0,
            @"psllw xmm xmm/m128" = 0xf1,
            @"pslld xmm xmm/m128" = 0xf2,
            @"psllq xmm xmm/m128" = 0xf3,
            @"pmuludq xmm xmm/m128" = 0xf4,
            @"pmaddwd xmm xmm/m128" = 0xf5,
            @"psadbw xmm xmm/m128" = 0xf6,
            @"maskmovq m128 xmm" = 0xf7,
            @"psubb xmm xmm/m128" = 0xf8,
            @"psubw xmm xmm/m128" = 0xf9,
            @"psubd xmm xmm/m128" = 0xfa,
            @"psubq xmm xmm/m128" = 0xfb,
            @"paddb xmm xmm/m128" = 0xfc,
            @"paddw xmm xmm/m128" = 0xfd,
            @"paddd xmm xmm/m128" = 0xfe,
            _,
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
            wait = 0x9b,
            f0 = 0xf0,
            f2 = 0xf2,
            f3 = 0xf3,
        };
        pub const REX = packed struct {
            b: u1 = 0,
            x: u1 = 0,
            r: u1 = 0,
            w: bool = true,
            pat: u4 = 4,
        };
        pub const ModRM = packed struct {
            rm: u3,
            reg: u3,
            mod: u2,
        };
        pub const SIB = packed struct {
            base: u3,
            index: u3,
            scale: u2,
        };

        const Attributes = packed struct {
            has_mod_rm: bool = false,
            has_imm8: bool = false,
            has_imm16: bool = false,
            has_imm32: bool = false,
            @"has_imm32/64": bool = false,
            pushes: bool = false,
            pops: bool = false,
            affects_all: bool = false,
        };
        const attribute_table = buildAttributeTable(Opcode);
        const ext_attribute_table = buildAttributeTable(ExtOpcode);

        fn buildAttributeTable(comptime ET: type) [256]Attributes {
            @setEvalBranchQuota(200000);
            var table: [256]Attributes = undefined;
            for (@typeInfo(ET).@"enum".fields) |field| {
                var attrs: Attributes = .{};
                const name = field.name;
                // modR/M byte is needed when the instruction works with
                if (std.mem.containsAtLeast(u8, name, 1, " r") or std.mem.containsAtLeast(u8, name, 1, " xmm") or name[0] == 'f') {
                    attrs.has_mod_rm = true;
                }
                if (std.mem.endsWith(u8, name, " imm8")) {
                    attrs.has_imm8 = true;
                } else if (std.mem.endsWith(u8, name, " imm32")) {
                    attrs.has_imm32 = true;
                } else if (std.mem.endsWith(u8, name, " imm32/64")) {
                    attrs.@"has_imm32/64" = true;
                }
                if (std.mem.containsAtLeast(u8, name, 1, " moffs8")) {
                    attrs.has_imm8 = true;
                } else if (std.mem.containsAtLeast(u8, name, 1, " moffs32")) {
                    attrs.has_imm32 = true;
                } else if (std.mem.containsAtLeast(u8, name, 1, " moffs32/64")) {
                    attrs.@"has_imm32/64" = true;
                } else if (std.mem.containsAtLeast(u8, name, 1, " imm16")) {
                    attrs.has_imm16 = true;
                }
                if (std.mem.startsWith(u8, name, "push ")) {
                    attrs.pushes = true;
                    attrs.affects_all = std.mem.endsWith(u8, name, " all");
                } else if (std.mem.startsWith(u8, name, "pop ")) {
                    attrs.pops = true;
                    attrs.affects_all = std.mem.endsWith(u8, name, " all");
                }
                const index: usize = field.value;
                table[index] = attrs;
            }
            return table;
        }

        pub fn decode(bytes: [*]const u8) std.meta.Tuple(&.{ @This(), Attributes, usize }) {
            var i: usize = 0;
            var instr: @This() = .{};
            if (std.meta.intToEnum(Prefix, bytes[i]) catch null) |prefix| {
                i += 1;
                instr.prefix = prefix;
            }
            var wide = false;
            if (@bitSizeOf(usize) == 64) {
                const rex: REX = @bitCast(bytes[i]);
                if (rex.pat == 4) {
                    i += 1;
                    instr.rex = rex;
                    wide = rex.w;
                }
            }
            instr.opcode = @enumFromInt(bytes[i]);
            i += 1;
            if (instr.opcode == .ext) {
                instr.ext_opcode = @enumFromInt(bytes[i]);
                i += 1;
            }
            const attrs = if (instr.ext_opcode) |opcode|
                ext_attribute_table[@intFromEnum(opcode)]
            else
                attribute_table[@intFromEnum(instr.opcode)];
            if (attrs.has_mod_rm) {
                const mod_rm: ModRM = @bitCast(bytes[i]);
                var disp_size: ?usize = null;
                i += 1;
                if (mod_rm.mod == 2 or (mod_rm.mod == 0 and mod_rm.rm == 5)) {
                    disp_size = 32;
                } else if (mod_rm.mod == 1) {
                    disp_size = 8;
                }
                instr.mod_rm = mod_rm;
                if (mod_rm.mod != 3 and mod_rm.rm == 4) {
                    const sib: SIB = @bitCast(bytes[i]);
                    i += 1;
                    if (sib.base == 5) disp_size = 32;
                    instr.sib = sib;
                }
                if (disp_size) |size| {
                    if (size == 8) {
                        instr.disp8 = std.mem.bytesToValue(i8, bytes[i .. i + 1]);
                        i += 1;
                    } else if (size == 32) {
                        instr.disp32 = std.mem.bytesToValue(i32, bytes[i .. i + 4]);
                        i += 4;
                    }
                }
            }
            if (attrs.has_imm16) {
                instr.imm16 = std.mem.bytesToValue(u16, bytes[i .. i + 2]);
                i += 2;
            }
            if (attrs.@"has_imm32/64" and wide) {
                instr.imm64 = std.mem.bytesToValue(u64, bytes[i .. i + 8]);
                i += 8;
            } else if (attrs.has_imm32 or (attrs.@"has_imm32/64" and !wide)) {
                instr.imm32 = std.mem.bytesToValue(u32, bytes[i .. i + 4]);
                i += 4;
            } else if (attrs.has_imm8) {
                instr.imm8 = std.mem.bytesToValue(u8, bytes[i .. i + 1]);
                i += 1;
            }
            return .{ instr, attrs, i };
        }

        pub fn getMod(self: @This()) ?u8 {
            return if (self.mod_rm) |m| m.mod else null;
        }

        pub fn getReg(self: @This()) usize {
            var index: usize = self.mod_rm.?.reg;
            if (self.rex) |rex| index |= @as(usize, rex.r) << 3;
            return index;
        }

        pub fn getRM(self: @This()) usize {
            var index: usize = self.mod_rm.?.rm;
            if (self.rex) |rex| index |= @as(usize, rex.b) << 3;
            return index;
        }

        pub fn getDisp(self: @This()) isize {
            return self.disp8 orelse self.disp32 orelse 0;
        }

        pub fn getImm(self: @This(), comptime T: type) T {
            const signedness = @typeInfo(T).int.signedness;
            if (self.imm8) |value| {
                return @as(std.meta.Int(signedness, 8), @bitCast(value));
            }
            if (self.imm32) |value| {
                return @as(std.meta.Int(signedness, 32), @bitCast(value));
            }
            if (@bitSizeOf(usize) == 64) {
                if (self.imm64) |value| {
                    return @as(std.meta.Int(signedness, 64), @bitCast(value));
                }
            }
            unreachable;
        }

        prefix: ?Prefix = null,
        rex: ?REX = null,
        opcode: Opcode = .nop,
        ext_opcode: ?ExtOpcode = null,
        mod_rm: ?ModRM = null,
        sib: ?SIB = null,
        disp8: ?i8 = null,
        disp32: ?i32 = null,
        imm16: ?u16 = null, // used by ENTER only, comes before imm8
        imm8: ?u8 = null,
        imm32: ?u32 = null,
        imm64: ?u64 = null,
    },
    .aarch64 => union(enum) {
        pub const ADD = packed struct(u32) {
            rd: u5,
            rn: u5,
            imm12: u12,
            shift: u1,
            @"31:23": u9 = 0b1001_0001_0,
        };
        pub const SUB = packed struct(u32) {
            rd: u5,
            rn: u5,
            imm12: u12,
            shift: u1,
            @"31:23": u9 = 0b1101_0001_0,
        };
        pub const AND = packed struct(u32) {
            rd: u5,
            rn: u5,
            imm: u13,
            @"32:22": u9 = 0b100100100,
        };
        pub const MOV = packed struct(u32) {
            rd: u5,
            rn: u5 = 0b11111,
            imm6: u6,
            rm: u5,
            @"31:22": u11 = 0b1010_1010_000,
        };
        pub const LDR = packed struct(u32) {
            rt: u5,
            imm19: u19,
            @"31:24": u8 = 0b0101_1000,
        };
        pub const STR = packed struct(u32) {
            rt: u5,
            rn: u5,
            imm12: u12,
            @"31:22": u10 = 0b1111_1001_00,

            pub const PRE = packed struct(u32) {
                rt: u5,
                rn: u5,
                @"11:10": u2 = 0b11,
                imm9: i9,
                @"31:21": u11 = 0b1111_1000_000,
            };
            pub const POST = packed struct(u32) {
                rt: u5,
                rn: u5,
                @"11:10": u2 = 0b01,
                imm9: i9,
                @"31:21": u11 = 0b1111_1000_000,
            };
        };
        pub const STP = packed struct(u32) {
            rt: u5,
            rn: u5,
            rt2: u5,
            imm7: i7,
            @"31:22": u10 = 0b1010_1001_00,

            pub const PRE = packed struct(u32) {
                rt: u5,
                rn: u5,
                rt2: u5,
                imm7: i7,
                @"31:22": u10 = 0b1010_1001_10,
            };
            pub const POST = packed struct(u32) {
                rt: u5,
                rn: u5,
                rt2: u5,
                imm7: i7,
                @"31:22": u10 = 0b1010_1000_10,
            };
        };
        pub const BR = packed struct(u32) {
            rm: u5 = 0b0000,
            rn: u5,
            @"31:10": u22 = 0b1101_0110_0001_1111_0000_00,
        };
        pub const BL = packed struct(u32) {
            imm26: i26,
            @"31:26": u6 = 0b100101,
        };
        pub const RET = packed struct(u32) {
            rm: u5 = 0,
            rn: u5,
            @"31:10": u22 = 0b1101011001011111000000,
        };
        pub const NOP = packed struct(u32) {
            @"31:0": u32 = 0b1101_0101_0000_0011_0010_0000_0001_1111,
        };

        add: ADD,
        sub: SUB,
        @"and": AND,
        mov: MOV,
        ldr: LDR,
        str: STR,
        br: BR,
        literal: usize,
    },
    .riscv32, .riscv64 => union(enum) {
        pub const ADDI = packed struct(u32) {
            @"6:0": u7 = 0b0010_011,
            rd: u5,
            @"14-12": u3 = 0b000,
            rs: u5,
            imm12: i12,

            pub const C = packed struct(u16) {
                @"1:0": u2 = 0b01,
                nzimm_0_4: u5,
                rd: u5,
                nzimm_5: i1,
                @"15:13": u3 = 0b000,

                pub const SP = packed struct(u16) {
                    @"1:0": u2 = 0b01,
                    nzimm_46875: u5,
                    @"11:7": u5 = 0b0001_0,
                    imm_9: i1,
                    @"15:13": u3 = 0b11,
                };
            };
        };
        pub const ADD = packed struct(u32) {
            @"6:0": u7 = 0b0110_011,
            rd: u5,
            @"14:12": u3 = 0b000,
            rs1: u5,
            rs2: u5,
            @"31:27": i7 = 0b0000_000,

            pub const C = packed struct(u16) {
                @"1:0": u2 = 0b10,
                rs: u5,
                rd: u5,
                @"15:12": u4 = 0b1000,
            };
        };
        pub const LUI = packed struct(u32) {
            @"6:0": u7 = 0b0110_111,
            rd: u5,
            imm20: i20,
        };
        pub const AUIPC = packed struct(u32) {
            @"6:0": u7 = 0b0010_111,
            rd: u5,
            imm20: i20,
        };
        pub const LD = packed struct(u32) {
            @"6:0": u7 = 0b0000_011,
            rd: u5,
            @"14:12": u3 = 0b011,
            rs: u5,
            imm12: i12,
        };
        pub const LW = packed struct(u32) {
            @"6:0": u7 = 0b0000_011,
            rd: u5,
            @"14:12": u3 = 0b010,
            rs: u5,
            imm12: i12,
        };
        pub const SD = packed struct(u32) {
            @"6:0": u7 = 0b0100_011,
            imm12_4_0: u5,
            @"14:12": u3 = 0b011,
            rs1: u5,
            rs2: u5,
            imm12_11_5: i7,
        };
        pub const SW = packed struct(u32) {
            @"6:0": u7 = 0b0100_011,
            imm12_4_0: u5,
            @"14:12": u3 = 0b010,
            rs1: u5,
            rs2: u5,
            imm12_11_5: i7,
        };
        pub const SUB = packed struct(u32) {
            @"6:0": u7 = 0b0110_011,
            rd: u5,
            @"14:12": u3 = 0b000,
            rs1: u5,
            rs2: u5,
            @"31:27": u7 = 0b0100_000,
        };
        pub const JALR = packed struct(u32) {
            @"6:0": u7 = 0b1100_111,
            rd: u5,
            @"14:0": u3 = 0b000,
            rs: u5,
            imm12: i12,

            pub const C = packed struct(u16) {
                @"6:0": u7 = 0b0000010,
                rs1: u5,
                @"15:12": u4 = 0b1000,
            };
        };
        pub const JAL = packed struct(u32) {
            @"6:0": u7 = 0b1101_111,
            rd: u5,
            @"offset19:12": u8,
            offset11: u1,
            @"offset10:1": u10,
            offset20: u1,
        };
        pub const NOP = packed struct(u32) {
            @"31:0": u32 = 0b0000_0000_0000_0000_0000_0000_0001_0011,

            pub const C = packed struct(u16) {
                @"15:0": u16 = 0b0000_0000_0000_0001,
            };
        };

        addi: ADDI,
        lui: LUI,
        auipc: AUIPC,
        ld: LD,
        lw: LW,
        sd: SD,
        sw: SW,
        add: ADD,
        sub: SUB,
        jalr: JALR,
        literal: usize,
    },
    .powerpc, .powerpcle, .powerpc64, .powerpc64le => union(enum) {
        pub const ADDI = packed struct(u32) {
            imm16: i16,
            ra: u5,
            rt: u5,
            @"31:26": u6 = 14,
        };
        pub const ADDIS = packed struct(u32) {
            imm16: i16,
            ra: u5,
            rt: u5,
            @"31:26": u6 = 15,
        };
        pub const ORI = packed struct(u32) {
            imm16: u16,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 24,
        };
        pub const ORIS = packed struct(u32) {
            imm16: u16,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 25,
        };
        pub const RLDIC = packed struct(u32) {
            rc: u1,
            sh2: u1,
            @"4:2": u3 = 2,
            mb: u6,
            sh: u5,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 30,
        };
        pub const LD = packed struct {
            @"1:0": u2 = 0,
            ds: i14,
            ra: u5,
            rt: u5,
            @"31:26": u6 = 58,
        };
        pub const LW = packed struct {
            ds: i16,
            ra: u5,
            rt: u5,
            @"31:26": u6 = 32,
        };
        pub const STD = packed struct {
            @"1:0": u2 = 0,
            ds: i14,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 62,
        };
        pub const STW = packed struct {
            ds: i16,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 36,
        };
        pub const STDU = packed struct {
            @"1:0": u2 = 1,
            ds: i14,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 62,
        };
        pub const STWU = packed struct {
            ds: i16,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 37,
        };
        pub const STDUX = packed struct {
            @"0": u1 = 0,
            @"10:1": i10 = 181,
            rb: u5,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 31,
        };
        pub const STWUX = packed struct {
            @"0": u1,
            @"10:1": i10 = 183,
            rb: u5,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 31,
        };
        pub const OR = packed struct(u32) {
            @"0": u1 = 0,
            @"9:1": u10 = 444,
            rb: u5,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 31,
        };
        pub const SUBFIC = packed struct(u32) {
            imm16: i16,
            ra: u5,
            rt: u5,
            @"31:26": u6 = 8,
        };
        pub const MTCTR = packed struct(u32) {
            @"0": u1 = 0,
            @"9:1": u10 = 467,
            spr: u10 = 0x120,
            rs: u5,
            @"31:26": u6 = 31,
        };
        pub const BCTRL = packed struct(u32) {
            lk: u1 = 0,
            @"10:1": u10 = 528,
            bh: u2 = 0b00000,
            @"15:13": u3 = 0,
            bi: u5 = 0b00000,
            bo: u5 = 0b10100,
            @"31:26": u6 = 19,
        };

        addi: ADDI,
        addis: ADDIS,
        ori: ORI,
        oris: ORIS,
        rldic: RLDIC,
        ld: LD,
        lw: LW,
        std: STD,
        stw: STW,
        stdu: STDU,
        stwu: STWU,
        stdux: STDUX,
        stwux: STWUX,
        @"or": OR,
        subfic: SUBFIC,
        mtctr: MTCTR,
        bctrl: BCTRL,
        literal: usize,
    },
    .arm => union(enum) {
        const LDR = packed struct(u32) {
            imm12: u12,
            rt: u4,
            rn: u4,
            @"31:20": u12 = 0b1110_0101_1001,
        };
        const STR = packed struct(u32) {
            imm12: u12,
            rt: u4,
            rn: u4,
            @"31:20": u12 = 0b1110_0101_1000,
        };
        const ADD = packed struct(u32) {
            imm12: u12,
            rd: u4,
            rn: u4,
            @"31:20": u12 = 0b1110_0010_1000,
        };
        const SUB = packed struct(u32) {
            imm12: u12,
            rd: u4,
            rn: u4,
            @"31:20": u12 = 0b1110_0010_0100,
        };
        const MOV = packed struct(u32) {
            rm: u4,
            @"11:4": u8 = 0,
            rd: u4,
            @"31:15": u16 = 0b1110_0001_1010_0000,
        };
        const BX = packed struct(u32) {
            rm: u4,
            flags: u4 = 0b0001,
            imm12: u12 = 0b1111_1111_1111,
            @"31:20": u12 = 0b1110_0001_0010,
        };
        const PUSH = packed struct(u32) {
            regs: u16,
            @"31:20": u16 = 0b1110_1001_0010_1101,
        };
        const NOP = packed struct(u32) {
            @"31:0": u32 = 0b1110_0011_0010_0000_1111_0000_0000_0000,
        };

        ldr: LDR,
        str: STR,
        sub: SUB,
        bx: BX,
        literal: usize,

        pub fn getNearestIMM12(value: u32) u12 {
            const last_one_pos: u32 = @ctz(value & ~@as(u32, 0xff));
            const rotations: u32 = (32 - last_one_pos + 1) / 2;
            if (rotations == 0) return @intCast(value);
            const shl: u5 = @intCast(rotations * 2);
            const shr: u5 = @intCast(32 - rotations * 2);
            const bits = (value << shl) | (value >> shr);
            return @intCast((rotations << 8) | (bits & 0xff));
        }

        pub fn decodeIMM12(encoded: u12) u32 {
            const bits: u32 = encoded & 0xff;
            const rotations: u32 = encoded >> 8;
            if (rotations == 0) return bits;
            const shl: u5 = @intCast(rotations * 2);
            const shr: u5 = @intCast(32 - rotations * 2);
            return (bits >> shl) | (bits << shr);
        }
    },
    else => void,
};

fn match(comptime ST: type, instr: anytype) ?ST {
    const instr_struct: ST = @bitCast(instr);
    return inline for (@typeInfo(ST).@"struct".fields) |field| {
        if (field.default_value_ptr) |opaque_ptr| {
            const ptr: *const field.type = @ptrCast(@alignCast(opaque_ptr));
            if (@field(instr_struct, field.name) != ptr.*) break null;
        }
    } else instr_struct;
}

const InstructionEncoder = struct {
    output: ?[]u8 = null,
    len: usize = 0,

    pub fn encode(self: *@This(), instr: Instruction) void {
        self.add(instr);
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
        } = .{};
        encoder.add(s);
        try expectEqual(123, @as(*align(1) u32, @ptrCast(&bytes[0])).*);
        try expectEqual(456, @as(*align(1) u32, @ptrCast(&bytes[4])).*);
    }

    fn write(self: *@This(), instr: anytype) void {
        const T = @TypeOf(instr);
        // get size of struct without alignment padding
        const size = @bitSizeOf(T) / 8;
        if (self.output) |buffer| {
            const bytes = std.mem.toBytes(instr);
            assert(self.len + size <= buffer.len);
            @memcpy(buffer[self.len .. self.len + size], bytes[0..size]);
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
        } = .{};
        encoder.write(s);
        try expectEqual(123, @as(*align(1) u32, @ptrCast(&bytes[0])).*);
        try expectEqual(456, @as(*align(1) u32, @ptrCast(&bytes[4])).*);
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

/// Duplicate of std.heap.PageAllocator that allocates pages with EXEC flag set.
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

test "bind (i64 x 3 + *i64 x 1)" {
    const ns = struct {
        fn add(a1: *i64, a2: i64, a3: i64, a4: i64) callconv(.c) void {
            a1.* = a2 + a3 + a4;
        }
    };
    var number: i64 = undefined;
    const vars = .{&number};
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    bf(1, 2, 3);
    try expectEqual(1 + 2 + 3, number);
}

test "bind ([no args] + i64 x 4)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64) i64 {
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
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn () i64, @TypeOf(bf));
    defer unbind(bf);
    const sum = bf();
    try expectEqual(1 + 2 + 3 + 4, sum);
}

test "bind (i64 x 1 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64) i64 {
            return a1 + a2;
        }
    };
    var number: i64 = 1234;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn (i64) i64, @TypeOf(bf));
    defer unbind(bf);
    const sum = bf(1);
    try expectEqual(1 + 1234, sum);
}

test "bind (i64 x 2 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64) i64 {
            return a1 + a2 + a3;
        }
    };
    var number: i64 = 1234;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn (i64, i64) i64, @TypeOf(bf));
    defer unbind(bf);
    const sum = bf(1, 2);
    try expectEqual(1 + 2 + 1234, sum);
}

test "bind (i64 x 3 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64) i64 {
            return a1 + a2 + a3 + a4;
        }
    };
    var number: i64 = 1234;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn (i64, i64, i64) i64, @TypeOf(bf));
    defer unbind(bf);
    const sum = bf(1, 2, 3);
    try expectEqual(1 + 2 + 3 + 1234, sum);
}

test "bind (i64 x 4 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64) i64 {
            return a1 + a2 + a3 + a4 + a5;
        }
    };
    var number: i64 = 5;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4);
    try expectEqual(1 + 2 + 3 + 4 + 5, sum);
}

test "bind (i64 x 5 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6;
        }
    };
    var number: i64 = 6;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6, sum);
}

test "bind (i64 x 6 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7;
        }
    };
    var number: i64 = 7;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7, sum);
}

test "bind (i64 x 7 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8;
        }
    };
    var number: i64 = 8;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8, sum);
}

test "bind (i64 x 8 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9;
        }
    };
    var number: i64 = 9;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9, sum);
}

test "bind (i64 x 9 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10;
        }
    };
    var number: i64 = 10;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10, sum);
}

test "bind (i64 x 10 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11;
        }
    };
    var number: i64 = 11;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11, sum);
}

test "bind (i64 x 11 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12;
        }
    };
    var number: i64 = 12;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12, sum);
}

test "bind (i64 x 12 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13;
        }
    };
    var number: i64 = 13;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13, sum);
}

test "bind (i64 x 13 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64, a14: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14;
        }
    };
    var number: i64 = 14;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14, sum);
}

test "bind (i64 x 14 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64, a14: i64, a15: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14 + a15;
        }
    };
    var number: i64 = 15;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15, sum);
}

test "bind (i64 x 15 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64, a14: i64, a15: i64, a16: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14 + a15 + a16;
        }
    };
    var number: i64 = 16;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15);
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16, sum);
}

test "bind ([no args] + i64 x 16)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64, a14: i64, a15: i64, a16: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14 + a15 + a16;
        }
    };
    var numbers: [16]i64 = .{ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 };
    _ = &numbers;
    const vars = .{
        numbers[0],
        numbers[1],
        numbers[2],
        numbers[3],
        numbers[4],
        numbers[5],
        numbers[6],
        numbers[7],
        numbers[8],
        numbers[9],
        numbers[10],
        numbers[11],
        numbers[12],
        numbers[13],
        numbers[14],
        numbers[15],
    };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf();
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16, sum);
}

test "bind (f64 x 3 + f64 x 1)" {
    const ns = struct {
        fn add(a1: f64, a2: f64, a3: f64, a4: f64) f64 {
            return a1 + a2 + a3 + a4;
        }
    };
    var number: f64 = 1234;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn (f64, f64, f64) f64, @TypeOf(bf));
    defer unbind(bf);
    const sum = bf(1, 2, 3);
    try expectEqual(1 + 2 + 3 + 1234, sum);
}

test "bind ([]const u8 x 1 + []const u8 x 1)" {
    const ns = struct {
        fn add(a1: []const u8, a2: []const u8) [2][]const u8 {
            return .{ a1, a2 };
        }
    };
    var string: []const u8 = "Basia";
    _ = &string;
    const vars = .{ .@"-1" = string };
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn (a1: []const u8) [2][]const u8, @TypeOf(bf));
    defer unbind(bf);
    const array = bf("Agnieszka");
    try expect(std.mem.eql(u8, array[0], "Agnieszka"));
    try expect(std.mem.eql(u8, array[1], "Basia"));
}

test "bind ([]const u8 x 3 + []const u8 x 1)" {
    const ns = struct {
        fn add(a1: []const u8, a2: []const u8, a3: []const u8, a4: []const u8) [4][]const u8 {
            return .{ a1, a2, a3, a4 };
        }
    };
    var string: []const u8 = "Dagmara";
    _ = &string;
    const vars = .{ .@"-1" = string };
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn (a1: []const u8, a2: []const u8, a3: []const u8) [4][]const u8, @TypeOf(bf));
    defer unbind(bf);
    const array = bf("Agnieszka", "Basia", "Czcibora");
    try expect(std.mem.eql(u8, array[0], "Agnieszka"));
    try expect(std.mem.eql(u8, array[1], "Basia"));
    try expect(std.mem.eql(u8, array[2], "Czcibora"));
    try expect(std.mem.eql(u8, array[3], "Dagmara"));
}

test "bind (@Vector(4, f64) x 3 + @Vector(4, f64) x 1)" {
    const ns = struct {
        fn add(a1: @Vector(4, f64), a2: @Vector(4, f64), a3: @Vector(4, f64), a4: @Vector(4, f64)) @Vector(4, f64) {
            return a1 + a2 + a3 + a4;
        }
    };
    var vector: @Vector(4, f64) = .{ 10, 20, 30, 40 };
    _ = &vector;
    const vars = .{ .@"-1" = vector };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(
        .{ 0.01, 0.02, 0.03, 0.04 },
        .{ 0.1, 0.2, 0.3, 0.4 },
        .{ 1, 2, 3, 4 },
    );
    try expectEqual(@Vector(4, f64){ 1.111e1, 2.222e1, 3.333e1, 4.444e1 }, sum);
}

test "bind (@Vector(4, f64) x 9 + @Vector(4, f64) x 1)" {
    const ns = struct {
        fn add(a1: @Vector(4, f64), a2: @Vector(4, f64), a3: @Vector(4, f64), a4: @Vector(4, f64), a5: @Vector(4, f64), a6: @Vector(4, f64), a7: @Vector(4, f64), a8: @Vector(4, f64), a9: @Vector(4, f64), a10: @Vector(4, f64)) @Vector(4, f64) {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10;
        }
    };
    var vector: @Vector(4, f64) = .{ 100000, 200000, 300000, 400000 };
    _ = &vector;
    const vars = .{ .@"-1" = vector };
    const bf = try bind(ns.add, vars);
    defer unbind(bf);
    const sum = bf(
        .{ 0.0001, 0.0002, 0.0003, 0.0004 },
        .{ 0.001, 0.002, 0.003, 0.004 },
        .{ 0.01, 0.02, 0.03, 0.04 },
        .{ 0.1, 0.2, 0.3, 0.4 },
        .{ 1, 2, 3, 4 },
        .{ 10, 20, 30, 40 },
        .{ 100, 200, 300, 400 },
        .{ 1000, 2000, 3000, 4000 },
        .{ 10000, 2000, 30000, 40000 },
    );
    try expectEqual(@Vector(4, f64){ 1.111111111e5, 2.042222222e5, 3.333333333e5, 4.444444444e5 }, sum);
}

test "bind ([12]f64 x 1 + [3]i32 x 1)" {
    const ns = struct {
        fn add(a: [3]i32, b: [12]f64) f64 {
            var int_sum: i32 = 0;
            var float_sum: f64 = 0;
            for (a) |v| int_sum += v;
            for (b) |v| float_sum += v;
            return float_sum + @as(f64, @floatFromInt(int_sum));
        }
    };
    var array: [3]i32 = .{ 10, 20, 30 };
    _ = &array;
    const vars = .{array};
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn ([12]f64) f64, @TypeOf(bf));
    defer unbind(bf);
    const sum = bf(.{ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 });
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 10 + 20 + 30, sum);
}

test "bind ([3]i32 x 1 + [12]f64 x 1)" {
    const ns = struct {
        fn add(a: [3]i32, b: [12]f64) f64 {
            var int_sum: i32 = 0;
            var float_sum: f64 = 0;
            for (a) |v| int_sum += v;
            for (b) |v| float_sum += v;
            return float_sum + @as(f64, @floatFromInt(int_sum));
        }
    };
    var array: [12]f64 = .{ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 };
    _ = &array;
    const vars = .{ .@"1" = array };
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn ([3]i32) f64, @TypeOf(bf));
    defer unbind(bf);
    const sum = bf(.{ 10, 20, 30 });
    try expectEqual(1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 10 + 20 + 30, sum);
}

test "bind (*i8 x 3 + *i8 x 1)" {
    const T = i8;
    const ns = struct {
        fn set(a1: *T, a2: *T, a3: *T, a4: *T) callconv(.c) void {
            a1.* = 123;
            a2.* = 123;
            a3.* = 123;
            a4.* = 123;
        }
    };
    var number1: T = undefined;
    var number2: T = undefined;
    var number3: T = undefined;
    var number4: T = undefined;
    const vars = .{&number4};
    const bf = try bind(ns.set, vars);
    defer unbind(bf);
    bf(&number1, &number2, &number3);
    try expectEqual(123, number1);
    try expectEqual(123, number2);
    try expectEqual(123, number3);
    try expectEqual(123, number4);
}

test "bind (*i16 x 3 + *i16 x 1)" {
    const T = i16;
    const ns = struct {
        fn set(a1: *T, a2: *T, a3: *T, a4: *T) callconv(.c) void {
            a1.* = 123;
            a2.* = 123;
            a3.* = 123;
            a4.* = 123;
        }
    };
    var number1: T = undefined;
    var number2: T = undefined;
    var number3: T = undefined;
    var number4: T = undefined;
    const vars = .{&number4};
    const bf = try bind(ns.set, vars);
    defer unbind(bf);
    bf(&number1, &number2, &number3);
    try expectEqual(123, number1);
    try expectEqual(123, number2);
    try expectEqual(123, number3);
    try expectEqual(123, number4);
}

test "bind (*i32 x 3 + *i32 x 1)" {
    const T = i32;
    const ns = struct {
        fn set(a1: *T, a2: *T, a3: *T, a4: *T) callconv(.c) void {
            a1.* = 123;
            a2.* = 123;
            a3.* = 123;
            a4.* = 123;
        }
    };
    var number1: T = undefined;
    var number2: T = undefined;
    var number3: T = undefined;
    var number4: T = undefined;
    const vars = .{&number4};
    const bf = try bind(ns.set, vars);
    defer unbind(bf);
    bf(&number1, &number2, &number3);
    try expectEqual(123, number1);
    try expectEqual(123, number2);
    try expectEqual(123, number3);
    try expectEqual(123, number4);
}

test "bind (*i64 x 3 + *i64 x 1)" {
    const T = i64;
    const ns = struct {
        fn set(a1: *T, a2: *T, a3: *T, a4: *T) callconv(.c) void {
            a1.* = 123;
            a2.* = 123;
            a3.* = 123;
            a4.* = 123;
        }
    };
    var number1: T = undefined;
    var number2: T = undefined;
    var number3: T = undefined;
    var number4: T = undefined;
    const vars = .{&number4};
    const bf = try bind(ns.set, vars);
    defer unbind(bf);
    bf(&number1, &number2, &number3);
    try expectEqual(123, number1);
    try expectEqual(123, number2);
    try expectEqual(123, number3);
    try expectEqual(123, number4);
}

test "bind (i64 x 1 + i64 x 1, comptime)" {
    const ns = struct {
        fn add(a1: i64, a2: i64) i64 {
            return a1 + a2;
        }
    };
    const number: i64 = 1234;
    const vars = .{ .@"-1" = number };
    const bf = comptime try bind(&ns.add, vars);
    try expectEqual(*const fn (i64) i64, @TypeOf(bf));
    defer unbind(bf);
    const sum = bf(1);
    try expectEqual(1 + 1234, sum);
}

test "bind (i64 x 1 + i64 x 1, pointer)" {
    const ns = struct {
        fn add(a1: i64, a2: i64) i64 {
            return a1 + a2;
        }
    };
    var number: i64 = 1234;
    _ = &number;
    const vars = .{ .@"-1" = number };
    var fn_ptr = &ns.add;
    _ = &fn_ptr;
    const bf = try bind(fn_ptr, vars);
    try expectEqual(*const fn (i64) i64, @TypeOf(bf));
    defer unbind(bf);
    const sum = bf(1);
    try expectEqual(1 + 1234, sum);
}

test "bound" {
    const ns = struct {
        fn add(a1: i64, a2: i64) i64 {
            return a1 + a2;
        }
    };
    var number: i64 = 1234;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const bf = try bind(ns.add, vars);
    try expectEqual(*const fn (i64) i64, @TypeOf(bf));
    defer unbind(bf);
    const sum1 = bf(1);
    try expectEqual(1 + 1234, sum1);
    const ctx_ptr = bound(@TypeOf(vars), bf) orelse return error.NotFound;
    protect(false);
    ctx_ptr.@"-1" = 4567;
    protect(true);
    const sum2 = bf(1);
    try expectEqual(1 + 4567, sum2);
}
