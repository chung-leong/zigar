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
                .aarch64 => 7,
                .riscv64 => 10,
                .powerpc64le => 12,
                .x86 => 4,
                .arm => 7,
                else => @compileError("No support"),
            };
            break :return_type [count]Instruction;
        } {
            const trampoline = getTrampoline();
            const trampoline_address = @intFromPtr(&trampoline);
            // find the displacement of self_address inside the trampoline function
            const self_address_offset = self_offset orelse init: {
                const offset = try findAddressOffset(&trampoline);
                self_offset = offset;
                break :init offset;
            };
            switch (builtin.target.cpu.arch) {
                .x86_64 => {
                    return .{
                        .{ // mov rax, self_address
                            .rex = .{},
                            .opcode = .mov_ax_imm,
                            .imm64 = self_address,
                        },
                        switch (self_address_offset >= std.math.minInt(i8) and self_address_offset <= std.math.maxInt(i8)) {
                            // mov [rsp + self_address_offset], rax
                            true => .{
                                .rex = .{},
                                .opcode = .mov_rm_r,
                                .mod_rm = .{ .rm = 4, .mod = 1, .reg = 0 },
                                .sib = .{ .base = 4, .index = 4 },
                                .disp8 = @truncate(self_address_offset),
                            },
                            false => .{
                                .rex = .{},
                                .opcode = .mov_rm_r,
                                .mod_rm = .{ .rm = 4, .mod = 2, .reg = 0 },
                                .sib = .{ .base = 4, .index = 4 },
                                .disp32 = @truncate(self_address_offset),
                            },
                        },
                        .{ // mov rax, trampoline_address
                            .rex = .{},
                            .opcode = .mov_ax_imm,
                            .imm64 = trampoline_address,
                        },
                        .{ // jmp [rax]
                            .rex = .{},
                            .opcode = .mux_rm,
                            .mod_rm = .{ .reg = 4, .mod = 3 },
                        },
                    };
                },
                .aarch64 => {
                    const offset_amount = -self_address_offset;
                    var base_offset: u12 = undefined;
                    var displacement: u12 = 0;
                    var shift: u1 = 0;
                    if (offset_amount <= 0xfff) {
                        base_offset = @intCast(offset_amount);
                    } else {
                        base_offset = @intCast(offset_amount >> 12);
                        displacement = @intCast(offset_amount & 0xfff);
                        shift = 1;
                    }
                    return .{
                        .{ // sub x10, sp, base_offset
                            .sub = .{
                                .rd = 10,
                                .rn = 31,
                                .imm12 = base_offset,
                                .shift = shift,
                            },
                        },
                        .{ // ldr x9, [pc + 16] (self_address)
                            .ldr = .{ .rt = 9, .imm19 = 4 },
                        },
                        .{ // str [x10 + displacement], x9
                            .str = .{ .rn = 10, .rt = 9, .imm12 = displacement },
                        },
                        .{ // ldr x9, [pc + 16] (trampoline_address)
                            .ldr = .{ .rt = 9, .imm19 = 2 + 2 },
                        },
                        .{ // br [x9]
                            .br = .{ .rn = 9 },
                        },
                        .{ .literal = self_address },
                        .{ .literal = trampoline_address },
                    };
                },
                .riscv64 => {
                    const offset = -self_address_offset;
                    return .{
                        .{ // lui x5, offset >> 12 + (sign adjustment)
                            .lui = .{ .rd = 5, .imm20 = @intCast((offset >> 12) + ((offset >> 11) & 1)) },
                        },
                        .{ // addi x5, (offset & 0xfff)
                            .addi = .{ .rd = 5, .rs = 0, .imm12 = @intCast(offset & 0xfff) },
                        },
                        .{ // sub x6, sp, x5
                            .sub = .{ .rd = 6, .rs1 = 2, .rs2 = 5 },
                        },
                        .{ // auipc x7, pc
                            .auipc = .{ .rd = 7, .imm20 = 0 },
                        },
                        .{ // ld x5, [x7 + 20] (self_address)
                            .ld = .{ .rd = 5, .rs = 7, .imm12 = @sizeOf(u32) * 5 + @sizeOf(usize) * 0 },
                        },
                        .{ // sd [x6], x5
                            .sd = .{ .rs1 = 6, .rs2 = 5, .imm12_4_0 = 0, .imm12_11_5 = 0 },
                        },
                        .{ // ld x5, [x7 + 28] (trampoline_address)
                            .ld = .{ .rd = 5, .rs = 7, .imm12 = @sizeOf(u32) * 5 + @sizeOf(usize) * 1 },
                        },
                        .{ // jmp [x5]
                            .jalr = .{ .rd = 0, .rs = 5, .imm12 = 0 },
                        },
                        .{ .literal = self_address },
                        .{ .literal = trampoline_address },
                    };
                },
                .powerpc64le => {
                    const code_address = self_address + @offsetOf(@This(), "code");
                    const code_addr_63_48: u16 = @truncate((code_address >> 48) & 0xffff);
                    const code_addr_47_32: u16 = @truncate((code_address >> 32) & 0xffff);
                    const code_addr_31_16: u16 = @truncate((code_address >> 16) & 0xffff);
                    const code_addr_15_0: u16 = @truncate((code_address >> 0) & 0xffff);
                    return .{
                        .{ // lis r11, code_addr_63_48
                            .addi = .{ .rt = 11, .ra = 0, .imm16 = @bitCast(code_addr_63_48) },
                        },
                        .{ // ori r11, r11, code_addr_47_32
                            .ori = .{ .ra = 11, .rs = 11, .imm16 = @bitCast(code_addr_47_32) },
                        },
                        .{ // rldic r11, r11, 32
                            .rldic = .{ .rs = 11, .ra = 11, .sh = 0, .sh2 = 1, .mb = 0, .rc = 0 },
                        },
                        .{ // oris r11, r11, code_addr_31_16
                            .oris = .{ .ra = 11, .rs = 11, .imm16 = @bitCast(code_addr_31_16) },
                        },
                        .{ // ori r11, r11, code_addr_15_0
                            .ori = .{ .ra = 11, .rs = 11, .imm16 = @bitCast(code_addr_15_0) },
                        },
                        .{ // ld r12, [r11 + 40] (self_address)
                            .ld = .{ .rt = 12, .ra = 11, .ds = 10 },
                        },
                        .{ // std [sp + self_address_offset], r12
                            .std = .{ .ra = 1, .rs = 12, .ds = @intCast(self_address_offset >> 2) },
                        },
                        .{ // ld r12, [r11 + 48] (trampoline_address)
                            .ld = .{ .rt = 12, .ra = 11, .ds = 12 },
                        },
                        .{ // mtctr r12
                            .mtctr = .{ .rs = 12 },
                        },
                        .{ // bctrl
                            .bctrl = .{},
                        },
                        .{ .literal = self_address },
                        .{ .literal = trampoline_address },
                    };
                },
                .x86 => {
                    return .{
                        .{ // mov eax, self_address
                            .opcode = Instruction.Opcode.mov_ax_imm,
                            .imm32 = self_address,
                        },
                        switch (self_address_offset >= std.math.minInt(i8) and self_address_offset <= std.math.maxInt(i8)) {
                            // mov [esp + self_address_offset], eax
                            true => .{
                                .opcode = Instruction.Opcode.mov_rm_r,
                                .mod_rm = .{ .rm = 4, .mod = 1, .reg = 0 },
                                .sib = .{ .base = 4, .index = 4 },
                                .disp8 = @truncate(self_address_offset),
                            },
                            false => .{
                                .opcode = Instruction.Opcode.mov_rm_r,
                                .mod_rm = .{ .rm = 4, .mod = 2, .reg = 0 },
                                .sib = .{ .base = 4, .index = 4 },
                                .disp32 = @truncate(self_address_offset),
                            },
                        },
                        .{ // mov eax, trampoline_address
                            .opcode = Instruction.Opcode.mov_ax_imm,
                            .imm32 = trampoline_address,
                        },
                        .{ // jmp [eax]
                            .opcode = Instruction.Opcode.mux_rm,
                            .mod_rm = .{ .reg = 4, .mod = 3 },
                        },
                    };
                },
                .arm => {
                    const offset_amount: u32 = @abs(self_address_offset);
                    const base_offset = Instruction.getNearestIMM12(offset_amount);
                    const remainder = offset_amount - Instruction.decodeIMM12(base_offset);
                    const displacement = Instruction.getNearestIMM12(remainder);
                    return .{
                        .{ // sub r5, sp, offset
                            .sub = .{
                                .rd = 5,
                                .rn = 13,
                                .imm12 = base_offset,
                            },
                        },
                        .{ // ldr r4, [pc + 8] (self_address)
                            .ldr = .{ .rt = 4, .rn = 15, .imm12 = @sizeOf(u32) * 2 },
                        },
                        .{ // str [r5], r4
                            .str = .{ .rn = 5, .rt = 4, .imm12 = displacement },
                        },
                        .{ // ldr r4, [pc + 4] (trampoline_address)
                            .ldr = .{ .rt = 4, .rn = 15, .imm12 = @sizeOf(u32) },
                        },
                        .{ // bx [r4]
                            .bx = .{ .rm = 4 },
                        },
                        .{ .literal = self_address },
                        .{ .literal = trampoline_address },
                    };
                },
                else => unreachable,
            }
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
                    insertNOPs(&self_address);
                    const self: *const Self = @ptrFromInt(self_address);
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

        inline fn insertNOPs(ptr: *const anyopaque) void {
            const asm_code =
                \\ nop
                \\ nop
                \\ nop
            ;
            switch (builtin.target.cpu.arch) {
                .x86_64 => asm volatile (asm_code
                    :
                    : [arg1] "{rax}" (ptr),
                ),
                .aarch64 => asm volatile (asm_code
                    :
                    : [arg1] "{x9}" (ptr),
                ),
                .riscv64 => asm volatile (asm_code
                    :
                    : [arg1] "{x5}" (ptr),
                ),
                .powerpc64le => asm volatile (
                // actual nop's would get reordered for some reason despite the use of "volatile"
                    \\ li %r0, %r0
                    \\ li %r0, %r0
                    \\ li %r0, %r0        
                    :
                    : [arg1] "{r11}" (ptr),
                ),
                .x86 => asm volatile (asm_code
                    :
                    : [arg1] "{eax}" (ptr),
                ),
                .arm => asm volatile (asm_code
                    :
                    : [arg1] "{r4}" (ptr),
                ),
                else => unreachable,
            }
        }

        fn findAddressOffset(ptr: *const anyopaque) !isize {
            switch (builtin.target.cpu.arch) {
                .x86, .x86_64 => {
                    const instrs: [*]const u8 = @ptrCast(ptr);
                    const nop = @intFromEnum(Instruction.Opcode.nop);
                    const sp = 4;
                    var i: usize = 0;
                    var registers = [1]isize{0} ** 16;
                    while (i < 262144) {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            // std.debug.print("registers: {d}\n", .{registers});
                            return registers[0];
                        } else {
                            const instr, const attrs, const len = Instruction.decode(instrs[i..]);
                            // std.debug.print("{any} {d}\n", .{ instr.opcode, attrs.stack_change });
                            if (instr.getMod()) |mod| {
                                switch (instr.opcode) {
                                    .mov_rm_r => if (mod == 3) {
                                        const rs = instr.getReg();
                                        const rd = instr.getRM();
                                        registers[rd] = registers[rs];
                                    },
                                    .lea_rm_r => if (mod == 1) {
                                        const disp = instr.getDisp();
                                        const rs = instr.getRM();
                                        const rd = instr.getReg();
                                        registers[rd] = registers[rs] + disp;
                                    },
                                    else => {},
                                }
                            }
                            registers[sp] += attrs.stack_change * 8;
                            i += len;
                        }
                    }
                },
                .aarch64 => {
                    const instrs: [*]const u32 = @ptrCast(@alignCast(ptr));
                    const nop: u32 = @bitCast(Instruction.NOP{});
                    var registers: [32]isize = .{0} ** 32;
                    for (0..65536) |i| {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            return registers[9];
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
                            }
                        }
                    }
                },
                .riscv64 => {
                    const instrs: [*]const u16 = @ptrCast(@alignCast(ptr));
                    const nop: u16 = @bitCast(Instruction.NOP.C{});
                    var registers: [32]isize = .{0} ** 32;
                    var i: usize = 0;
                    while (i < 131072) : (i += 1) {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            return registers[5];
                        } else if (instrs[i] & 3 == 3) {
                            const instr32_ptr: *align(@alignOf(u16)) const u32 = @ptrCast(&instrs[i]);
                            const instr = instr32_ptr.*;
                            i += 1;
                            if (match(Instruction.ADDI, instr)) |addi| {
                                const amount: isize = addi.imm12;
                                registers[addi.rd] = registers[addi.rs] + amount;
                            }
                        } else {
                            const instr = instrs[i];
                            if (match(Instruction.ADDI.C, instr)) |addi| {
                                const int: packed struct(isize) {
                                    @"0:4": u5,
                                    @"5:63": i59,
                                } = .{ .@"0:4" = addi.nzimm_0_4, .@"5:63" = -@as(i55, addi.nzimm_5) };
                                const amount: isize = @bitCast(int);
                                registers[addi.rd] = registers[addi.rd] + amount;
                            } else if (match(Instruction.ADDI.C.SP, instr)) |addisp| {
                                const int: packed struct(isize) {
                                    @"0:3": u4 = 0,
                                    @"4": u1,
                                    @"5": u1,
                                    @"6": u1,
                                    @"7:8": u2,
                                    @"9:63": i55,
                                } = .{
                                    .@"5" = @intCast((addisp.nzimm_46875 >> 0) & 0x01),
                                    .@"7:8" = @intCast((addisp.nzimm_46875 >> 1) & 0x03),
                                    .@"6" = @intCast((addisp.nzimm_46875 >> 3) & 0x01),
                                    .@"4" = @intCast((addisp.nzimm_46875 >> 4) & 0x01),
                                    .@"9:63" = addisp.imm_9,
                                };
                                const amount: isize = @bitCast(int);
                                registers[2] = registers[2] + amount;
                            } else if (match(Instruction.ADD.C, instr)) |add| {
                                // compressed form of ADD is actual a MOV
                                registers[add.rd] = registers[add.rs];
                            }
                        }
                    }
                },
                .powerpc64le => {
                    const instrs: [*]const u32 = @ptrCast(@alignCast(ptr));
                    // li 0, 0 is used as nop instead of regular nop
                    const nop: u32 = @bitCast(Instruction.ADDI{ .ra = 0, .rt = 0, .imm16 = 0 });
                    var registers: [32]isize = .{0} ** 32;
                    for (0..65536) |i| {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            return registers[11];
                        } else {
                            const instr = instrs[i];
                            if (match(Instruction.ADDI, instr)) |addi| {
                                registers[addi.rt] = registers[addi.ra] + addi.imm16;
                            } else if (match(Instruction.STDU, instr)) |stdu| {
                                registers[stdu.ra] += @as(isize, stdu.ds) << 2;
                            } else if (match(Instruction.OR, instr)) |@"or"| {
                                if (@"or".rb == @"or".rs) { // => mr ra rs
                                    registers[@"or".ra] = registers[@"or".rs];
                                }
                            }
                        }
                    }
                },
                .arm => {
                    const instrs: [*]const u32 = @ptrCast(@alignCast(ptr));
                    const nop: u32 = @bitCast(Instruction.NOP{});
                    var registers: [32]isize = .{0} ** 32;
                    for (0..65536) |i| {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            return registers[4];
                        } else {
                            const instr = instrs[i];
                            if (match(Instruction.ADD, instr)) |add| {
                                const amount: isize = @intCast(Instruction.decodeIMM12(add.imm12));
                                registers[add.rd] = registers[add.rn] + amount;
                            } else if (match(Instruction.SUB, instr)) |sub| {
                                const amount: isize = @intCast(Instruction.decodeIMM12(sub.imm12));
                                registers[sub.rd] = registers[sub.rn] - amount;
                            } else if (match(Instruction.PUSH, instr)) |push| {
                                const count: isize = @popCount(push.regs);
                                registers[13] -= count * 4;
                            }
                        }
                    }
                },
                else => unreachable,
            }

            return error.Unexpected;
        }
    };
}

