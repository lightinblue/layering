import SwiftUI

@main
struct PoogaeMacApp: App {
  @StateObject private var model = AppModel()

  var body: some Scene {
    // Main landscape window
    Window("포개", id: "main") {
      MainWindow(model: model)
        .task {
          await model.bootstrap()
        }
    }
    .defaultSize(width: 720, height: 480)
    .commands {
      CommandGroup(replacing: .newItem) {}
    }

    // Menu bar: today-check popover + open window
    MenuBarExtra("포개", systemImage: "checkmark.circle.fill") {
      MenuBarPopover(model: model)
    }
    .menuBarExtraStyle(.window)
  }
}
