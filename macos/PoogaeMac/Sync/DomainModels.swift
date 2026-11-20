import Foundation

/// Mirrors `types/domain.ts` + iCloud KVS payloads from the iOS app.

struct ReviewCheck: Codable, Hashable, Sendable {
  var done: Bool
  var updatedAt: String

  init(done: Bool, updatedAt: String) {
    self.done = done
    self.updatedAt = updatedAt
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    done = try c.decodeIfPresent(Bool.self, forKey: .done) ?? false
    updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
  }
}

struct SubjectChip: Codable, Identifiable, Hashable, Sendable {
  var id: String
  var name: String
  var color: String?
  var order: Int
  var updatedAt: String
  var deleted: Bool?

  init(
    id: String,
    name: String,
    color: String? = nil,
    order: Int,
    updatedAt: String,
    deleted: Bool? = nil
  ) {
    self.id = id
    self.name = name
    self.color = color
    self.order = order
    self.updatedAt = updatedAt
    self.deleted = deleted
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    name = try c.decode(String.self, forKey: .name)
    color = try c.decodeIfPresent(String.self, forKey: .color)
    order = try c.decodeIfPresent(Int.self, forKey: .order) ?? 0
    updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
    deleted = try c.decodeIfPresent(Bool.self, forKey: .deleted)
  }
}

struct StudyRecord: Codable, Identifiable, Hashable, Sendable {
  var id: String
  var subjectId: String
  var subjectName: String
  var subjectColor: String?
  var content: String
  var memo: String?
  var studiedOn: String
  /// Optional day-band for study-day UI (same as iOS).
  var dayBand: DayBandId?
  var cycle: [Int]
  var checks: [String: ReviewCheck]
  var createdAt: String
  var updatedAt: String
  var deleted: Bool?

  init(
    id: String,
    subjectId: String,
    subjectName: String,
    subjectColor: String? = nil,
    content: String,
    memo: String? = nil,
    studiedOn: String,
    dayBand: DayBandId? = nil,
    cycle: [Int],
    checks: [String: ReviewCheck],
    createdAt: String,
    updatedAt: String,
    deleted: Bool? = nil
  ) {
    self.id = id
    self.subjectId = subjectId
    self.subjectName = subjectName
    self.subjectColor = subjectColor
    self.content = content
    self.memo = memo
    self.studiedOn = DateKeys.normalizeDateKey(studiedOn)
    self.dayBand = dayBand
    self.cycle = cycle
    self.checks = checks
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.deleted = deleted
  }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(String.self, forKey: .id)
    subjectId = try c.decodeIfPresent(String.self, forKey: .subjectId) ?? ""
    subjectName = try c.decodeIfPresent(String.self, forKey: .subjectName) ?? ""
    subjectColor = try c.decodeIfPresent(String.self, forKey: .subjectColor)
    content = try c.decodeIfPresent(String.self, forKey: .content) ?? ""
    memo = try c.decodeIfPresent(String.self, forKey: .memo)
    let rawStudiedOn: String
    if let value = try c.decodeIfPresent(String.self, forKey: .studiedOn) {
      rawStudiedOn = value
    } else if let created = try c.decodeIfPresent(String.self, forKey: .createdAt) {
      rawStudiedOn = String(created.prefix(10))
    } else {
      rawStudiedOn = ""
    }
    studiedOn = DateKeys.normalizeDateKey(rawStudiedOn)
    dayBand = try c.decodeIfPresent(DayBandId.self, forKey: .dayBand)
    cycle = try c.decodeIfPresent([Int].self, forKey: .cycle) ?? ReviewIntervals.days
    checks = try c.decodeIfPresent([String: ReviewCheck].self, forKey: .checks) ?? [:]
    createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
    updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt) ?? createdAt
    deleted = try c.decodeIfPresent(Bool.self, forKey: .deleted)
  }
}

enum DayBandId: String, Codable, Hashable, Sendable, CaseIterable {
  case morning
  case afternoon
  case evening
}

struct SubjectsPayload: Codable, Sendable {
  var deviceId: String
  var subjects: [SubjectChip]
}

struct MonthPayload: Codable, Sendable {
  var deviceId: String
  var records: [StudyRecord]
}

struct AppData: Sendable {
  var subjects: [SubjectChip]
  var records: [StudyRecord]

  static let empty = AppData(subjects: [], records: [])
}

enum KVSKeys {
  static let subjects = "subjects"
  static let monthPrefix = "rec/"

  static func monthKey(_ yearMonth: String) -> String {
    monthPrefix + yearMonth
  }

  static func yearMonth(from dateKey: String) -> String {
    String(DateKeys.normalizeDateKey(dateKey).prefix(7))
  }
}

enum ReviewIntervals {
  /// Same curve as `constants/review.ts`.
  static let days: [Int] = [1, 3, 7, 15, 30, 60]
}
