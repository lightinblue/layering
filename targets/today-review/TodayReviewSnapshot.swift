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

  enum CodingKeys: String, CodingKey {
    case id, intervalDays, completed, subjects
  }

  init(
    id: String,
    intervalDays: Int,
    completed: Bool,
    subjects: [TodayReviewSubject]
  ) {
    self.id = id
    self.intervalDays = intervalDays
    self.completed = completed
    self.subjects = subjects
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    intervalDays = try container.decode(Int.self, forKey: .intervalDays)
    // Prefer Bool; also accept 0/1 in case a bridge wrote numbers.
    if let flag = try container.decodeIfPresent(Bool.self, forKey: .completed) {
      completed = flag
    } else if let number = try container.decodeIfPresent(Int.self, forKey: .completed) {
      completed = number != 0
    } else {
      completed = false
    }
    subjects = try container.decodeIfPresent([TodayReviewSubject].self, forKey: .subjects) ?? []
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
    guard let defaults = UserDefaults(suiteName: appGroupId) else {
      return .empty
    }
    // Cross-process App Group reads can lag without a flush.
    defaults.synchronize()

    let data: Data?
    if let json = defaults.string(forKey: snapshotKey) {
      data = json.data(using: .utf8)
    } else if let raw = defaults.data(forKey: snapshotKey) {
      // ExtensionStorage.setObject stores JSON Data instead of String.
      data = raw
    } else {
      data = nil
    }

    guard let data else {
      return .empty
    }

    do {
      return try JSONDecoder().decode(TodayReviewSnapshot.self, from: data)
    } catch {
      return .empty
    }
  }

  /// Next local midnight — day rollover refresh.
  static func nextMidnight(after date: Date = Date()) -> Date {
    let calendar = Calendar.current
    let start = calendar.startOfDay(for: date)
    return calendar.date(byAdding: .day, value: 1, to: start) ?? date.addingTimeInterval(60 * 60 * 24)
  }

  /// Coarser safety net when `reloadTimelines` is missed (e.g. wrong ofKind).
  static func nextFallbackReload(after date: Date = Date()) -> Date {
    date.addingTimeInterval(15 * 60)
  }

  static func nextTimelineReload(after date: Date = Date()) -> Date {
    min(nextMidnight(after: date), nextFallbackReload(after: date))
  }
}
