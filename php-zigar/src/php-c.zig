const std = @import("std");

const c = @import("c");

export fn DllMain() callconv(.winapi) std.os.windows.BOOL {
    const module = std.os.windows.kernel32.GetModuleHandleW(null) orelse unreachable;
    inline for (comptime std.meta.declarations(@This())) |decl| {
        const decl_ptr = &@field(@This(), decl.name);
        if (!@typeInfo(@TypeOf(decl_ptr)).pointer.is_const) {
            const ptr = std.os.windows.kernel32.GetProcAddress(module, decl.name) orelse {
                std.debug.print("Unable to import function: {s}", .{decl.name});
                return std.os.windows.FALSE;
            };
            decl_ptr.* = @ptrCast(@alignCast(ptr));
        }
    }
    return std.os.windows.TRUE;
}

pub var __zend_malloc: *const @TypeOf(c.__zend_malloc) = undefined;
pub var _call_user_function_impl: *const @TypeOf(c._call_user_function_impl) = undefined;
pub var _convert_to_string: *const @TypeOf(c._convert_to_string) = undefined;
pub var _efree: *const @TypeOf(c._efree) = undefined;
pub var _emalloc: *const @TypeOf(c._emalloc) = undefined;
pub var _is_numeric_string_ex: *const @TypeOf(c._is_numeric_string_ex) = undefined;
pub var _php_stream_cast: *const @TypeOf(c._php_stream_cast) = undefined;
pub var _php_stream_flush: *const @TypeOf(c._php_stream_flush) = undefined;
pub var _php_stream_fopen_from_fd: *const @TypeOf(c._php_stream_fopen_from_fd) = undefined;
pub var _php_stream_free: *const @TypeOf(c._php_stream_free) = undefined;
pub var _php_stream_mkdir: *const @TypeOf(c._php_stream_mkdir) = undefined;
pub var _php_stream_open_wrapper_ex: *const @TypeOf(c._php_stream_open_wrapper_ex) = undefined;
pub var _php_stream_opendir: *const @TypeOf(c._php_stream_opendir) = undefined;
pub var _php_stream_read: *const @TypeOf(c._php_stream_read) = undefined;
pub var _php_stream_readdir: *const @TypeOf(c._php_stream_readdir) = undefined;
pub var _php_stream_rmdir: *const @TypeOf(c._php_stream_rmdir) = undefined;
pub var _php_stream_seek: *const @TypeOf(c._php_stream_seek) = undefined;
pub var _php_stream_set_option: *const @TypeOf(c._php_stream_set_option) = undefined;
pub var _php_stream_stat_path: *const @TypeOf(c._php_stream_stat_path) = undefined;
pub var _php_stream_stat: *const @TypeOf(c._php_stream_stat) = undefined;
pub var _php_stream_tell: *const @TypeOf(c._php_stream_tell) = undefined;
pub var _php_stream_truncate_set_size: *const @TypeOf(c._php_stream_truncate_set_size) = undefined;
pub var _php_stream_write: *const @TypeOf(c._php_stream_write) = undefined;
pub var _zend_hash_init: *const @TypeOf(c._zend_hash_init) = undefined;
pub var _zend_new_array_0: *const @TypeOf(c._zend_new_array_0) = undefined;
pub var compiler_globals: *const @TypeOf(c.compiler_globals) = undefined;
pub var convert_to_array: *const @TypeOf(c.convert_to_array) = undefined;
pub var convert_to_boolean: *const @TypeOf(c.convert_to_boolean) = undefined;
pub var convert_to_double: *const @TypeOf(c.convert_to_double) = undefined;
pub var convert_to_long: *const @TypeOf(c.convert_to_long) = undefined;
pub var convert_to_null: *const @TypeOf(c.convert_to_null) = undefined;
pub var convert_to_object: *const @TypeOf(c.convert_to_object) = undefined;
pub var executor_globals: *const @TypeOf(c.executor_globals) = undefined;
pub var gc_possible_root: *const @TypeOf(c.gc_possible_root) = undefined;
pub var get_binary_op: *const @TypeOf(c.get_binary_op) = undefined;
pub var get_unary_op: *const @TypeOf(c.get_unary_op) = undefined;
pub var instanceof_function_slow: *const @TypeOf(c.instanceof_function_slow) = undefined;
pub var object_init_ex: *const @TypeOf(c.object_init_ex) = undefined;
pub var object_properties_init: *const @TypeOf(c.object_properties_init) = undefined;
pub var OnUpdateBool: *const @TypeOf(c.OnUpdateBool) = undefined;
pub var OnUpdateLong: *const @TypeOf(c.OnUpdateLong) = undefined;
pub var OnUpdateString: *const @TypeOf(c.OnUpdateString) = undefined;
pub var php_file_le_pstream: *const @TypeOf(c.php_file_le_pstream) = undefined;
pub var php_file_le_stream: *const @TypeOf(c.php_file_le_stream) = undefined;
pub var php_info_print_table_end: *const @TypeOf(c.php_info_print_table_end) = undefined;
pub var php_info_print_table_header: *const @TypeOf(c.php_info_print_table_header) = undefined;
pub var php_info_print_table_start: *const @TypeOf(c.php_info_print_table_start) = undefined;
pub var php_stream_locate_url_wrapper: *const @TypeOf(c.php_stream_locate_url_wrapper) = undefined;
pub var php_stream_stdio_ops: *const @TypeOf(c.php_stream_stdio_ops) = undefined;
pub var std_object_handlers: *const @TypeOf(c.std_object_handlers) = undefined;
pub var zend_call_function: *const @TypeOf(c.zend_call_function) = undefined;
pub var zend_call_known_function: *const @TypeOf(c.zend_call_known_function) = undefined;
pub var zend_ce_aggregate: *const @TypeOf(c.zend_ce_aggregate) = undefined;
pub var zend_ce_arrayaccess: *const @TypeOf(c.zend_ce_arrayaccess) = undefined;
pub var zend_ce_countable: *const @TypeOf(c.zend_ce_countable) = undefined;
pub var zend_ce_exception: *const @TypeOf(c.zend_ce_exception) = undefined;
pub var zend_ce_iterator: *const @TypeOf(c.zend_ce_iterator) = undefined;
pub var zend_ce_serializable: *const @TypeOf(c.zend_ce_serializable) = undefined;
pub var zend_ce_stringable: *const @TypeOf(c.zend_ce_stringable) = undefined;
pub var zend_ce_throwable: *const @TypeOf(c.zend_ce_throwable) = undefined;
pub var zend_ce_traversable: *const @TypeOf(c.zend_ce_traversable) = undefined;
pub var zend_clear_exception: *const @TypeOf(c.zend_clear_exception) = undefined;
pub var zend_compare: *const @TypeOf(c.zend_compare) = undefined;
pub var zend_create_closure: *const @TypeOf(c.zend_create_closure) = undefined;
pub var zend_empty_string: *const @TypeOf(c.zend_empty_string) = undefined;
pub var zend_error: *const @TypeOf(c.zend_error) = undefined;
pub var zend_fcall_info_argp: *const @TypeOf(c.zend_fcall_info_argp) = undefined;
pub var zend_fcall_info_args_clear: *const @TypeOf(c.zend_fcall_info_args_clear) = undefined;
pub var zend_fcall_info_init: *const @TypeOf(c.zend_fcall_info_init) = undefined;
pub var zend_fetch_debug_backtrace: *const @TypeOf(c.zend_fetch_debug_backtrace) = undefined;
pub var zend_fetch_resource2_ex: *const @TypeOf(c.zend_fetch_resource2_ex) = undefined;
pub var zend_function_dtor: *const @TypeOf(c.zend_function_dtor) = undefined;
pub var zend_get_executed_filename: *const @TypeOf(c.zend_get_executed_filename) = undefined;
pub var zend_get_executed_lineno: *const @TypeOf(c.zend_get_executed_lineno) = undefined;
pub var zend_hash_del: *const @TypeOf(c.zend_hash_del) = undefined;
pub var zend_hash_destroy: *const @TypeOf(c.zend_hash_destroy) = undefined;
pub var zend_hash_find: *const @TypeOf(c.zend_hash_find) = undefined;
pub var zend_hash_get_current_data_ex: *const @TypeOf(c.zend_hash_get_current_data_ex) = undefined;
pub var zend_hash_get_current_key_zval_ex: *const @TypeOf(c.zend_hash_get_current_key_zval_ex) = undefined;
pub var zend_hash_index_del: *const @TypeOf(c.zend_hash_index_del) = undefined;
pub var zend_hash_index_find: *const @TypeOf(c.zend_hash_index_find) = undefined;
pub var zend_hash_index_update: *const @TypeOf(c.zend_hash_index_update) = undefined;
pub var zend_hash_internal_pointer_end_ex: *const @TypeOf(c.zend_hash_internal_pointer_end_ex) = undefined;
pub var zend_hash_internal_pointer_reset_ex: *const @TypeOf(c.zend_hash_internal_pointer_reset_ex) = undefined;
pub var zend_hash_move_backwards_ex: *const @TypeOf(c.zend_hash_move_backwards_ex) = undefined;
pub var zend_hash_move_forward_ex: *const @TypeOf(c.zend_hash_move_forward_ex) = undefined;
pub var zend_hash_next_index_insert: *const @TypeOf(c.zend_hash_next_index_insert) = undefined;
pub var zend_hash_str_del: *const @TypeOf(c.zend_hash_str_del) = undefined;
pub var zend_hash_str_find: *const @TypeOf(c.zend_hash_str_find) = undefined;
pub var zend_hash_str_update: *const @TypeOf(c.zend_hash_str_update) = undefined;
pub var zend_hash_update: *const @TypeOf(c.zend_hash_update) = undefined;
pub var zend_initialize_class_data: *const @TypeOf(c.zend_initialize_class_data) = undefined;
pub var zend_is_valid_class_name: *const @TypeOf(c.zend_is_valid_class_name) = undefined;
pub var zend_iterator_dtor: *const @TypeOf(c.zend_iterator_dtor) = undefined;
pub var zend_iterator_init: *const @TypeOf(c.zend_iterator_init) = undefined;
pub var zend_list_delete: *const @TypeOf(c.zend_list_delete) = undefined;
pub var zend_lookup_class: *const @TypeOf(c.zend_lookup_class) = undefined;
pub var zend_object_std_init: *const @TypeOf(c.zend_object_std_init) = undefined;
pub var zend_objects_new: *const @TypeOf(c.zend_objects_new) = undefined;
pub var zend_objects_store_del: *const @TypeOf(c.zend_objects_store_del) = undefined;
pub var zend_one_char_string: *const @TypeOf(c.zend_one_char_string) = undefined;
pub var zend_register_constant: *const @TypeOf(c.zend_register_constant) = undefined;
pub var zend_register_ini_entries: *const @TypeOf(c.zend_register_ini_entries) = undefined;
pub var zend_register_internal_class_ex: *const @TypeOf(c.zend_register_internal_class_ex) = undefined;
pub var zend_register_internal_interface: *const @TypeOf(c.zend_register_internal_interface) = undefined;
pub var zend_standard_class_def: *const @TypeOf(c.zend_standard_class_def) = undefined;
pub var zend_str_tolower: *const @TypeOf(c.zend_str_tolower) = undefined;
pub var zend_string_init_interned: *const @TypeOf(c.zend_string_init_interned) = undefined;
pub var zend_string_tolower_ex: *const @TypeOf(c.zend_string_tolower_ex) = undefined;
pub var zend_throw_exception_ex: *const @TypeOf(c.zend_throw_exception_ex) = undefined;
pub var zend_throw_exception_object: *const @TypeOf(c.zend_throw_exception_object) = undefined;
pub var zend_trace_to_string: *const @TypeOf(c.zend_trace_to_string) = undefined;
pub var zend_unregister_ini_entries: *const @TypeOf(c.zend_unregister_ini_entries) = undefined;
pub var zval_ptr_dtor: *const @TypeOf(c.zval_ptr_dtor) = undefined;

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
