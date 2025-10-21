const std = @import("std");
const E = std.os.wasi.errno_t;

const hooks = @import("./hooks.zig");

pub fn Module(comptime Value: type) type {
    return extern struct {
        version: u32,
        attributes: Attributes,
        imports: *Imports,
        exports: *const Exports,

        pub const Attributes = packed struct(u32) {
            little_endian: bool,
            runtime_safety: bool,
            libc: bool,
            io_redirection: bool,
            _: u28 = 0,
        };
        pub const Imports = extern struct { // vtable that's filled by the addon
            create_bool: *const fn (*Host, bool, *Value) callconv(.C) E,
            create_integer: *const fn (*Host, i32, bool, *Value) callconv(.C) E,
            create_big_integer: *const fn (*Host, i64, bool, *Value) callconv(.C) E,
            create_string: *const fn (*Host, [*]const u8, usize, *Value) callconv(.C) E,
            create_view: *const fn (*Host, ?[*]const u8, usize, bool, usize, *Value) callconv(.C) E,
            create_template: *const fn (*Host, ?Value, ?Value, *Value) callconv(.C) E,
            create_instance: *const fn (*Host, Value, Value, ?Value, *Value) callconv(.C) E,
            create_list: *const fn (*Host, *Value) callconv(.C) E,
            create_object: *const fn (*Host, *Value) callconv(.C) E,
            append_list: *const fn (*Host, Value, Value) callconv(.C) E,
            get_property: *const fn (*Host, Value, [*]const u8, usize, *Value) callconv(.C) E,
            set_property: *const fn (*Host, Value, [*]const u8, usize, ?Value) callconv(.C) E,
            get_slot_value: *const fn (*Host, ?Value, usize, *Value) callconv(.C) E,
            set_slot_value: *const fn (*Host, ?Value, usize, ?Value) callconv(.C) E,
            begin_structure: *const fn (*Host, Value) callconv(.C) E,
            finish_structure: *const fn (*Host, Value) callconv(.C) E,
            enable_multithread: *const fn (*Host) callconv(.C) E,
            disable_multithread: *const fn (*Host) callconv(.C) E,
            release_function: *const fn (*Host, usize) callconv(.C) E,
            handle_jscall: *const fn (*Host, *Jscall) callconv(.C) E,
            handle_syscall: *const fn (*Host, *Syscall) callconv(.C) E,
            get_syscall_mask: *const fn (*Host, *hooks.Syscall.Mask) callconv(.C) E,
            initialize_thread: *const fn (*Host) callconv(.C) E,
            deinitialize_thread: *const fn (*Host) callconv(.C) E,
            redirect_syscalls: *const fn (*Host, *const anyopaque) callconv(.C) E,
        };
        pub const Exports = extern struct { // vtable that's used by the addon
            set_host_instance: *const fn (*Host) callconv(.C) E,
            get_export_address: *const fn (usize, *usize) callconv(.C) E,
            get_factory_thunk: *const fn (*usize) callconv(.C) E,
            run_thunk: *const fn (usize, usize, usize) callconv(.C) E,
            run_variadic_thunk: *const fn (usize, usize, usize, usize, usize) callconv(.C) E,
            create_js_thunk: *const fn (usize, usize, *usize) callconv(.C) E,
            destroy_js_thunk: *const fn (usize, usize, *usize) callconv(.C) E,
            get_syscall_hook: *const fn ([*:0]const u8, *HookEntry) callconv(.C) E,
        };
        pub const Host = opaque {};
        pub const HookEntry = hooks.Entry;
        pub const Syscall = hooks.Syscall;
        pub const Jscall = extern struct {
            fn_id: usize,
            arg_address: usize,
            arg_size: usize,
            futex_handle: usize = 0,
        };
    };
}
