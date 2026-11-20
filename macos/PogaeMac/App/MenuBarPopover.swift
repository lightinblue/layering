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
          .fill(PogaeTheme.brand)
          .frame(width: 8, height: 8)
        Text("오늘 할 복습")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(PogaeTheme.section(colorScheme))
        Spacer()
        Text(remainingLabel)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(PogaeTheme.muted(colorScheme))
      }

      if model.todayReviews.isEmpty {
        Text("남은 복습 없음")
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(PogaeTheme.muted(colorScheme))
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
                .foregroundStyle(card.completed ? PogaeTheme.brand : PogaeTheme.muted(colorScheme))
              VStack(alignment: .leading, spacing: 2) {
                Text("\(card.intervalDays)일 전")
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(PogaeTheme.ink(colorScheme))
                Text(card.subjectNames.joined(separator: ", "))
                  .font(.system(size: 11, weight: .regular))
                  .foregroundStyle(PogaeTheme.muted(colorScheme))
                  .lineLimit(1)
              }
              Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .animation(PogaeMotion.settle, value: card.completed)
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

      #if DEBUG
      Text(model.kvs.statusMessage)
        .font(.system(size: 10, weight: .regular))
        .foregroundStyle(PogaeTheme.muted(colorScheme))
        .textSelection(.enabled)
        .id(model.kvs.statusMessage)
        .animation(PogaeMotion.settle, value: model.kvs.statusMessage)

      if !model.kvs.debugSummary.isEmpty {
        Text(model.kvs.debugSummary)
          .font(.system(size: 9, weight: .regular).monospaced())
          .foregroundStyle(PogaeTheme.muted(colorScheme).opacity(0.9))
          .textSelection(.enabled)
      }

      HStack(spacing: 12) {
        Button("다시 받기") {
          model.forcePullFromICloud()
        }
        .buttonStyle(.plain)
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(PogaeTheme.brand)
        .help("iCloud KVS를 다시 읽고 상태를 갱신합니다")

        Button("로컬 초기화") {
          model.resetLocalStoreAndPull()
        }
        .buttonStyle(.plain)
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(PogaeTheme.section(colorScheme))
        .help("Mac 로컬 캐시를 비우고 클라우드만 다시 읽습니다 (푸시 없음)")
      }
      #endif
    }
    .padding(14)
    .frame(width: 300)
    .background(PogaeTheme.canvas(colorScheme))
    .animation(PogaeMotion.settle, value: model.todayReviews.map(\.id))
  }

  private var remainingLabel: String {
    let remaining = model.todayReviews.filter { !$0.completed }.count
    let total = model.todayReviews.count
    guard total > 0 else { return "" }
    return "\(remaining)/\(total)"
  }
}
