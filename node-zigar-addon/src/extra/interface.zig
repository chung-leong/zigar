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
            _: u29 = 0,
        };
        pub const Imports = extern struct { // vtable that's filled by the addon
            create_bool: *const fn (bool, *Value) callconv(.C) E,
            create_integer: *const fn (i32, bool, *Value) callconv(.C) E,
            create_big_integer: *const fn (i64, bool, *Value) callconv(.C) E,
            create_string: *const fn ([*]const u8, usize, *Value) callconv(.C) E,
            create_view: *const fn (?[*]const u8, usize, bool, usize, *Value) callconv(.C) E,
            create_template: *const fn (?Value, ?Value, *Value) callconv(.C) E,
            create_instance: *const fn (Value, Value, ?Value, *Value) callconv(.C) E,
            create_list: *const fn (*Value) callconv(.C) E,
            create_object: *const fn (*Value) callconv(.C) E,
            append_list: *const fn (Value, Value) callconv(.C) E,
            get_property: *const fn (Value, [*]const u8, usize, *Value) callconv(.C) E,
            set_property: *const fn (Value, [*]const u8, usize, Value) callconv(.C) E,
            get_slot_value: *const fn (?Value, usize, *Value) callconv(.C) E,
            set_slot_value: *const fn (?Value, usize, Value) callconv(.C) E,
            begin_structure: *const fn (Value) callconv(.C) E,
            finish_structure: *const fn (Value) callconv(.C) E,
            enable_multithread: *const fn () callconv(.C) E,
            disable_multithread: *const fn () callconv(.C) E,
            get_instance: *const fn (**anyopaque) callconv(.C) E,
            initialize_thread: *const fn (*anyopaque) callconv(.C) E,
            handle_jscall: *const fn (*Jscall) callconv(.C) E,
            handle_syscall: *const fn (*Syscall) callconv(.C) E,
            get_syscall_mask: *const fn (*hooks.Mask) callconv(.C) E,
            release_function: *const fn (usize) callconv(.C) E,
        };
        pub const Exports = extern struct { // vtable that's used by the addon
            get_export_address: *const fn (usize, *usize) callconv(.C) E,
            get_factory_thunk: *const fn (*usize) callconv(.C) E,
            run_thunk: *const fn (usize, usize, usize) callconv(.C) E,
            run_variadic_thunk: *const fn (usize, usize, usize, usize, usize) callconv(.C) E,
            create_js_thunk: *const fn (usize, usize, *usize) callconv(.C) E,
            destroy_js_thunk: *const fn (usize, usize, *usize) callconv(.C) E,
            get_syscall_hook: *const fn ([*:0]const u8, *HookEntry) callconv(.C) E,
        };
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
