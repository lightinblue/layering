import Foundation

/// Port of `utils/icloud-merge.ts` (read-side helpers for milestone 1).

enum ICloudMerge {
  static let softDeletePurgeDays = 180

  /// LWW for KVS `prefs` (matches iOS `mergeSyncedPrefsPayload`).
  static func mergeSyncedPrefs(
    local: SyncedPrefsPayload?,
    remote: SyncedPrefsPayload?,
    localDeviceId: String
  ) -> SyncedPrefsPayload? {
    guard let remote else { return local }
    guard let local else { return remote }
    let winner = pickWinner(
      local: local,
      remote: remote,
      localUpdatedAt: local.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
      localDeviceId: local.deviceId.isEmpty ? localDeviceId : local.deviceId,
      remoteDeviceId: remote.deviceId
    )
    return winner
  }

  static func parseIso(_ iso: String) -> TimeInterval {
    ISO8601DateFormatter.fractional.date(from: iso)?.timeIntervalSince1970
      ?? ISO8601DateFormatter().date(from: iso)?.timeIntervalSince1970
      ?? 0
  }

  static func pickWinner<T>(
    local: T,
    remote: T,
    localUpdatedAt: String,
    remoteUpdatedAt: String,
    localDeviceId: String,
    remoteDeviceId: String
  ) -> T {
    let localTs = parseIso(localUpdatedAt)
    let remoteTs = parseIso(remoteUpdatedAt)
    if localTs > remoteTs { return local }
    if remoteTs > localTs { return remote }
    return localDeviceId >= remoteDeviceId ? local : remote
  }

  static func mergeChecks(
    _ local: [String: ReviewCheck]?,
    _ remote: [String: ReviewCheck]?
  ) -> [String: ReviewCheck] {
    var keys = Set((local ?? [:]).keys)
    keys.formUnion((remote ?? [:]).keys)
    var out: [String: ReviewCheck] = [:]
    for key in keys {
      let a = local?[key]
      let b = remote?[key]
      if let a, let b {
        out[key] = parseIso(a.updatedAt) >= parseIso(b.updatedAt) ? a : b
      } else if let a {
        out[key] = a
      } else if let b {
        out[key] = b
      }
    }
    return out
  }

  static func mergeStudy(
    local: StudyRecord,
    remote: StudyRecord,
    localDeviceId: String,
    remoteDeviceId: String
  ) -> StudyRecord {
    let base = pickWinner(
      local: local,
      remote: remote,
      localUpdatedAt: local.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
      localDeviceId: localDeviceId,
      remoteDeviceId: remoteDeviceId
    )
    let other = base.id == local.id && base.updatedAt == local.updatedAt ? remote : local
    var merged = base
    merged.checks = mergeChecks(local.checks, remote.checks)
    if merged.cycle.isEmpty {
      merged.cycle = other.cycle
    }
    return merged
  }

  static func mergeSubject(
    local: SubjectChip,
    remote: SubjectChip,
    localDeviceId: String,
    remoteDeviceId: String
  ) -> SubjectChip {
    pickWinner(
      local: local,
      remote: remote,
      localUpdatedAt: local.updatedAt,
      remoteUpdatedAt: remote.updatedAt,
      localDeviceId: localDeviceId,
      remoteDeviceId: remoteDeviceId
    )
  }

  static func mergeById<T>(
    local: [T],
    remote: [T],
    id: (T) -> String,
    localDeviceId: String,
    remoteDeviceId: String,
    mergeOne: (T, T, String, String) -> T
  ) -> [T] {
    var map: [String: T] = [:]
    for item in local {
      map[id(item)] = item
    }
    for item in remote {
      let key = id(item)
      if let existing = map[key] {
        map[key] = mergeOne(existing, item, localDeviceId, remoteDeviceId)
      } else {
        map[key] = item
      }
    }
    return Array(map.values)
  }

  static func isTombstoneExpired(_ updatedAt: String, now: Date = Date()) -> Bool {
    let age = now.timeIntervalSince1970 - parseIso(updatedAt)
    return age >= Double(softDeletePurgeDays) * 24 * 60 * 60
  }

  static func purgeExpired(_ data: AppData, now: Date = Date()) -> AppData {
    AppData(
      subjects: data.subjects.filter { !(($0.deleted ?? false) && isTombstoneExpired($0.updatedAt, now: now)) },
      records: data.records.filter { !(($0.deleted ?? false) && isTombstoneExpired($0.updatedAt, now: now)) }
    )
  }

  static func mergeAppData(
    local: AppData,
    remoteSubjects: [SubjectChip],
    remoteRecords: [StudyRecord],
    localDeviceId: String,
    remoteDeviceId: String,
    now: Date = Date()
  ) -> AppData {
    let subjects = mergeById(
      local: local.subjects,
      remote: remoteSubjects,
      id: \.id,
      localDeviceId: localDeviceId,
      remoteDeviceId: remoteDeviceId,
      mergeOne: mergeSubject
    )
    .sorted { a, b in
      if a.order != b.order { return a.order < b.order }
      return a.name.localizedStandardCompare(b.name) == .orderedAscending
    }

    let records = mergeById(
      local: local.records,
      remote: remoteRecords,
      id: \.id,
      localDeviceId: localDeviceId,
      remoteDeviceId: remoteDeviceId,
      mergeOne: mergeStudy
    )

    return purgeExpired(AppData(subjects: subjects, records: records), now: now)
  }

