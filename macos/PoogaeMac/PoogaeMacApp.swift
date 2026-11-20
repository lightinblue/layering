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
    MenuBarExtra {
      MenuBarPopover(model: model)
    } label: {
      Label("포개", image: "MenuBarIcon")
    }
    .menuBarExtraStyle(.window)
  }
}
