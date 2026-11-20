import Foundation

/// Mirrors `types/domain.ts` + iCloud KVS payloads from the iOS app.

struct ReviewCheck: Codable, Hashable, Sendable {
  var done: Bool
  var updatedAt: String
}

struct SubjectChip: Codable, Identifiable, Hashable, Sendable {
  var id: String
  var name: String
  var color: String?
  var order: Int
  var updatedAt: String
  var deleted: Bool?
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
    String(dateKey.prefix(7))
  }
}

enum ReviewIntervals {
  /// Same curve as `constants/review.ts`.
  static let days: [Int] = [1, 3, 7, 15, 30, 60]
}
