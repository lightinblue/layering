import SwiftUI

/// Menu bar: today-review check list + open main window.
struct MenuBarPopover: View {
  @ObservedObject var model: AppModel
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.openWindow) private var openWindow

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Circle()
          .fill(PoogaeTheme.brand)
          .frame(width: 8, height: 8)
        Text("오늘 할 복습")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(PoogaeTheme.section(colorScheme))
        Spacer()
        Text(remainingLabel)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(PoogaeTheme.muted(colorScheme))
      }

      if model.todayReviews.isEmpty {
        Text("남은 복습 없음")
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(PoogaeTheme.muted(colorScheme))
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.vertical, 8)
          .transition(.opacity)
      } else {
        ForEach(model.todayReviews) { card in
          Button {
            model.toggleReview(card)
          } label: {
            HStack(spacing: 10) {
              Image(systemName: card.completed ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(card.completed ? PoogaeTheme.brand : PoogaeTheme.muted(colorScheme))
              VStack(alignment: .leading, spacing: 2) {
                Text("\(card.intervalDays)일 전")
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(PoogaeTheme.ink(colorScheme))
                Text(card.subjectNames.joined(separator: ", "))
                  .font(.system(size: 11, weight: .regular))
                  .foregroundStyle(PoogaeTheme.muted(colorScheme))
                  .lineLimit(1)
              }
              Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .animation(PoogaeMotion.settle, value: card.completed)
        }
      }

      Divider()

      Button {
        openWindow(id: "main")
        model.focusMainWindow()
      } label: {
        Label("창 열기", systemImage: "macwindow")
          .font(.system(size: 13, weight: .medium))
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      .buttonStyle(.plain)

      Text(model.kvs.statusMessage)
        .font(.system(size: 10, weight: .regular))
        .foregroundStyle(PoogaeTheme.muted(colorScheme))
    }
    .padding(14)
    .frame(width: 280)
    .background(PoogaeTheme.canvas(colorScheme))
    .animation(PoogaeMotion.settle, value: model.todayReviews.map(\.id))
  }

  private var remainingLabel: String {
    let remaining = model.todayReviews.filter { !$0.completed }.count
    let total = model.todayReviews.count
    guard total > 0 else { return "" }
    return "\(remaining)/\(total)"
  }
}
