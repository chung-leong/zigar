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
    const field_names = std.meta.fieldNames(@TypeOf(sql));
    var field_types: [field_names.len]type = undefined;
    var field_attrs: [field_names.len]std.lang.Type.Struct.FieldAttributes = undefined;
    for (field_names, 0..) |field_name, i| {
        field_types[i] = sqlite.StatementType(.{}, @field(sql, field_name));
        field_attrs[i] = .{};
    }
    break :define @Struct(.auto, null, field_names, &field_types, &field_attrs);
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
        inline for (std.meta.fieldNames(@TypeOf(sql)), 0..) |field_name, i| {
            if (i < initialized) @field(stmt, field_name).deinit();
        }
    }
    inline for (std.meta.fieldNames(@TypeOf(sql))) |field_name| {
        @field(stmt, field_name) = try db.prepare(@field(sql, field_name));
        initialized += 1;
    }
    database = db;
}

pub fn closeDb() void {
    if (database) |db| {
        inline for (std.meta.fieldNames(@TypeOf(sql))) |field_name| {
            @field(stmt, field_name).deinit();
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
