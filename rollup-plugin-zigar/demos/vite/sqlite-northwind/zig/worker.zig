const std = @import("std");
const wasm_allocator = std.heap.wasm_allocator;

const sqlite = @import("sqlite");

var database: ?*sqlite.Db = null;

const sql = .{
    .customer_search =
    \\SELECT a.CustomerID, a.CompanyName, a.Region
    \\FROM Customers a
    \\WHERE a.CompanyName LIKE '%' || ? || '%'
    \\ORDER BY a.CompanyName
    ,
    .order_retrieval =
    \\SELECT a.OrderID, a.OrderDate, SUM(b.UnitPrice * b.Quantity * (1 - b.Discount)) as Total FROM Orders a
    \\INNER JOIN "Order Details" b ON a.OrderID = b.OrderID
    \\WHERE CustomerID = ?
    \\GROUP BY a.OrderDate 
    \\LIMIT 5
    ,
};

var stmt: define: {
    const sql_fields = std.meta.fields(@TypeOf(sql));
    var fields: [sql_fields.len]std.builtin.Type.StructField = undefined;
    for (sql_fields, 0..) |sql_field, i| {
        const T = sqlite.StatementType(.{}, @field(sql, sql_field.name));
        fields[i] = .{
            .name = sql_field.name,
            .type = T,
            .default_value_ptr = null,
            .is_comptime = false,
            .alignment = @alignOf(T),
        };
    }
    break :define @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .fields = &fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
} = undefined;

pub fn openDb(path: [:0]const u8) !void {
    if (database != null) closeDb();
    const db = try wasm_allocator.create(sqlite.Db);
    errdefer wasm_allocator.destroy(db);
    db.* = try sqlite.Db.init(.{
        .mode = .{ .File = path },
        .open_flags = .{},
        .threading_mode = .SingleThread,
    });
    errdefer db.deinit();
    var initialized: usize = 0;
    errdefer {
        inline for (std.meta.fields(@TypeOf(sql)), 0..) |field, i| {
            if (i < initialized) @field(stmt, field.name).deinit();
        }
    }
    inline for (std.meta.fields(@TypeOf(sql))) |field| {
        @field(stmt, field.name) = try db.prepare(@field(sql, field.name));
        initialized += 1;
    }
    database = db;
}

pub fn closeDb() void {
    if (database) |db| {
        inline for (std.meta.fields(@TypeOf(sql))) |field| {
            @field(stmt, field.name).deinit();
        }
        db.deinit();
        wasm_allocator.destroy(db);
        database = null;
    }
}

const Customer = struct {
    CustomerID: []const u8,
    CompanyName: []const u8,
    Region: []const u8,
};

pub fn findCustomers(allocator: std.mem.Allocator, keyword: []const u8) ![]Customer {
    defer stmt.customer_search.reset();
    return try stmt.customer_search.all(Customer, allocator, .{}, .{keyword});
}

const Order = struct {
    OrderID: u32,
    OrderDate: []const u8,
    Total: u32,
};

pub fn getOrders(allocator: std.mem.Allocator, customer_id: []const u8) ![]Order {
    defer stmt.order_retrieval.reset();
    return try stmt.order_retrieval.all(Order, allocator, .{}, .{customer_id});
}

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }

    pub fn isDeclPlain(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
