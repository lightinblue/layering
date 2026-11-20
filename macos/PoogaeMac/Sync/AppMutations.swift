import Foundation

/// Port of iOS `storage/app-data.ts` create/update/delete helpers (Mac-side, no schedules).
enum AppMutations {
  /// Matches iOS `TIMELINE_MAX_STUDIES_PER_DAY` (4+6+4).
  static let maxStudiesPerDay = StudyTimeline.maxStudiesPerDay
  static let maxSubjects = 10
  static let maxSubjectNameLength = 4
  static let maxTitleLength = 40
  static let maxMemoLength = 120

  static let subjectColorOptions: [String] = [
    "#F65E83", "#FE9253", "#F5C21C", "#5DCB85", "#62B3F6", "#B7A4E9", "#B2B2B2",
  ]

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

  enum SubjectFailure: Error, Equatable {
    case empty
    case tooLong
    case duplicate
    case limit
    case missing
  }

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

  static func normalizeSubjectName(_ raw: String) -> String? {
    let name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    return name.isEmpty ? nil : name
  }

  static func addSubject(
    _ data: AppData,
    rawName: String,
    color: String?,
    now: Date = Date()
  ) -> Result<AppData, SubjectFailure> {
    guard let name = normalizeSubjectName(rawName) else { return .failure(.empty) }
    if name.count > maxSubjectNameLength { return .failure(.tooLong) }
    let live = ICloudMerge.activeSubjects(data.subjects)
    if live.contains(where: { $0.name == name }) { return .failure(.duplicate) }
    if live.count >= maxSubjects { return .failure(.limit) }

    let at = ISO8601DateFormatter.fractional.string(from: now)
    let maxOrder = live.map(\.order).max() ?? -1
    var next = data
    next.subjects.append(
      SubjectChip(
        id: "sub-\(UUID().uuidString.lowercased())",
        name: name,
        color: normalizeColor(color),
        order: maxOrder + 1,
        updatedAt: at,
        deleted: nil
      )
    )
    return .success(next)
  }

  static func updateSubject(
    _ data: AppData,
    subjectId: String,
    rawName: String,
    color: String?,
    now: Date = Date()
  ) -> Result<AppData, SubjectFailure> {
    guard let name = normalizeSubjectName(rawName) else { return .failure(.empty) }
    if name.count > maxSubjectNameLength { return .failure(.tooLong) }
    guard let idx = data.subjects.firstIndex(where: { $0.id == subjectId && !($0.deleted ?? false) })
    else { return .failure(.missing) }

    let live = ICloudMerge.activeSubjects(data.subjects)
    if live.contains(where: { $0.id != subjectId && $0.name == name }) {
      return .failure(.duplicate)
    }

    let at = ISO8601DateFormatter.fractional.string(from: now)
    var next = data
    next.subjects[idx].name = name
    next.subjects[idx].color = normalizeColor(color)
    next.subjects[idx].updatedAt = at

    // Keep study snapshots in sync for this subject id.
    for i in next.records.indices where next.records[i].subjectId == subjectId && !(next.records[i].deleted ?? false) {
      next.records[i].subjectName = name
      next.records[i].subjectColor = next.subjects[idx].color
      next.records[i].updatedAt = at
    }
    return .success(next)
  }

  static func removeSubject(
    _ data: AppData,
    subjectId: String,
    now: Date = Date()
  ) -> Result<AppData, SubjectFailure> {
    guard let idx = data.subjects.firstIndex(where: { $0.id == subjectId && !($0.deleted ?? false) })
    else { return .failure(.missing) }
    let at = ISO8601DateFormatter.fractional.string(from: now)
    var next = data
    next.subjects[idx].deleted = true
    next.subjects[idx].updatedAt = at
    return .success(next)
  }

