import Foundation

/// Port of `utils/icloud-merge.ts` (read-side helpers for milestone 1).

enum ICloudMerge {
  static let softDeletePurgeDays = 180

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
}

private extension ISO8601DateFormatter {
  static let fractional: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
}
