const std = @import("std");
const builtin = @import("builtin");

const c = @import("c");

pub fn link() !void {
    const dll_name = comptime switch (@hasDecl(c, "ZTS")) {
        false => std.unicode.wtf8ToWtf16LeStringLiteral("php8"),
        true => std.unicode.wtf8ToWtf16LeStringLiteral("php8ts"),
    };
    const module = std.os.windows.kernel32.GetModuleHandleW(dll_name) orelse return error.LibraryNotFound;
    inline for (comptime std.meta.declarations(@This())) |decl| {
        const decl_ptr = &@field(@This(), decl.name);
        const decl_ptr_info = @typeInfo(@TypeOf(decl_ptr)).pointer;
        if (decl_ptr_info.child != void and !decl_ptr_info.is_const) {
            @setEvalBranchQuota(2000000);
            const ptr_info = @typeInfo(decl_ptr_info.child).pointer;
            const import_name = switch (@typeInfo(ptr_info.child)) {
                .@"fn" => |fn_info| switch (fn_info.calling_convention) {
                    .x86_64_vectorcall => std.fmt.comptimePrint("{s}@@{d}", .{ decl.name, fn_info.params.len * @sizeOf(usize) }),
                    .x86_vectorcall => std.fmt.comptimePrint("@{s}@{d}", .{ decl.name, fn_info.params.len * @sizeOf(usize) }),
                    else => decl.name,
                },
                else => decl.name,
            };
            const ptr = std.os.windows.kernel32.GetProcAddress(module, import_name) orelse {
                return error.MissingFunction;
            };
            decl_ptr.* = @ptrCast(@alignCast(ptr));
        }
    }
}

const ZendFastCall = enum {
    _convert_to_string,
    _efree,
    _emalloc,
    _is_numeric_string_ex,
    _zend_hash_init,
    _zend_new_array_0,
    convert_to_array,
    convert_to_boolean,
    convert_to_double,
    convert_to_long,
    convert_to_null,
    convert_to_object,
    gc_possible_root,
    instanceof_function_slow,
    zend_compare,
    zend_hash_del,
    zend_hash_destroy,
    zend_hash_find,
    zend_hash_get_current_data_ex,
    zend_hash_get_current_key_zval_ex,
    zend_hash_index_del,
    zend_hash_index_find,
    zend_hash_index_update,
    zend_hash_internal_pointer_end_ex,
    zend_hash_internal_pointer_reset_ex,
    zend_hash_move_backwards_ex,
    zend_hash_move_forward_ex,
    zend_hash_next_index_insert,
    zend_hash_str_del,
    zend_hash_str_find,
    zend_hash_str_update,
    zend_hash_update,
    zend_list_delete,
    zend_object_std_init,
    zend_objects_new,
    zend_objects_store_del,
    zend_str_tolower,
    zend_string_tolower_ex,
};

fn Ptr(comptime name: []const u8) type {
    const T = @TypeOf(@field(c, name));
    if (@hasField(ZendFastCall, name)) {
        const info = @typeInfo(T).@"fn";
        const F = @Type(.{
            .@"fn" = .{
                .calling_convention = switch (builtin.target.cpu.arch) {
                    .x86_64 => .{ .x86_64_vectorcall = .{} },
                    .x86 => .{ .x86_vectorcall = .{} },
                    else => .c,
                },
                .is_generic = false,
                .is_var_args = info.is_var_args,
                .params = info.params,
                .return_type = info.return_type,
            },
        });
        return *const F;
    } else {
        return *const T;
    }
}

