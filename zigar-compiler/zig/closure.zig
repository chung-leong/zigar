const std = @import("std");
const builtin = @import("builtin");
const expect = std.testing.expect;

pub const Closure = struct {
    const code_size = switch (builtin.target.cpu.arch) {
        .x86_64 => 22,
        .x86 => 12,
        else => @compileError("Closure not supported on this architecture: " ++ @tagName(builtin.target.cpu.arch)),
    };

    context_ptr: *const anyopaque,
    key: usize,
    bytes: [code_size]u8,

    pub inline fn get() *const @This() {
        const address = switch (builtin.target.cpu.arch) {
            .x86_64 => asm (""
                : [ret] "={rax}" (-> usize),
            ),
            .x86 => asm (""
                : [ret] "={eax}" (-> usize),
            ),
            else => unreachable,
        };
        return @ptrFromInt(address);
    }

    fn construct(self: *@This(), fn_ptr: *const anyopaque, context_ptr: *const anyopaque, key: usize) void {
        self.context_ptr = context_ptr;
        self.key = key;
        self.createInstructions(fn_ptr);
    }

    pub fn getFunction(self: *const @This(), comptime FT: type) *const FT {
        return @ptrCast(&self.bytes);
    }

    fn createInstructions(self: *@This(), fn_ptr: *const anyopaque) void {
        const ip = &self.bytes;
        const self_addr = @intFromPtr(self);
        const fn_addr = @intFromPtr(fn_ptr);
        switch (builtin.target.cpu.arch) {
            .x86_64 => {
                // mov rax, [self_addr]
                ip[0] = 0x48;
                ip[1] = 0xb8;
                @memcpy(ip[2..10], @as([*]const u8, @ptrCast(&self_addr))[0..8]);
                // mov rbx, [fn_addr]
                ip[10] = 0x48;
                ip[11] = 0xbb;
                @memcpy(ip[12..20], @as([*]const u8, @ptrCast(&fn_addr))[0..8]);
                // jmp rbx
                ip[20] = 0xff;
                ip[21] = 0xe3;
            },
            .x86 => {
                // mov eax, [self_addr]
                ip[0] = 0xb8;
                @memcpy(ip[1..5], @as([*]const u8, @ptrCast(&self_addr))[0..4]);
                // mov ebx, [fn_addr]
                ip[5] = 0xbb;
                @memcpy(ip[6..10], @as([*]const u8, @ptrCast(&fn_addr))[0..4]);
                // jmp ebx
                ip[10] = 0xff;
                ip[11] = 0xe3;
            },
            else => unreachable,
        }
    }
};

test "Closure" {
    const ns = struct {
        fn check(number_ptr: *usize) i32 {
            const closure = Closure.get();
            number_ptr.* = @intFromPtr(closure.context_ptr) + closure.key;
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
    const closure: *Closure = @ptrCast(bytes);
    const address = 0xAAAA_BBBB;
    const context_ptr: *const anyopaque = @ptrFromInt(address);
    const key: usize = 1234;
    closure.construct(&ns.check, context_ptr, key);
    const f = closure.getFunction(@TypeOf(ns.check));
    var number: usize = undefined;
    const result = f(&number);
    try expect(result == 777);
    try expect(number == address + key);
}
