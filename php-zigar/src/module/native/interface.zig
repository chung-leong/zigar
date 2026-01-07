const std = @import("std");
const E = std.os.wasi.errno_t;

const hooks = @import("hooks.zig");

pub fn Module(comptime Value: type) type {
    return extern struct {
        version: u32 = current_version,
        attributes: Attributes,
        imports: *Imports,
        exports: *const Exports,

        pub const current_version = 7;
        pub const Attributes = packed struct(u32) {
            little_endian: bool,
            runtime_safety: bool,
            libc: bool,
            io_redirection: bool,
            _: u28 = 0,
        };
        pub const Imports = extern struct { // vtable that's filled by the addon
            create_bool: *const fn (*Host, bool, *Value) callconv(.c) E,
            create_integer: *const fn (*Host, i32, bool, *Value) callconv(.c) E,
            create_big_integer: *const fn (*Host, i64, bool, *Value) callconv(.c) E,
            create_string: *const fn (*Host, [*]const u8, usize, *Value) callconv(.c) E,
            create_view: *const fn (*Host, ?[*]const u8, usize, bool, usize, *Value) callconv(.c) E,
            create_template: *const fn (*Host, ?Value, ?Value, *Value) callconv(.c) E,
            create_instance: *const fn (*Host, Value, Value, ?Value, *Value) callconv(.c) E,
            create_list: *const fn (*Host, *Value) callconv(.c) E,
            create_object: *const fn (*Host, *Value) callconv(.c) E,
            append_list: *const fn (*Host, Value, Value) callconv(.c) E,
            get_property: *const fn (*Host, Value, [*]const u8, usize, *Value) callconv(.c) E,
            set_property: *const fn (*Host, Value, [*]const u8, usize, ?Value) callconv(.c) E,
            get_slot_value: *const fn (*Host, Value, usize, *Value) callconv(.c) E,
            set_slot_value: *const fn (*Host, Value, usize, ?Value) callconv(.c) E,
            get_structure: *const fn (*Host, [*]const u8, usize, *Value) callconv(.c) E,
            set_structure: *const fn (*Host, [*]const u8, usize, ?Value) callconv(.c) E,
            begin_structure: *const fn (*Host, Value) callconv(.c) E,
            finish_structure: *const fn (*Host, Value) callconv(.c) E,
            enable_callback: *const fn (*Host, Value, Value, Value) callconv(.c) E,
            enable_multithread: *const fn (*Host) callconv(.c) E,
            disable_multithread: *const fn (*Host) callconv(.c) E,
            release_function: *const fn (*Host, usize) callconv(.c) E,
            handle_jscall: *const fn (*Host, *Jscall) callconv(.c) E,
            handle_syscall: *const fn (*Host, *Syscall) callconv(.c) E,
            get_syscall_mask: *const fn (*Host, *hooks.Syscall.Mask) callconv(.c) E,
            initialize_thread: *const fn (*Host) callconv(.c) E,
            deinitialize_thread: *const fn (*Host) callconv(.c) E,
            redirect_syscalls: *const fn (*Host, *const anyopaque) callconv(.c) E,
        };
        pub const Exports = extern struct { // vtable that's used by the addon
            set_host_instance: *const fn (*Host) callconv(.c) E,
            get_export_address: *const fn (usize, *usize) callconv(.c) E,
            get_factory_thunk: *const fn (*usize) callconv(.c) E,
            run_thunk: *const fn (usize, usize, usize) callconv(.c) E,
            run_variadic_thunk: *const fn (usize, usize, usize, usize, usize) callconv(.c) E,
            create_js_thunk: *const fn (usize, usize, *usize) callconv(.c) E,
            destroy_js_thunk: *const fn (usize, usize, *usize) callconv(.c) E,
            get_syscall_hook: *const fn ([*:0]const u8, *HookEntry) callconv(.c) E,
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
        pub const StructureType = enum(u32) {
            primitive = 0,
            array,
            @"struct",
            @"union",
            error_union,
            error_set,
            @"enum",
            optional,
            pointer,
            slice,
            vector,
            @"opaque",
            arg_struct,
            variadic_struct,
            function,
        };
        pub const StructurePurpose = enum(u32) {
            unknown,
            promise,
            generator,
            abort_signal,
            allocator,
            iterator,
            file,
            directory,

            pub fn isOptional(self: @This()) bool {
                return switch (self) {
                    .promise, .generator, .abort_signal, .allocator => true,
                    else => false,
                };
            }
        };
        pub const StructureFlags = struct {
            pub const Primitive = packed struct(u32) {
                has_value: bool = true,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                is_size: bool = false,
                _: u26 = 0,
            };
            pub const Array = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = true,
                has_sentinel: bool = false,
                is_string: bool = false,
                is_typed_array: bool = false,
                is_clamped_array: bool = false,
                _: u23 = 0,
            };
            pub const Struct = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                is_extern: bool = false,
                is_packed: bool = false,
                is_tuple: bool = false,
                is_optional: bool = false,
                _: u23 = 0,
            };
            pub const Union = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                has_selector: bool = false,
                has_tag: bool = false,
                has_inaccessible: bool = false,
                is_extern: bool = false,
                is_packed: bool = false,
                _: u22 = 0,
            };
            pub const ErrorUnion = packed struct(u32) {
                has_value: bool = true,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                _: u27 = 0,
            };
            pub const ErrorSet = packed struct(u32) {
                has_value: bool = true,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                is_global: bool = false,
                _: u26 = 0,
            };
            pub const Enum = packed struct(u32) {
                has_value: bool = true,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                is_open_ended: bool = false,
                _: u26 = 0,
            };
            pub const Optional = packed struct(u32) {
                has_value: bool = true,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                has_selector: bool = false,
                _: u26 = 0,
            };
            pub const Pointer = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = true,
                has_slot: bool = true,
                has_proxy: bool = true,
                has_length: bool = false,
                is_multiple: bool = false,
                is_single: bool = false,
                is_const: bool = false,
                is_nullable: bool = false,
                _: u22 = 0,
            };
            pub const Slice = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = true,
                has_sentinel: bool = false,
                is_string: bool = false,
                is_typed_array: bool = false,
                is_clamped_array: bool = false,
                is_opaque: bool = false,
                _: u22 = 0,
            };
            pub const Vector = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                is_typed_array: bool = false,
                is_clamped_array: bool = false,
                _: u25 = 0,
            };
            pub const Opaque = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                _: u27 = 0,
            };
            pub const ArgStruct = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = true,
                has_slot: bool = true,
                has_proxy: bool = false,
                has_options: bool = false,
                is_throwing: bool = false,
                is_async: bool = false,
                _: u24 = 0,
            };
            pub const VariadicStruct = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = true,
                has_slot: bool = true,
                has_proxy: bool = false,
                has_options: bool = false,
                is_throwing: bool = false,
                is_async: bool = false,
                _: u24 = 0,
            };
            pub const Function = packed struct(u32) {
                has_value: bool = false,
                has_object: bool = false,
                has_pointer: bool = false,
                has_slot: bool = false,
                has_proxy: bool = false,
                _: u27 = 0,
            };
        };
        pub const MemberType = enum(u32) {
            void = 0,
            bool,
            int,
            uint,
            float,
            object,
            type,
            literal,
            null,
            undefined,
            unsupported,
        };
        pub const MemberFlags = packed struct(u32) {
            is_required: bool = false,
            is_read_only: bool = false,
            is_part_of_set: bool = false,
            is_selector: bool = false,
            is_method: bool = false,
            is_expecting_instance: bool = false,
            is_sentinel: bool = false,
            is_backing_int: bool = false,
            is_string: bool = false,
            is_plain: bool = false,
            is_typed_array: bool = false,
            is_clamped_array: bool = false,
            _: u20 = 0,
        };
    };
}
