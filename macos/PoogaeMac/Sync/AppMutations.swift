import Foundation

/// Port of iOS `storage/app-data.ts` create/seed helpers (Mac-side, no schedules).
enum AppMutations {
  static let maxStudiesPerDay = 3
  static let maxTitleLength = 40
  static let maxMemoLength = 120

  static let defaultSubjects: [SubjectChip] = [
    SubjectChip(
      id: "sub-jeongong",
      name: "전공",
      color: "#62B3F6",
      order: 0,
      updatedAt: "1970-01-01T00:00:00.000Z",
      deleted: nil
    ),
  ]

  static func countStudies(on dateKey: String, in data: AppData) -> Int {
    ICloudMerge.activeRecords(data.records).filter { $0.studiedOn == dateKey }.count
  }

  static func ensureSeedSubjects(_ data: AppData, now: Date = Date()) -> AppData {
    if !ICloudMerge.activeSubjects(data.subjects).isEmpty {
      return data
    }
    let at = ISO8601DateFormatter.fractional.string(from: now)
    let seeded = defaultSubjects.map { chip -> SubjectChip in
      var next = chip
      next.updatedAt = at
      return next
    }
    return AppData(subjects: seeded, records: data.records)
  }

  static func appendStudy(
    _ data: AppData,
    subjectId: String,
    content: String,
    memo: String?,
    studiedOn: String,
    now: Date = Date()
  ) -> AppData? {
    var next = ensureSeedSubjects(data, now: now)
    guard countStudies(on: studiedOn, in: next) < maxStudiesPerDay else { return nil }

    let title = String(content.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxTitleLength))
    guard !title.isEmpty else { return nil }

    let memoValue: String?
    if let memo {
      let trimmed = String(memo.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxMemoLength))
      memoValue = trimmed.isEmpty ? nil : trimmed
    } else {
      memoValue = nil
    }

    guard let subject = ICloudMerge.activeSubjects(next.subjects).first(where: { $0.id == subjectId })
    else { return nil }

    let at = ISO8601DateFormatter.fractional.string(from: now)
    let cycle = ReviewIntervals.days
    var checks: [String: ReviewCheck] = [:]
    for interval in cycle {
      checks[String(interval)] = ReviewCheck(done: false, updatedAt: at)
    }

    let record = StudyRecord(
      id: "study-\(UUID().uuidString.lowercased())",
      subjectId: subject.id,
      subjectName: subject.name,
      subjectColor: subject.color,
      content: title,
      memo: memoValue,
      studiedOn: studiedOn,
      cycle: cycle,
      checks: checks,
      createdAt: at,
      updatedAt: at,
      deleted: nil
    )

    next.records.append(record)
    return next
  }

  static func dateKeysWithStudies(_ data: AppData) -> Set<String> {
    Set(ICloudMerge.activeRecords(data.records).map(\.studiedOn))
  }
}

extension ISO8601DateFormatter {
  static let fractional: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
}