pub var __zend_malloc: Ptr("__zend_malloc") = undefined;
pub var _call_user_function_impl: Ptr("_call_user_function_impl") = undefined;
pub var _convert_to_string: Ptr("_convert_to_string") = undefined;
pub var _efree: Ptr("_efree") = undefined;
pub var _emalloc: Ptr("_emalloc") = undefined;
pub var _is_numeric_string_ex: Ptr("_is_numeric_string_ex") = undefined;
pub var _php_stream_cast: Ptr("_php_stream_cast") = undefined;
pub var _php_stream_flush: Ptr("_php_stream_flush") = undefined;
pub var _php_stream_fopen_from_fd: Ptr("_php_stream_fopen_from_fd") = undefined;
pub var _php_stream_free: Ptr("_php_stream_free") = undefined;
pub var _php_stream_mkdir: Ptr("_php_stream_mkdir") = undefined;
pub var _php_stream_open_wrapper_ex: Ptr("_php_stream_open_wrapper_ex") = undefined;
pub var _php_stream_opendir: Ptr("_php_stream_opendir") = undefined;
pub var _php_stream_read: Ptr("_php_stream_read") = undefined;
pub var _php_stream_readdir: Ptr("_php_stream_readdir") = undefined;
pub var _php_stream_rmdir: Ptr("_php_stream_rmdir") = undefined;
pub var _php_stream_seek: Ptr("_php_stream_seek") = undefined;
pub var _php_stream_set_option: Ptr("_php_stream_set_option") = undefined;
pub var _php_stream_stat_path: Ptr("_php_stream_stat_path") = undefined;
pub var _php_stream_stat: Ptr("_php_stream_stat") = undefined;
pub var _php_stream_tell: Ptr("_php_stream_tell") = undefined;
pub var _php_stream_truncate_set_size: Ptr("_php_stream_truncate_set_size") = undefined;
pub var _php_stream_write: Ptr("_php_stream_write") = undefined;
pub var _zend_hash_init: Ptr("_zend_hash_init") = undefined;
pub var _zend_new_array_0: Ptr("_zend_new_array_0") = undefined;
pub var compiler_globals: switch (@hasDecl(c, "ZTS")) {
    false => Ptr("compiler_globals"),
    true => void,
} = undefined;
pub var compiler_globals_offset: switch (@hasDecl(c, "ZTS")) {
    false => void,
    true => *const usize,
} = undefined;
pub var convert_to_array: Ptr("convert_to_array") = undefined;
pub var convert_to_boolean: Ptr("convert_to_boolean") = undefined;
pub var convert_to_double: Ptr("convert_to_double") = undefined;
pub var convert_to_long: Ptr("convert_to_long") = undefined;
pub var convert_to_null: Ptr("convert_to_null") = undefined;
pub var convert_to_object: Ptr("convert_to_object") = undefined;
pub var display_ini_entries: Ptr("display_ini_entries") = undefined;
pub var executor_globals: switch (@hasDecl(c, "ZTS")) {
    false => Ptr("executor_globals"),
    true => void,
} = undefined;
pub var executor_globals_offset: switch (@hasDecl(c, "ZTS")) {
    false => void,
    true => *const usize,
} = undefined;
pub var gc_possible_root: Ptr("gc_possible_root") = undefined;
pub var get_binary_op: Ptr("get_binary_op") = undefined;
pub var get_unary_op: Ptr("get_unary_op") = undefined;
pub var instanceof_function_slow: Ptr("instanceof_function_slow") = undefined;
pub var object_init_ex: Ptr("object_init_ex") = undefined;
pub var object_properties_init: Ptr("object_properties_init") = undefined;
pub var OnUpdateBool: Ptr("OnUpdateBool") = undefined;
pub var OnUpdateLong: Ptr("OnUpdateLong") = undefined;
pub var OnUpdateString: Ptr("OnUpdateString") = undefined;
pub var php_file_le_pstream: Ptr("php_file_le_pstream") = undefined;
pub var php_file_le_stream: Ptr("php_file_le_stream") = undefined;
pub var php_info_print_table_end: Ptr("php_info_print_table_end") = undefined;
pub var php_info_print_table_header: Ptr("php_info_print_table_header") = undefined;
pub var php_info_print_table_row: Ptr("php_info_print_table_row") = undefined;
pub var php_info_print_table_start: Ptr("php_info_print_table_start") = undefined;
pub var php_stream_locate_url_wrapper: Ptr("php_stream_locate_url_wrapper") = undefined;
pub var php_stream_stdio_ops: Ptr("php_stream_stdio_ops") = undefined;
pub var std_object_handlers: Ptr("std_object_handlers") = undefined;
pub var tsrm_get_ls_cache: switch (@hasDecl(c, "ZTS")) {
    false => void,
    true => Ptr("tsrm_get_ls_cache"),
} = undefined;
pub var zend_call_function: Ptr("zend_call_function") = undefined;
pub var zend_call_known_function: Ptr("zend_call_known_function") = undefined;
pub var zend_ce_aggregate: Ptr("zend_ce_aggregate") = undefined;
pub var zend_ce_arrayaccess: Ptr("zend_ce_arrayaccess") = undefined;
pub var zend_ce_countable: Ptr("zend_ce_countable") = undefined;
pub var zend_ce_exception: Ptr("zend_ce_exception") = undefined;
pub var zend_ce_iterator: Ptr("zend_ce_iterator") = undefined;
pub var zend_ce_serializable: Ptr("zend_ce_serializable") = undefined;
pub var zend_ce_stringable: Ptr("zend_ce_stringable") = undefined;
pub var zend_ce_throwable: Ptr("zend_ce_throwable") = undefined;
pub var zend_ce_traversable: Ptr("zend_ce_traversable") = undefined;
pub var zend_clear_exception: Ptr("zend_clear_exception") = undefined;
pub var zend_compare: Ptr("zend_compare") = undefined;
pub var zend_create_closure: Ptr("zend_create_closure") = undefined;
pub var zend_empty_string: Ptr("zend_empty_string") = undefined;
pub var zend_error: Ptr("zend_error") = undefined;
pub var zend_fcall_info_argp: Ptr("zend_fcall_info_argp") = undefined;
pub var zend_fcall_info_args_clear: Ptr("zend_fcall_info_args_clear") = undefined;
pub var zend_fcall_info_init: Ptr("zend_fcall_info_init") = undefined;
pub var zend_fetch_debug_backtrace: Ptr("zend_fetch_debug_backtrace") = undefined;
pub var zend_fetch_resource2_ex: Ptr("zend_fetch_resource2_ex") = undefined;
pub var zend_function_dtor: Ptr("zend_function_dtor") = undefined;
pub var zend_get_executed_filename: Ptr("zend_get_executed_filename") = undefined;
pub var zend_get_executed_lineno: Ptr("zend_get_executed_lineno") = undefined;
pub var zend_hash_del: Ptr("zend_hash_del") = undefined;
pub var zend_hash_destroy: Ptr("zend_hash_destroy") = undefined;
pub var zend_hash_find: Ptr("zend_hash_find") = undefined;
pub var zend_hash_get_current_data_ex: Ptr("zend_hash_get_current_data_ex") = undefined;
pub var zend_hash_get_current_key_zval_ex: Ptr("zend_hash_get_current_key_zval_ex") = undefined;
pub var zend_hash_index_del: Ptr("zend_hash_index_del") = undefined;
pub var zend_hash_index_find: Ptr("zend_hash_index_find") = undefined;
pub var zend_hash_index_update: Ptr("zend_hash_index_update") = undefined;
pub var zend_hash_internal_pointer_end_ex: Ptr("zend_hash_internal_pointer_end_ex") = undefined;
pub var zend_hash_internal_pointer_reset_ex: Ptr("zend_hash_internal_pointer_reset_ex") = undefined;
pub var zend_hash_move_backwards_ex: Ptr("zend_hash_move_backwards_ex") = undefined;
pub var zend_hash_move_forward_ex: Ptr("zend_hash_move_forward_ex") = undefined;
pub var zend_hash_next_index_insert: Ptr("zend_hash_next_index_insert") = undefined;
pub var zend_hash_str_del: Ptr("zend_hash_str_del") = undefined;
pub var zend_hash_str_find: Ptr("zend_hash_str_find") = undefined;
pub var zend_hash_str_update: Ptr("zend_hash_str_update") = undefined;
pub var zend_hash_update: Ptr("zend_hash_update") = undefined;
pub var zend_initialize_class_data: Ptr("zend_initialize_class_data") = undefined;
pub var zend_is_valid_class_name: Ptr("zend_is_valid_class_name") = undefined;
pub var zend_iterator_dtor: Ptr("zend_iterator_dtor") = undefined;
pub var zend_iterator_init: Ptr("zend_iterator_init") = undefined;
pub var zend_list_delete: Ptr("zend_list_delete") = undefined;
pub var zend_lookup_class: Ptr("zend_lookup_class") = undefined;
pub var zend_object_std_init: Ptr("zend_object_std_init") = undefined;
pub var zend_objects_new: Ptr("zend_objects_new") = undefined;
pub var zend_objects_store_del: Ptr("zend_objects_store_del") = undefined;
pub var zend_one_char_string: Ptr("zend_one_char_string") = undefined;
pub var zend_register_constant: Ptr("zend_register_constant") = undefined;
pub var zend_register_ini_entries: Ptr("zend_register_ini_entries") = undefined;
pub var zend_register_internal_class_ex: Ptr("zend_register_internal_class_ex") = undefined;
pub var zend_register_internal_interface: Ptr("zend_register_internal_interface") = undefined;
pub var zend_standard_class_def: Ptr("zend_standard_class_def") = undefined;
pub var zend_str_tolower: Ptr("zend_str_tolower") = undefined;
pub var zend_string_init_interned: Ptr("zend_string_init_interned") = undefined;
pub var zend_string_tolower_ex: Ptr("zend_string_tolower_ex") = undefined;
pub var zend_throw_exception_ex: Ptr("zend_throw_exception_ex") = undefined;
pub var zend_throw_exception_object: Ptr("zend_throw_exception_object") = undefined;
pub var zend_trace_to_string: Ptr("zend_trace_to_string") = undefined;
pub var zend_unregister_ini_entries: Ptr("zend_unregister_ini_entries") = undefined;
pub var zval_ptr_dtor: Ptr("zval_ptr_dtor") = undefined;

