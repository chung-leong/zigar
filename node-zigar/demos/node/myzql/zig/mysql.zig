const std = @import("std");

const myzql = @import("myzql");
const Conn = myzql.conn.Conn;
const PrepareResult = myzql.result.PrepareResult;
const ResultSet = myzql.result.ResultSet;
const BinaryResultRow = myzql.result.BinaryResultRow;
const zigar = @import("zigar");

const DatabaseParams = struct {
    host: []const u8,
    port: u16 = 3306,
    username: [:0]const u8,
    password: [:0]const u8,
    database: [:0]const u8,
    threads: usize = 1,
};

var work_queue: zigar.thread.WorkQueue(worker) = .{};
var gpa = std.heap.DebugAllocator(.{}).init;
const allocator = gpa.allocator();

pub fn openDatabase(
    params: DatabaseParams,
    promise: zigar.function.PromiseArgOf(@TypeOf(work_queue).waitAsync),
) !void {
    try work_queue.init(.{
        .allocator = allocator,
        .n_jobs = params.threads,
        .thread_start_params = .{params},
    });
    work_queue.waitAsync(promise);
}

pub fn closeDatabase(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub const Person = struct {
    id: u32 = 0,
    name: []const u8,
    age: u8,
};

pub const findPersons = work_queue.asyncify(worker.findPersons);
pub const insertPerson = work_queue.promisify(worker.insertPerson);

const worker = struct {
    threadlocal var client: Conn = undefined;

    fn Prepare(comptime sql: []const u8) type {
        return struct {
            comptime sql: []const u8 = sql,
            prep_res: PrepareResult = undefined,
        };
    }

    fn StructIterator(comptime T: type) type {
        return struct {
            rows: ResultSet(BinaryResultRow),

            pub fn init(prep_res: PrepareResult, params: anytype) !@This() {
                const stmt = try prep_res.expect(.stmt);
                const query_res = try client.executeRows(allocator, &stmt, params);
                const rows = try query_res.expect(.rows);
                return .{ .rows = rows };
            }

            pub fn next(self: *@This()) !?T {
                const rows_iter = self.rows.iter();
                if (try rows_iter.next()) |row| {
                    var result: T = undefined;
                    try row.scan(&result);
                    return result;
                } else {
                    return null;
                }
            }
        };
    }

    const queries = struct {
        pub const person = struct {
            pub threadlocal var select: Prepare(
                \\SELECT * FROM person
            ) = .{};
            pub threadlocal var insert: Prepare(
                \\INSERT INTO person (name, age) VALUES(?, ?)
            ) = .{};
        };
    };

    pub fn onThreadStart(params: DatabaseParams) !void {
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
        errdefer client.deinit(allocator);
        inline for (comptime std.meta.declarations(queries)) |qs_decl| {
            const query_set = @field(queries, qs_decl.name);
            inline for (comptime std.meta.declarations(query_set)) |q_decl| {
                const query = &@field(query_set, q_decl.name);
                query.prep_res = try client.prepare(allocator, query.sql);
                errdefer query.prep_res.deinit(allocator);
                _ = try query.prep_res.expect(.stmt);
            }
        }
    }

    pub fn onThreadEnd() void {
        inline for (comptime std.meta.declarations(queries)) |qs_decl| {
            const query_set = @field(queries, qs_decl.name);
            inline for (comptime std.meta.declarations(query_set)) |q_decl| {
                const query = @field(query_set, q_decl.name);
                query.prep_res.deinit(allocator);
            }
        }
        client.deinit(allocator);
    }

    pub fn findPersons() !StructIterator(Person) {
        return try StructIterator(Person).init(queries.person.select.prep_res, .{});
    }

    pub fn insertPerson(person: Person) !u32 {
        const stmt = try queries.person.insert.prep_res.expect(.stmt);
        const exe_res = try client.execute(&stmt, .{ person.name, person.age });
        const ok = try exe_res.expect(.ok);
        return @intCast(ok.last_insert_id);
    }
};

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }

    pub fn isDeclPlain(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
