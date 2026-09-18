const std = @import("std");
const allocator = std.heap.c_allocator;

const qt6 = @import("libqt6zig");
const QApplication = qt6.QApplication;
const QWidget = qt6.QWidget;
const QPushButton = qt6.QPushButton;

// Import specific Qt modules for convenience
var counter: usize = 0;
var buffer: [64]u8 = undefined;

pub fn main() !void {
    // Initialize the Qt application and defer cleanup
    const args: std.process.Args = .{ .vector = &.{} };
    const argv = try qt6.init(allocator, args);
    defer qt6.deinit(allocator, argv);
    var argc: i32 = @intCast(argv.len);
    // The c_allocator is an option here too, but the debug allocator is not recommended for this instance
    const qapp: QApplication = .new(allocator, &argc, argv);
    defer qapp.delete();

    // Create a new widget and defer cleanup
    const widget = QWidget.new2();
    defer widget.delete();

    // We don't need to free/delete the button, it's a child of the widget
    const button = QPushButton.new5("Hello world!", widget);
    button.setFixedWidth(320);
    // Connect the button to the callback function
    button.onClicked(onClicked);

    // Display the widget
    widget.show();

    // Start the event loop
    _ = QApplication.exec();
}

fn onClicked(self: QPushButton) callconv(.c) void {
    counter +%= 1;
    const formatted = std.fmt.bufPrint(
        &buffer,
        "You have clicked the button {d} time(s)",
        .{counter},
    ) catch @panic("Failed to bufPrint");
    self.setText(formatted);
}
