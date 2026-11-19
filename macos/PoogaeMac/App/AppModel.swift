import AppKit
import SwiftUI

@MainActor
final class AppModel: ObservableObject {
  @Published var path = NavigationPath()
  @Published var selectedDateKey: String = DateKeys.todayKey()

  let kvs = ICloudKvsStore()

  var todayKey: String { DateKeys.todayKey() }

  var studies: [HomeStudyRow] {
    TodayHomeData.studies(for: selectedDateKey, data: kvs.data)
  }

  var reviews: [HomeReviewCard] {
    TodayHomeData.reviews(for: selectedDateKey, data: kvs.data)
  }

  var todayReviews: [HomeReviewCard] {
    TodayHomeData.reviews(for: todayKey, data: kvs.data)
  }

  func bootstrap() async {
    await kvs.bootstrap()
    selectedDateKey = todayKey
  }

  func openCalendar() {
    withAnimation(PoogaeMotion.panel) {
      path.append(MacRoute.calendar)
    }
  }

  func focusMainWindow() {
    NSApp.activate(ignoringOtherApps: true)
    if let window = NSApp.windows.first(where: {
      $0.title == "포개" || $0.identifier?.rawValue == "main"
    }) {
      window.makeKeyAndOrderFront(nil)
    } else {
      // Fallback: bring any app window forward.
      NSApp.windows.first?.makeKeyAndOrderFront(nil)
    }
  }

  /// Toggle review checks locally (milestone 1 — cloud write comes later).
  func toggleReview(_ card: HomeReviewCard) {
    var next = kvs.data
    let now = ISO8601DateFormatter.fractional.string(from: Date())
    for target in card.checkTargets {
      guard let idx = next.records.firstIndex(where: { $0.id == target.studyId }) else {
        continue
      }
      let key = String(target.intervalDays)
      let wasDone = next.records[idx].checks[key]?.done == true
      next.records[idx].checks[key] = ReviewCheck(done: !wasDone, updatedAt: now)
      next.records[idx].updatedAt = now
    }
    withAnimation(PoogaeMotion.settle) {
      kvs.applyLocal(next)
    }
  }
}

enum MacRoute: Hashable {
  case calendar
}

private extension ISO8601DateFormatter {
  static let fractional: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
}