test "Binding (i64 x 3 + *i64 x 1)" {
    const ns = struct {
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
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    try expect(@TypeOf(bf) == *const fn () i64);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum1 = bf();
    try expect(sum1 == 1 + 2 + 3 + 4);
}

test "Binding (i64 x 3 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64) i64 {
            return a1 + a2 + a3 + a4;
        }
    };
    var number: i64 = 1234;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    try expect(@TypeOf(bf) == *const fn (i64, i64, i64) i64);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum1 = bf(1, 2, 3);
    try expect(sum1 == 1 + 2 + 3 + 1234);
}

test "Binding (i64 x 4 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64) i64 {
            return a1 + a2 + a3 + a4 + a5;
        }
    };
    var number: i64 = 5;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4);
    try expect(sum == 1 + 2 + 3 + 4 + 5);
}

test "Binding (i64 x 5 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6;
        }
    };
    var number: i64 = 6;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6);
}

test "Binding (i64 x 6 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64) i64 {
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

test "Binding (i64 x 7 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8;
        }
    };
    var number: i64 = 8;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8);
}

test "Binding (i64 x 8 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9;
        }
    };
    var number: i64 = 9;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9);
}

test "Binding (i64 x 9 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64) i64 {
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

test "Binding (i64 x 10 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11;
        }
    };
    var number: i64 = 11;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11);
}