  static func appendStudy(
    _ data: AppData,
    subjectId: String,
    content: String,
    memo: String?,
    studiedOn: String,
    dayBand: DayBandId?,
    now: Date = Date()
  ) -> AppData? {
    var next = ensureSeedSubjects(data, now: now)
    guard countStudies(on: studiedOn, in: next) < maxStudiesPerDay else { return nil }

    let fields = clampStudyFields(content: content, memo: memo)
    guard !fields.content.isEmpty else { return nil }
    guard let subject = ICloudMerge.activeSubjects(next.subjects).first(where: { $0.id == subjectId })
    else { return nil }

    let at = ISO8601DateFormatter.fractional.string(from: now)
    let cycle = ReviewIntervals.days
    var checks: [String: ReviewCheck] = [:]
    for interval in cycle {
      checks[String(interval)] = ReviewCheck(done: false, updatedAt: at)
    }

    next.records.append(
      StudyRecord(
        id: "study-\(UUID().uuidString.lowercased())",
        subjectId: subject.id,
        subjectName: subject.name,
        subjectColor: subject.color,
        content: fields.content,
        memo: fields.memo,
        studiedOn: studiedOn,
        dayBand: dayBand,
        cycle: cycle,
        checks: checks,
        createdAt: at,
        updatedAt: at,
        deleted: nil
      )
    )
    return next
  }

  static func updateStudy(
    _ data: AppData,
    studyId: String,
    subjectId: String,
    content: String,
    memo: String?,
    studiedOn: String,
    now: Date = Date()
  ) -> AppData? {
    guard let idx = data.records.firstIndex(where: { $0.id == studyId && !($0.deleted ?? false) })
    else { return nil }

    if data.records[idx].studiedOn != studiedOn {
      let others = ICloudMerge.activeRecords(data.records)
        .filter { $0.studiedOn == studiedOn && $0.id != studyId }
        .count
      if others >= maxStudiesPerDay { return nil }
    }

    let fields = clampStudyFields(content: content, memo: memo)
    guard !fields.content.isEmpty else { return nil }
    guard let subject = ICloudMerge.activeSubjects(data.subjects).first(where: { $0.id == subjectId })
    else { return nil }

    let at = ISO8601DateFormatter.fractional.string(from: now)
    var next = data
    var record = next.records[idx]
    let cycle = record.cycle.isEmpty ? ReviewIntervals.days : record.cycle
    var checks = record.checks
    for interval in cycle {
      let key = String(interval)
      if checks[key] == nil {
        checks[key] = ReviewCheck(done: false, updatedAt: at)
      }
    }
    record.subjectId = subject.id
    record.subjectName = subject.name
    record.subjectColor = subject.color
    record.content = fields.content
    record.memo = fields.memo
    record.studiedOn = studiedOn
    // Keep existing dayBand on edit (iOS day screen does the same).
    record.cycle = cycle
    record.checks = checks
    record.updatedAt = at
    next.records[idx] = record
    return next
  }

  static func deleteStudy(
    _ data: AppData,
    studyId: String,
    now: Date = Date()
  ) -> AppData? {
    guard let idx = data.records.firstIndex(where: { $0.id == studyId && !($0.deleted ?? false) })
    else { return nil }
    let at = ISO8601DateFormatter.fractional.string(from: now)
    var next = data
    next.records[idx].deleted = true
    next.records[idx].updatedAt = at
    return next
  }

  static func dateKeysWithStudies(_ data: AppData) -> Set<String> {
    Set(ICloudMerge.activeRecords(data.records).map(\.studiedOn))
  }

  static func clampStudyFields(content: String, memo: String?) -> (content: String, memo: String?) {
    let title = String(content.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxTitleLength))
    let memoValue: String?
    if let memo {
      let trimmed = String(memo.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxMemoLength))
      memoValue = trimmed.isEmpty ? nil : trimmed
    } else {
      memoValue = nil
    }
    return (title, memoValue)
  }

  private static func normalizeColor(_ raw: String?) -> String {
    let trimmed = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if trimmed.hasPrefix("#"), trimmed.count == 7 { return trimmed }
    return subjectColorOptions[4] // blue
  }
}

extension ISO8601DateFormatter {
  static let fractional: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
}
