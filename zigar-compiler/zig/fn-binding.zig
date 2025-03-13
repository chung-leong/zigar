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
    const AddressPosition = struct { offset: isize, stack_offset: isize, stack_align_mask: ?isize };
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
        var self_address_pos: ?AddressPosition = null;

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
                var encoder: InstructionEncoder = .{};
                try writeInstructions(&encoder, 0);
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
            const output_ptr = @as([*]u8, @ptrCast(&self.code));
            var encoder: InstructionEncoder = .{ .output = output_ptr[0..len] };
            try writeInstructions(&encoder, self_address);
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

        fn writeInstructions(encoder: *InstructionEncoder, self_address: usize) !void {
            const trampoline = getTrampoline();
            const trampoline_address = @intFromPtr(&trampoline);
            // find the offset of self_address inside the trampoline function
            const address_pos = self_address_pos orelse init: {
                const offset = try findAddressPosition(&trampoline);
                self_address_pos = offset;
                break :init offset;
            };
            switch (builtin.target.cpu.arch) {
                .x86_64 => {
                    // mov rax, self_address
                    encoder.encode(.{
                        .rex = .{},
                        .opcode = .@"mov ax imm32/64",
                        .imm64 = self_address,
                    });
                    if (address_pos.stack_align_mask) |mask| {
                        // mov r11, rsp
                        encoder.encode(.{
                            .rex = .{ .b = 1 },
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 3, .mod = 3, .reg = 4 },
                        });
                        // add rsp, address_pos.stack_offset
                        encoder.encode(.{
                            .rex = .{},
                            .opcode = .@"add/or/etc r/m imm32",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 0 },
                            .imm32 = @bitCast(@as(i32, @truncate(address_pos.stack_offset))),
                        });
                        // and rsp, mask
                        encoder.encode(.{
                            .rex = .{},
                            .opcode = .@"add/or/etc r/m imm8",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 4 },
                            .imm8 = @bitCast(@as(i8, @truncate(mask))),
                        });
                    }
                    // mov [rsp + address_pos.offset], rax
                    if (address_pos.offset >= std.math.minInt(i8) and address_pos.offset <= std.math.maxInt(i8)) {
                        encoder.encode(.{
                            .rex = .{},
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 1, .reg = 0 },
                            .sib = .{ .base = 4, .index = 4, .scale = 0 },
                            .disp8 = @truncate(address_pos.offset),
                        });
                    } else {
                        encoder.encode(.{
                            .rex = .{},
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 2, .reg = 0 },
                            .sib = .{ .base = 4, .index = 4, .scale = 0 },
                            .disp32 = @truncate(address_pos.offset),
                        });
                    }
                    if (address_pos.stack_align_mask) |_| {
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
                    if (address_pos.stack_align_mask) |mask| {
                        encoder.encode(.{
                            .sub = .{
                                .rd = 11,
                                .rn = 31,
                                .imm12 = 0,
                                .shift = 0,
                            },
                        });

                        // sub x10, sp, -address_pos.stack_offset
                        encoder.encode(.{
                            .sub = .{
                                .rd = 10,
                                .rn = 31,
                                .imm12 = @truncate(@as(usize, @bitCast(-address_pos.stack_offset))),
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
                        // add x10, x10, address_pos.offset
                        encoder.encode(.{
                            .add = .{
                                .rd = 10,
                                .rn = 10,
                                .imm12 = @truncate(@as(usize, @bitCast(address_pos.offset))),
                                .shift = 0,
                            },
                        });
                    } else {
                        // sub x10, sp, -address_pos.offset
                        encoder.encode(.{
                            .sub = .{
                                .rd = 10,
                                .rn = 31,
                                .imm12 = @truncate(@as(usize, @bitCast(-address_pos.offset))),
                                .shift = 0,
                            },
                        });
                    }
                    // ldr x9, [pc + 16] (self_address)
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
                    encoder.encode(.{ .literal = self_address });
                    encoder.encode(.{ .literal = trampoline_address });
                },
                .riscv64 => {
                    const offset = -address_pos.offset;
                    // lui x5, offset >> 12 + (sign adjustment)
                    encoder.encode(.{
                        .lui = .{ .rd = 5, .imm20 = @intCast((offset >> 12) + ((offset >> 11) & 1)) },
                    });
                    // addi x5, (offset & 0xfff)
                    encoder.encode(.{
                        .addi = .{ .rd = 5, .rs = 0, .imm12 = @intCast(offset & 0xfff) },
                    });
                    // sub x6, sp, x5
                    encoder.encode(.{
                        .sub = .{ .rd = 6, .rs1 = 2, .rs2 = 5 },
                    });
                    // auipc x7, pc
                    encoder.encode(.{
                        .auipc = .{ .rd = 7, .imm20 = 0 },
                    });
                    // ld x5, [x7 + 20] (self_address)
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
                    encoder.encode(.{ .literal = self_address });
                    encoder.encode(.{ .literal = trampoline_address });
                },
                .powerpc64le => {
                    const code_address = self_address + @offsetOf(@This(), "code");
                    const code_addr_63_48: u16 = @truncate((code_address >> 48) & 0xffff);
                    const code_addr_47_32: u16 = @truncate((code_address >> 32) & 0xffff);
                    const code_addr_31_16: u16 = @truncate((code_address >> 16) & 0xffff);
                    const code_addr_15_0: u16 = @truncate((code_address >> 0) & 0xffff);
                    // lis r11, code_addr_63_48
                    encoder.encode(.{
                        .addi = .{ .rt = 11, .ra = 0, .imm16 = @bitCast(code_addr_63_48) },
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
                    // ld r12, [r11 + 40] (self_address)
                    encoder.encode(.{
                        .ld = .{ .rt = 12, .ra = 11, .ds = 10 },
                    });
                    // std [sp + address_pos.offset], r12
                    encoder.encode(.{
                        .std = .{ .ra = 1, .rs = 12, .ds = @intCast(address_pos.offset >> 2) },
                    });
                    // ld r12, [r11 + 48] (trampoline_address)
                    encoder.encode(.{
                        .ld = .{ .rt = 12, .ra = 11, .ds = 12 },
                    });
                    // mtctr r12
                    encoder.encode(.{
                        .mtctr = .{ .rs = 12 },
                    });
                    // bctrl
                    encoder.encode(.{
                        .bctrl = .{},
                    });
                    encoder.encode(.{ .literal = self_address });
                    encoder.encode(.{ .literal = trampoline_address });
                },
                .x86 => {
                    // mov eax, self_address
                    encoder.encode(.{
                        .opcode = .@"mov ax imm32/64",
                        .imm32 = self_address,
                    });
                    if (address_pos.stack_align_mask) |mask| {
                        // mov ecx, esp
                        encoder.encode(.{
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 1, .mod = 3, .reg = 4 },
                        });
                        // add esp, address_pos.stack_offset
                        encoder.encode(.{
                            .opcode = .@"add/or/etc r/m imm32",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 0 },
                            .imm32 = @bitCast(@as(i32, @truncate(address_pos.stack_offset))),
                        });
                        // and esp, mask
                        encoder.encode(.{
                            .opcode = .@"add/or/etc r/m imm8",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 4 },
                            .imm8 = @bitCast(@as(i8, @truncate(mask))),
                        });
                    }
                    // mov [esp + address_pos.offset], eax
                    if (address_pos.offset >= std.math.minInt(i8) and address_pos.offset <= std.math.maxInt(i8)) {
                        encoder.encode(.{
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 1, .reg = 0 },
                            .sib = .{ .base = 4, .index = 4, .scale = 0 },
                            .disp8 = @truncate(address_pos.offset),
                        });
                    } else {
                        encoder.encode(.{
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 2, .reg = 0 },
                            .sib = .{ .base = 4, .index = 4, .scale = 0 },
                            .disp32 = @truncate(address_pos.offset),
                        });
                    }
                    if (address_pos.stack_align_mask) |_| {
                        // mov esp, ecx
                        encoder.encode(.{
                            .opcode = .@"mov r/m r",
                            .mod_rm = .{ .rm = 4, .mod = 3, .reg = 1 },
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
                    const offset_amount: u32 = @abs(address_pos.offset);
                    const base_offset = Instruction.getNearestIMM12(offset_amount);
                    const remainder = offset_amount - Instruction.decodeIMM12(base_offset);
                    const displacement = Instruction.getNearestIMM12(remainder);
                    // sub r5, sp, offset
                    encoder.encode(.{
                        .sub = .{
                            .rd = 5,
                            .rn = 13,
                            .imm12 = base_offset,
                        },
                    });
                    // ldr r4, [pc + 8] (self_address)
                    encoder.encode(.{
                        .ldr = .{ .rt = 4, .rn = 15, .imm12 = @sizeOf(u32) * 2 },
                    });
                    // str [r5], r4
                    encoder.encode(.{
                        .str = .{ .rn = 5, .rt = 4, .imm12 = displacement },
                    });
                    // ldr r4, [pc + 4] (trampoline_address)
                    encoder.encode(.{
                        .ldr = .{ .rt = 4, .rn = 15, .imm12 = @sizeOf(u32) },
                    });
                    // bx [r4]
                    encoder.encode(.{
                        .bx = .{ .rm = 4 },
                    });
                    encoder.encode(.{ .literal = self_address });
                    encoder.encode(.{ .literal = trampoline_address });
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
                    // using a two-element array to ensure the compiler doesn't attempt to keep it in register
                    var self_address: [2]usize = undefined;
                    // insert nop x 3 so we can find the displacement for self_address in the instruction stream
                    insertNOPs(&self_address);
                    const self: *const Self = @ptrFromInt(self_address[0]);
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
                    : [arg] "{rax}" (ptr),
                ),
                .aarch64 => asm volatile (asm_code
                    :
                    : [arg] "{x9}" (ptr),
                ),
                .riscv64 => asm volatile (asm_code
                    :
                    : [arg] "{x5}" (ptr),
                ),
                .powerpc64le => asm volatile (
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

        fn findAddressPosition(ptr: *const anyopaque) !AddressPosition {
            var stack_align_mask: ?isize = null;
            var stack_offset: isize = 0;
            var index: ?isize = null;
            switch (builtin.target.cpu.arch) {
                .x86, .x86_64 => {
                    const instrs: [*]const u8 = @ptrCast(ptr);
                    const nop = @intFromEnum(Instruction.Opcode.nop);
                    const sp = 4;
                    var registers = [1]isize{0} ** 16;
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
                            const size_one: isize = @sizeOf(usize);
                            const size_all: isize = size_one * size_one * 2;
                            if (attrs.pushes) {
                                registers[sp] -= if (attrs.affects_all) size_all else size_one;
                            } else if (attrs.pops) {
                                registers[sp] -= if (attrs.affects_all) size_all else size_one;
                            }
                        }
                    }
                },
                .aarch64 => {
                    const instrs: [*]const u32 = @ptrCast(@alignCast(ptr));
                    const nop: u32 = @bitCast(Instruction.NOP{});
                    var registers = [1]isize{0} ** 32;
                    for (0..65536) |i| {
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
                            }
                        }
                    }
                },
                .riscv64 => {
                    const instrs: [*]const u16 = @ptrCast(@alignCast(ptr));
                    const nop: u16 = @bitCast(Instruction.NOP.C{});
                    var registers = [1]isize{0} ** 32;
                    var i: usize = 0;
                    while (i < 131072) : (i += 1) {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            index = registers[5];
                            break;
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
                    var registers = [1]isize{0} ** 32;
                    for (0..65536) |i| {
                        if (instrs[i] == nop and instrs[i + 1] == nop and instrs[i + 2] == nop) {
                            index = registers[11];
                            break;
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

test "Binding (i64 x 3 + *i64 x 1)" {
    const ns = struct {
        fn add(a1: *i64, a2: i64, a3: i64, a4: i64) callconv(.c) void {
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
    const sum = bf();
    try expect(sum == 1 + 2 + 3 + 4);
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
    const sum = bf(1, 2, 3);
    try expect(sum == 1 + 2 + 3 + 1234);
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
    const sum = bf(1, 2, 3);
    try expect(sum == 1 + 2 + 3 + 1234);
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

test "Binding (@Vector(4, f64) x 3 + @Vector(4, f64) x 1)" {
    const ns = struct {
        fn add(a1: @Vector(4, f64), a2: @Vector(4, f64), a3: @Vector(4, f64), a4: @Vector(4, f64)) @Vector(4, f64) {
            return a1 + a2 + a3 + a4;
        }
    };
    var vector: @Vector(4, f64) = .{ 10, 20, 30, 40 };
    _ = &vector;
    const vars = .{ .@"-1" = vector };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
    const sum = bf(
        .{ 0.01, 0.02, 0.03, 0.04 },
        .{ 0.1, 0.2, 0.3, 0.4 },
        .{ 1, 2, 3, 4 },
    );
    try expect(@reduce(.And, sum == @Vector(4, f64){ 1.111e1, 2.222e1, 3.333e1, 4.444e1 }));
}

test "Binding (@Vector(4, f64) x 9 + @Vector(4, f64) x 1)" {
    const ns = struct {
        fn add(a1: @Vector(4, f64), a2: @Vector(4, f64), a3: @Vector(4, f64), a4: @Vector(4, f64), a5: @Vector(4, f64), a6: @Vector(4, f64), a7: @Vector(4, f64), a8: @Vector(4, f64), a9: @Vector(4, f64), a10: @Vector(4, f64)) @Vector(4, f64) {
            return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10;
        }
    };
    var vector: @Vector(4, f64) = .{ 100000, 200000, 300000, 400000 };
    _ = &vector;
    const vars = .{ .@"-1" = vector };
    const Add = Binding(@TypeOf(ns.add), @TypeOf(vars));
    var ea = executable();
    const bf = try Add.bind(ea.allocator(), ns.add, vars);
    defer _ = Add.unbind(ea.allocator(), bf);
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
    try expect(@reduce(.And, sum == @Vector(4, f64){ 1.111111111e5, 2.042222222e5, 3.333333333e5, 4.444444444e5 }));
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
            @"punpcklbw mm mm/m64" = 0x60,
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
                    attrs.affects_all = std.mem.startsWith(u8, name, " all");
                } else if (std.mem.startsWith(u8, name, "pop ")) {
                    attrs.pops = true;
                    attrs.affects_all = std.mem.startsWith(u8, name, " all");
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
