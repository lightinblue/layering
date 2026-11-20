import Foundation

enum DateKeys {
  private static let calendar: Calendar = {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = .current
    return cal
  }()

  static func todayKey(now: Date = Date()) -> String {
    toKey(now)
  }

  static func toKey(_ date: Date) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
  }

  static func addDays(_ isoDate: String, _ days: Int) -> String {
    guard let date = parse(isoDate) else { return isoDate }
    guard let next = calendar.date(byAdding: .day, value: days, to: date) else {
      return isoDate
    }
    return toKey(next)
  }

  static func parse(_ isoDate: String) -> Date? {
    let key = normalizeDateKey(isoDate)
    let parts = key.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    var comps = DateComponents()
    comps.year = parts[0]
    comps.month = parts[1]
    comps.day = parts[2]
    return calendar.date(from: comps)
  }

  /// Coerce `YYYY-MM-DD…` / ISO timestamps down to a calendar day key.
  static func normalizeDateKey(_ raw: String) -> String {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.count >= 10 else { return trimmed }
    let prefix = String(trimmed.prefix(10))
    let parts = prefix.split(separator: "-")
    guard parts.count == 3,
          parts[0].count == 4,
          parts[1].count == 2,
          parts[2].count == 2,
          parts.allSatisfy({ $0.allSatisfy(\.isNumber) })
    else { return trimmed }
    return prefix
  }

  /// Prefer today when it has studies; otherwise the latest studiedOn day.
  static func preferredHomeDateKey(today: String = todayKey(), records: [StudyRecord]) -> String {
    let active = ICloudMerge.activeRecords(records)
    let todayNorm = normalizeDateKey(today)
    if active.contains(where: { normalizeDateKey($0.studiedOn) == todayNorm }) {
      return todayNorm
    }
    return active.map { normalizeDateKey($0.studiedOn) }.sorted().last ?? todayNorm
  }

  static func yearMonth(from dateKey: String) -> String {
    String(dateKey.prefix(7))
  }

  /// Nearby months to pull for a home/calendar window (±1 around today).
  static func nearbyYearMonths(around dateKey: String = todayKey()) -> [String] {
    guard let date = parse(dateKey) else { return [yearMonth(from: dateKey)] }
    var keys: [String] = []
    for offset in -1...1 {
      if let shifted = calendar.date(byAdding: .month, value: offset, to: date) {
        keys.append(yearMonth(from: toKey(shifted)))
      }
    }
    return Array(Set(keys)).sorted()
  }
}