test "Binding (i64 x 11 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12;
        }
    };
    var number: i64 = 12;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12);
}

test "Binding (i64 x 12 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64) i64 {
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

test "Binding (i64 x 13 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64, a14: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14;
        }
    };
    var number: i64 = 14;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14);
}

test "Binding (i64 x 14 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64, a14: i64, a15: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14 + a15;
        }
    };
    var number: i64 = 15;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15);
}

test "Binding (i64 x 15 + i64 x 1)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64, a14: i64, a15: i64, a16: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14 + a15 + a16;
        }
    };
    var number: i64 = 16;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15);
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16);
}

test "Binding ([no args] + i64 x 16)" {
    const ns = struct {
        fn add(a1: i64, a2: i64, a3: i64, a4: i64, a5: i64, a6: i64, a7: i64, a8: i64, a9: i64, a10: i64, a11: i64, a12: i64, a13: i64, a14: i64, a15: i64, a16: i64) i64 {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12 + a13 + a14 + a15 + a16;
        }
    };
    const vars = .{ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf();
    try expect(sum == 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16);
}

test "Binding (f64 x 3 + f64 x 1)" {
    const ns = struct {
        fn add(a1: f64, a2: f64, a3: f64, a4: f64) f64 {
            return a1 + a2 + a3 + a4;
        }
    };
    var number: f64 = 1234;
    _ = &number;
    const vars = .{ .@"-1" = number };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    try expect(@TypeOf(bf) == *const fn (f64, f64, f64) f64);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum1 = bf(1, 2, 3);
    try expect(sum1 == 1 + 2 + 3 + 1234);
}

test "Binding ([]const u8 x 1 + []const u8 x 1)" {
    const ns = struct {
        fn add(a1: []const u8, a2: []const u8) [2][]const u8 {
            return .{ a1, a2 };
        }
    };
    var string: []const u8 = "Basia";
    _ = &string;
    const vars = .{ .@"-1" = string };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    try expect(@TypeOf(bf) == *const fn (a1: []const u8) [2][]const u8);
    defer _ = Add.unbind(ea.allocator(), bf);
    const array = bf("Agnieszka");
    try expect(std.mem.eql(u8, array[0], "Agnieszka"));
    try expect(std.mem.eql(u8, array[1], "Basia"));
}

test "Binding ([]const u8 x 3 + []const u8 x 1)" {
    const ns = struct {
        fn add(a1: []const u8, a2: []const u8, a3: []const u8, a4: []const u8) [4][]const u8 {
            return .{ a1, a2, a3, a4 };
        }
    };
    var string: []const u8 = "Dagmara";
    _ = &string;
    const vars = .{ .@"-1" = string };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    try expect(@TypeOf(bf) == *const fn (a1: []const u8, a2: []const u8, a3: []const u8) [4][]const u8);
    defer _ = Add.unbind(ea.allocator(), bf);
    const array = bf("Agnieszka", "Basia", "Czcibora");
    try expect(std.mem.eql(u8, array[0], "Agnieszka"));
    try expect(std.mem.eql(u8, array[1], "Basia"));
    try expect(std.mem.eql(u8, array[2], "Czcibora"));
    try expect(std.mem.eql(u8, array[3], "Dagmara"));
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
            add_rm8_r8 = 0x00,
            add_rm_r = 0x01,
            add_r8_rm8 = 0x02,
            add_r_rm = 0x03,
            add_ax_imm8 = 0x04,
            add_ax_imm32 = 0x05,
            or_ax_imm8 = 0x0c,
            or_ax_imm32 = 0x0d,
            ext_imm8 = 0x0f,
            adc_rm8_r8 = 0x10,
            adc_rm_r = 0x11,
            adc_r8_rm8 = 0x12,
            adc_r_rm = 0x13,
            adc_ax_imm8 = 0x14,
            adc_ax_imm32 = 0x15,
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
            xop_imm16 = 0x8f,
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
            vex_imm16 = 0xc4,
            vex_imm8 = 0xc5,
            enter_imm16_imm8 = 0xc8,
            leave = 0xc9,
            ret = 0xc3,
            mov_rm_imm32 = 0xc7,
            call_immh = 0xe8,
            jmp_immh = 0xe9,
            jmp_imm8 = 0xeb,
            clc = 0xf8,
            mux_rm = 0xff,
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
            f2 = 0xf2,
            f3 = 0xf3,
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

        const Attributes = packed struct {
            stack_change: i8 = 0,
            has_mod_rm: bool = false,
            has_imm8: bool = false,
            has_imm16: bool = false,
            has_imm32: bool = false,
            has_imm64: bool = false,
        };
        const attribute_table = init: {
            @setEvalBranchQuota(200000);
            var table: [256]Attributes = undefined;
            for (@typeInfo(Opcode).@"enum".fields) |field| {
                var attrs: Attributes = .{};
                const name = field.name;
                if (std.mem.containsAtLeast(u8, name, 1, "_r")) {
                    attrs.has_mod_rm = true;
                }
                if (std.mem.endsWith(u8, name, "imm8")) {
                    attrs.has_imm8 = true;
                } else if (std.mem.endsWith(u8, name, "imm32")) {
                    attrs.has_imm32 = true;
                } else if (std.mem.endsWith(u8, name, "imm")) {
                    switch (@bitSizeOf(usize)) {
                        64 => attrs.has_imm64 = true,
                        else => attrs.has_imm32 = true,
                    }
                } else if (std.mem.endsWith(u8, name, "immh")) {
                    switch (@bitSizeOf(usize)) {
                        64 => attrs.has_imm32 = true,
                        else => attrs.has_imm16 = true,
                    }
                }
                if (std.mem.containsAtLeast(u8, name, 1, "_imm16")) {
                    attrs.has_imm16 = true;
                }
                if (std.mem.startsWith(u8, name, "push_")) {
                    if (std.mem.endsWith(u8, name, "_all")) {
                        attrs.stack_change = switch (@bitSizeOf(usize)) {
                            64 => -16,
                            else => -8,
                        };
                    } else attrs.stack_change = -1;
                } else if (std.mem.startsWith(u8, name, "pop_")) {
                    if (std.mem.endsWith(u8, name, "_all")) {
                        attrs.stack_change = switch (@bitSizeOf(usize)) {
                            64 => 16,
                            else => 8,
                        };
                    } else attrs.stack_change = 1;
                }
                const index: usize = field.value;
                table[index] = attrs;
            }
            break :init table;
        };

        pub fn decode(bytes: [*]const u8) std.meta.Tuple(&.{ @This(), Attributes, usize }) {
            var i: usize = 0;
            var instr: @This() = .{};
            if (std.meta.intToEnum(Prefix, bytes[i]) catch null) |prefix| {
                i += 1;
                instr.prefix = prefix;
            }
            if (@bitSizeOf(usize) == 64) {
                const rex: REX = @bitCast(bytes[i]);
                if (rex.pat == 4) {
                    i += 1;
                    instr.rex = rex;
                }
            }
            const attrs = attribute_table[bytes[i]];
            instr.opcode = @enumFromInt(bytes[i]);
            i += 1;
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
            if (attrs.has_imm64) {
                instr.imm64 = std.mem.bytesToValue(u64, bytes[i .. i + 8]);
                i += 8;
            } else if (attrs.has_imm32) {
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

        prefix: ?Prefix = null,
        rex: ?REX = null,
        opcode: Opcode = .nop,
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
        pub const NOP = packed struct(u32) {
            @"31:0": u32 = 0b1101_0101_0000_0011_0010_0000_0001_1111,
        };

        add: ADD,
        sub: SUB,
        mov: MOV,
        ldr: LDR,
        str: STR,
        br: BR,
        literal: usize,
    },
    .riscv64 => union(enum) {
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
                nzimm_5: u1,
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
                @"1:0": u2 = 0b00,
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
        pub const SD = packed struct(u32) {
            @"6:0": u7 = 0b0100_011,
            imm12_4_0: u5,
            @"14:12": u3 = 0b011,
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
        sd: SD,
        sub: SUB,
        jalr: JALR,
        literal: usize,
    },
    .powerpc64le => union(enum) {
        pub const ADDI = packed struct(u32) {
            imm16: i16,
            ra: u5,
            rt: u5,
            @"31:26": u6 = 14,
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
        pub const STD = packed struct {
            @"1:0": u2 = 0,
            ds: i14,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 62,
        };
        pub const STDU = packed struct {
            @"1:0": u2 = 1,
            ds: i14,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 62,
        };
        pub const OR = packed struct(u32) {
            @"0": u1 = 0,
            @"9:1": u10 = 444,
            rb: u5,
            ra: u5,
            rs: u5,
            @"31:26": u6 = 31,
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
        ori: ORI,
        oris: ORIS,
        rldic: RLDIC,
        ld: LD,
        std: STD,
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
            const rotations: u32 = (32 - last_one_pos + 1) >> 1;
            if (rotations == 0) return @intCast(value);
            const bits = value >> @intCast((32 - (2 * rotations))) & 0xff;
            return @intCast(rotations << 8 | bits);
        }

        pub fn decodeIMM12(encoded: u12) u32 {
            const rotations: u32 = encoded >> 8;
            const bits: u32 = encoded & 0xff;
            return if (rotations > 0) bits << @intCast((32 - (2 * rotations))) else bits;
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
