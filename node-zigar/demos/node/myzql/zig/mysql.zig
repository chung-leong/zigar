const std = @import("std");
const zigar = @import("zigar");
const myzql = @import("myzql");
const Conn = myzql.conn.Conn;
const PreparedStatement = myzql.result.PreparedStatement;
const QueryResultRows = myzql.result.QueryResultRows;
const ResultRowIter = myzql.result.ResultRowIter;
const BinaryResultRow = myzql.result.BinaryResultRow;

const DatabaseParams = struct {
    host: []const u8,
    port: u16 = 3306,
    username: [:0]const u8,
    password: [:0]const u8,
    database: [:0]const u8,
    threads: usize = 1,
};

var work_queue: zigar.thread.WorkQueue(thread_ns) = .{};

pub fn openDatabase(params: DatabaseParams) !void {
    try work_queue.init(.{
        .allocator = zigar.mem.getDefaultAllocator(),
        .n_jobs = params.threads,
        .thread_start_params = .{params},
    });
    errdefer work_queue.deinit();
    try work_queue.wait();
}

pub fn closeDatabase() void {
    work_queue.deinit();
}

pub const Person = struct {
    id: u32 = 0,
    name: []const u8,
    age: u8,
};

pub fn findPersons(allocator: std.mem.Allocator, generator: zigar.function.GeneratorOf(thread_ns.findPersons)) !void {
    try work_queue.push(thread_ns.findPersons, .{allocator}, generator);
}

const thread_ns = struct {
    threadlocal var client: Conn = undefined;

    fn Prepare(comptime sql: []const u8) type {
        return struct {
            comptime sql: []const u8 = sql,
            stmt: PreparedStatement = undefined,
        };
    }

    fn StructIterator(comptime T: type) type {
        return struct {
            allocator: std.mem.Allocator,
            rows_iter: ResultRowIter(BinaryResultRow),
            struct_ptr: ?*T = null,

            pub fn init(allocator: std.mem.Allocator, query_res: QueryResultRows(BinaryResultRow)) !@This() {
                const rows = try query_res.expect(.rows);
                return .{ .allocator = allocator, .rows_iter = rows.iter() };
            }

            pub fn next(self: *@This()) !?T {
                if (self.struct_ptr) |ptr| {
                    BinaryResultRow.structDestroy(ptr, self.allocator);
                }
                if (try self.rows_iter.next()) |row| {
                    self.struct_ptr = try row.structCreate(T, self.allocator);
                    return self.struct_ptr.?.*;
                } else {
                    return null;
                }
            }
        };
    }

    const queries = struct {
        const person = struct {
            threadlocal var select: Prepare(
                \\\ SELECT * FROM person
            ) = .{};
        };
    };

    pub fn onThreadStart(params: DatabaseParams) !void {
        const allocator = zigar.mem.getDefaultAllocator();
        const address = try std.net.Address.parseIp(params.host, params.port);
        client = try Conn.init(
            allocator,
            &.{
                .username = params.username,
                .password = params.password,
                .database = params.database,
                .address = address,
            },
        );
        errdefer client.deinit();
        inline for (comptime std.meta.declarations(queries)) |qs_decl| {
            const query_set = @field(queries, qs_decl.name);
            inline for (comptime std.meta.declarations(query_set)) |q_decl| {
                const query = @field(query_set, q_decl.name);
                query.stmt = try client.prepare(allocator, query.sql);
                errdefer query.stmt.deinit(allocator);
            }
        }
    }

    pub fn onThreadEnd() void {
        const allocator = zigar.mem.getDefaultAllocator();
        inline for (comptime std.meta.declarations(queries)) |qs_decl| {
            const query_set = @field(queries, qs_decl.name);
            inline for (comptime std.meta.declarations(query_set)) |q_decl| {
                const query = @field(query_set, q_decl.name);
                query.stmt.deinit(allocator);
            }
        }
        client.deinit();
    }

    pub fn findPersons(allocator: std.mem.Allocator) !StructIterator(Person) {
        const query_res = try client.executeRows(&queries.person.select.stmt, .{});
        return StructIterator(Person).init(allocator, query_res);
    }
};