pub fn zend_string_release(arg_s: [*c]c.zend_string) callconv(.c) void {
    var s = arg_s;
    _ = &s;
    if (!((c.zval_gc_flags(s.*.gc.u.type_info) & @as(u32, @bitCast(@as(c_int, 1) << @intCast(6)))) != 0)) {
        if (c.zend_gc_delref(&s.*.gc) == @as(u32, @bitCast(@as(c_int, 0)))) {
            _ = if ((c.zval_gc_flags(s.*.gc.u.type_info) & @as(u32, @bitCast(@as(c_int, 1) << @intCast(7)))) != 0) c.free(@as(?*anyopaque, @ptrCast(s))) else efree(@as(?*anyopaque, @ptrCast(s)), @src());
        }
    }
}

pub fn zend_hash_release(arg_array: [*c]c.zend_array) callconv(.c) void {
    var array = arg_array;
    _ = &array;
    if (!((c.zval_gc_flags(array.*.gc.u.type_info) & @as(u32, @bitCast(@as(c_int, 1) << @intCast(6)))) != 0)) {
        if (c.zend_gc_delref(&array.*.gc) == @as(u32, @bitCast(@as(c_int, 0)))) {
            zend_hash_destroy(array);
            _ = if ((c.zval_gc_flags(array.*.gc.u.type_info) & @as(u32, @bitCast(@as(c_int, 1) << @intCast(7)))) != 0) c.free(@as(?*anyopaque, @ptrCast(array))) else efree(@as(?*anyopaque, @ptrCast(array)), @src());
        }
    }
}

pub fn zend_object_release(arg_obj: [*c]c.zend_object) callconv(.c) void {
    var obj = arg_obj;
    _ = &obj;
    if (c.zend_gc_delref(&obj.*.gc) == @as(u32, @bitCast(@as(c_int, 0)))) {
        zend_objects_store_del(obj);
    } else if ((@as([*c]c.zend_refcounted, @ptrCast(@alignCast(obj))).*.gc.u.type_info & (@as(c_uint, 4294966272) | @as(c_uint, @bitCast((@as(c_int, 1) << @intCast(4)) << @intCast(0))))) == @as(c_uint, @bitCast(@as(c_int, 0)))) {
        gc_possible_root(@as([*c]c.zend_refcounted, @ptrCast(@alignCast(obj))));
    }
}

fn efree(ptr: ?*anyopaque, comptime src: std.builtin.SourceLocation) void {
    switch (@typeInfo(@TypeOf(c._efree)).@"fn".params.len) {
        5 => _efree(ptr, src.file, src.line, null, 0),
        1 => _efree(ptr),
        else => @compileError("Unexpected ptr argument count"),
    }
}
