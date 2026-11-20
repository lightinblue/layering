import SwiftUI

struct MainWindow: View {
  @ObservedObject var model: AppModel
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    NavigationStack(path: $model.path) {
      HomeView(model: model)
        .navigationDestination(for: MacRoute.self) { route in
          switch route {
          case .calendar:
            CalendarView(model: model)
              .transition(.asymmetric(
                insertion: .move(edge: .trailing).combined(with: .opacity),
                removal: .move(edge: .trailing).combined(with: .opacity)
              ))
          }
        }
    }
    // Slightly under previous 640; HomeView lets the review column compress first.
    .frame(minWidth: 560, minHeight: 420)
    .background(PoogaeTheme.canvas(colorScheme))
  }
}
