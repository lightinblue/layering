import Foundation

/// Mirrors `TodayReviewWidgetSnapshot` from
/// `utils/today-review-widget-snapshot.ts` / App Group key `todayReviewWidget.v1`.
struct TodayReviewSnapshot: Codable, Equatable {
  var updatedAt: String
  var todayKey: String
  var totalCount: Int
  var remainingCount: Int
  var items: [TodayReviewItem]

  static let empty = TodayReviewSnapshot(
    updatedAt: "",
    todayKey: "",
    totalCount: 0,
    remainingCount: 0,
    items: []
  )

  var isEmpty: Bool {
    totalCount == 0 && items.isEmpty
  }
}

struct TodayReviewItem: Codable, Equatable, Identifiable {
  var id: String
  var intervalDays: Int
  var completed: Bool
  var subjects: [TodayReviewSubject]

  var intervalLabel: String {
    "\(intervalDays)일 전"
  }
}

struct TodayReviewSubject: Codable, Equatable, Identifiable {
  var name: String
  var color: String
  var glyph: String

  var id: String { "\(name)-\(color)" }

  /// Full subject name (app caps at 4); glyph only if name somehow empty.
  var chipLabel: String {
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      return glyph.isEmpty ? "?" : String(glyph.prefix(1))
    }
    return String(trimmed.prefix(4))
  }
}

enum TodayReviewStore {
  static let appGroupId = "group.com.lightinblue.layering.poogae"
  static let snapshotKey = "todayReviewWidget.v1"
  /// Existing Expo scheme (`app.json` → `scheme: "layering"`). Opens today home.
  static let homeURL = URL(string: "layering://")!

  static func loadSnapshot() -> TodayReviewSnapshot {
    guard
      let defaults = UserDefaults(suiteName: appGroupId),
      let json = defaults.string(forKey: snapshotKey),
      let data = json.data(using: .utf8)
    else {
      return .empty
    }

    do {
      return try JSONDecoder().decode(TodayReviewSnapshot.self, from: data)
    } catch {
      return .empty
    }
  }

  /// Next local midnight — TimelineProvider policy so day rollover refreshes.
  static func nextMidnight(after date: Date = Date()) -> Date {
    let calendar = Calendar.current
    let start = calendar.startOfDay(for: date)
    return calendar.date(byAdding: .day, value: 1, to: start) ?? date.addingTimeInterval(60 * 60 * 24)
  }
}
