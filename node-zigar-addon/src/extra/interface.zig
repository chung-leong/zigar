const std = @import("std");
const E = std.os.wasi.errno_t;

const hooks = @import("./hooks.zig");

pub fn Module(comptime ModuleHost: type, comptime Value: type) type {
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
            create_bool: *const fn (*ModuleHost, bool, *Value) callconv(.C) E,
            create_integer: *const fn (*ModuleHost, i32, bool, *Value) callconv(.C) E,
            create_big_integer: *const fn (*ModuleHost, i64, bool, *Value) callconv(.C) E,
            create_string: *const fn (*ModuleHost, [*]const u8, usize, *Value) callconv(.C) E,
            create_view: *const fn (*ModuleHost, ?[*]const u8, usize, bool, usize, *Value) callconv(.C) E,
            create_instance: *const fn (*ModuleHost, Value, Value, *Value) callconv(.C) E,
            create_list: *const fn (*ModuleHost, *Value) callconv(.C) E,
            create_object: *const fn (*ModuleHost, *Value) callconv(.C) E,
            append_list: *const fn (*ModuleHost, Value, Value) callconv(.C) E,
            get_property: *const fn (*ModuleHost, Value, [*]const u8, usize, *Value) callconv(.C) E,
            set_property: *const fn (*ModuleHost, Value, [*]const u8, usize, Value) callconv(.C) E,
            get_slot_value: *const fn (*ModuleHost, ?Value, usize, *Value) callconv(.C) E,
            set_slot_value: *const fn (*ModuleHost, ?Value, usize, Value) callconv(.C) E,
            set_memory: *const fn (*ModuleHost, Value, ?Value) callconv(.C) E,
            define_structure: *const fn (*ModuleHost, Value) callconv(.C) E,
            finalize_structure: *const fn (*ModuleHost, Value) callconv(.C) E,
            enable_multithread: *const fn (*ModuleHost, bool) callconv(.C) E,
            disable_multithread: *const fn (*ModuleHost, bool) callconv(.C) E,
            handle_jscall: *const fn (*ModuleHost, *Jscall, bool) callconv(.C) E,
            handle_syscall: *const fn (*ModuleHost, *Syscall, bool) callconv(.C) std.c.E,
            release_function: *const fn (*ModuleHost, usize, bool) callconv(.C) E,
        };
        pub const Exports = extern struct { // vtable that's used by the addon
            initialize: *const fn (*ModuleHost) callconv(.C) E,
            deinitialize: *const fn () callconv(.C) E,
            get_export_address: *const fn (usize, *usize) callconv(.C) E,
            get_factory_thunk: *const fn (*usize) callconv(.C) E,
            run_thunk: *const fn (usize, usize, usize) callconv(.C) E,
            run_variadic_thunk: *const fn (usize, usize, usize, usize, usize) callconv(.C) E,
            create_js_thunk: *const fn (usize, usize, *usize) callconv(.C) E,
            destroy_js_thunk: *const fn (usize, usize, *usize) callconv(.C) E,
            get_syscall_hook: *const fn ([*:0]const u8, *HookEntry) callconv(.C) E,
            set_syscall_mask: *const fn (name: [*:0]const u8, set: bool) callconv(.C) E,
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