  static func activeSubjects(_ subjects: [SubjectChip]) -> [SubjectChip] {
    subjects
      .filter { !($0.deleted ?? false) }
      .sorted { a, b in
        if a.order != b.order { return a.order < b.order }
        return a.name.localizedStandardCompare(b.name) == .orderedAscending
      }
  }

  static func activeRecords(_ records: [StudyRecord]) -> [StudyRecord] {
    records.filter { !($0.deleted ?? false) }
  }

  /// Fold user-visible text for twin detection (NFC + collapse whitespace).
  /// Mac often stores NFD Hangul while phone stores NFC — looks identical, bytes differ.
  static func foldedText(_ raw: String) -> String {
    raw
      .precomposedStringWithCanonicalMapping
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
  }

  /**
   Fingerprint for content twins (different ids, same day + subject chip + title).
   Uses **subjectName** (what home shows), not subjectId — seed/cloud subject-id
   drift used to leave identical-looking rows alive under a subjectId-only key.
   */
  static func studyContentKey(_ record: StudyRecord) -> String {
    let day = DateKeys.normalizeDateKey(record.studiedOn)
    let subject = foldedText(record.subjectName)
    let content = foldedText(record.content)
    return "\(day)|\(subject)|\(content)"
  }

  struct ContaminationCleanup {
    var data: AppData
    var seedSubjectsTombstoned: Int
    var seedRecordsTombstoned: Int
    var twinsTombstoned: Int
    var didChange: Bool { seedSubjectsTombstoned + seedRecordsTombstoned + twinsTombstoned > 0 }
  }

  /// True when a row looks like Showcase / screenshot demo junk (not Y's real studies).
  static func isShowcaseRecord(_ record: StudyRecord) -> Bool {
    if ShowcaseSeed.isSeedId(record.id) { return true }
    if ShowcaseSeed.isSeedId(record.subjectId) { return true }
    // Demo title + ASC-only subject names — never strip 교육학/점검/기타/분류 by title alone.
    let ascOnlyNames: Set<String> = ["국어", "목록", "학도", "매체"]
    let name = foldedText(record.subjectName)
    let content = foldedText(record.content)
    if ascOnlyNames.contains(name), ShowcaseSeed.knownDemoContents.contains(content) {
      return true
    }
    return false
  }

  static func isShowcaseSubject(_ subject: SubjectChip) -> Bool {
    ShowcaseSeed.isSeedId(subject.id)
  }

  /**
   Soft-delete Showcase/screenshot seed rows + content twins.
   Keeps genuine pre-seed studies (e.g. 교육학/점검/기타). Idempotent; pushes via caller.
   */
  static func recoverFromShowcaseContamination(
    _ data: AppData,
    now: Date = Date()
  ) -> ContaminationCleanup {
    let stamp = ISO8601DateFormatter.fractional.string(from: now)
    var seedSubjects = 0
    var seedRecords = 0

    let subjects: [SubjectChip] = data.subjects.map { subject in
      guard !(subject.deleted ?? false), isShowcaseSubject(subject) else { return subject }
      seedSubjects += 1
      var next = subject
      next.deleted = true
      next.updatedAt = stamp
      return next
    }

    let records: [StudyRecord] = data.records.map { record in
      guard !(record.deleted == true), isShowcaseRecord(record) else { return record }
      seedRecords += 1
      var next = record
      next.deleted = true
      next.updatedAt = stamp
      return next
    }

    let deduped = dedupeStudyRecords(records, now: now)
    let beforeActive = records.filter { !($0.deleted == true) }.count
    let afterActive = deduped.records.filter { !($0.deleted == true) }.count
    let twins = max(0, beforeActive - afterActive)

    return ContaminationCleanup(
      data: AppData(subjects: subjects, records: deduped.records),
      seedSubjectsTombstoned: seedSubjects,
      seedRecordsTombstoned: seedRecords,
      twinsTombstoned: twins
    )
  }

  /**
   Collapse same-id rows (LWW), then soft-delete active content twins.
   Keeps the newest `updatedAt` (tie → lexicographically greater id). Does not
   drop tombstones. Returns whether any row was removed or tombstoned.
   */
  static func dedupeStudyRecords(
    _ records: [StudyRecord],
    now: Date = Date()
  ) -> (records: [StudyRecord], didChange: Bool) {
    var byId: [String: StudyRecord] = [:]
    var idCollapsed = false
    for record in records {
      if let existing = byId[record.id] {
        idCollapsed = true
        byId[record.id] = pickWinner(
          local: existing,
          remote: record,
          localUpdatedAt: existing.updatedAt,
          remoteUpdatedAt: record.updatedAt,
          localDeviceId: existing.id,
          remoteDeviceId: record.id
        )
      } else {
        byId[record.id] = record
      }
    }

    let stamp = ISO8601DateFormatter.fractional.string(from: now)
    var keptActiveKey: [String: StudyRecord] = [:]
    var out: [StudyRecord] = []
    var tombstoned = false

    let ordered = byId.values.sorted { a, b in
      let at = parseIso(a.updatedAt)
      let bt = parseIso(b.updatedAt)
      if at != bt { return at > bt }
      return a.id > b.id
    }

    for record in ordered {
      if record.deleted == true {
        out.append(record)
        continue
      }
      let key = studyContentKey(record)
      if keptActiveKey[key] != nil {
        var tomb = record
        tomb.deleted = true
        tomb.updatedAt = stamp
        out.append(tomb)
        tombstoned = true
      } else {
        keptActiveKey[key] = record
        out.append(record)
      }
    }

    return (out, idCollapsed || tombstoned)
  }
}
