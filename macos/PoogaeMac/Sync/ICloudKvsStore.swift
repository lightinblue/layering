import Foundation
import os.log

private let kvsLog = Logger(subsystem: "com.lightinblue.layering.mac", category: "KVS")

/// Thin wrapper around `NSUbiquitousKeyValueStore` — same keys as iOS Expo module.
/// Local UserDefaults mirror keeps Mac usable when iCloud is off; push when available.
@MainActor
final class ICloudKvsStore: ObservableObject {
  @Published private(set) var data: AppData = .empty
  @Published private(set) var iCloudAvailable: Bool = false
  @Published private(set) var lastReadAt: Date?
  @Published private(set) var statusMessage: String = "준비 중"

  private let store = NSUbiquitousKeyValueStore.default
  private var observer: NSObjectProtocol?
  private let deviceId: String
  private let localCacheKey = "poogae.mac.app-data-v1"
  private var applyingRemote = false
  /// True once we have seen non-empty cloud subjects or month records.
  private var hasSeenRemotePayload = false
  private var bootstrapRetryTask: Task<Void, Never>?

  init(deviceId: String = DeviceIdentity.loadOrCreate()) {
    self.deviceId = deviceId
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    if let cached = loadLocalCache() {
      // Local cache only — never push seed from init.
      data = cached
    }
    observer = NotificationCenter.default.addObserver(
      forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
      object: store,
      queue: .main
    ) { [weak self] notification in
      let reason = notification.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int
      let keys = notification.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
      Task { @MainActor in
        kvsLog.info("external change reason=\(reason ?? -1, privacy: .public) keys=\(keys.joined(separator: ","), privacy: .public)")
        await self?.refreshFromCloud()
      }
    }
  }

  deinit {
    if let observer {
      NotificationCenter.default.removeObserver(observer)
    }
    bootstrapRetryTask?.cancel()
  }

  func bootstrap() async {
    _ = store.synchronize()
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    await refreshFromCloud()

    // Local-only seed for empty UI. NEVER push — early push overwrites phone subjects
    // when KVS has not downloaded yet (looks like “클라우드 비어 있음”).
    if ICloudMerge.activeSubjects(data.subjects).isEmpty {
      data = AppMutations.ensureSeedSubjects(data)
      persistLocalCache(data)
      kvsLog.info("local seed applied (no cloud push)")
    }

    scheduleBootstrapRetries()
  }

  func refreshFromCloud() async {
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    _ = store.synchronize()

    let allKeys = store.dictionaryRepresentation.keys.compactMap { $0 as? String }
    let subjectKeys = allKeys.filter { $0 == KVSKeys.subjects }
    let monthKeys = allKeys
      .filter { $0.hasPrefix(KVSKeys.monthPrefix) }
      .sorted()

    let subjectsRead = readSubjects()
    let subjectsPayload = subjectsRead.payload
    var remoteRecords: [StudyRecord] = []
    var remoteDeviceId = subjectsPayload?.deviceId ?? ""
    var monthDecodeFailures = 0

    // Match iOS: read every `rec/*` key present in the store (not only ±1 month).
    let keysToRead = monthKeys.isEmpty
      ? DateKeys.nearbyYearMonths().map(KVSKeys.monthKey)
      : monthKeys

    for key in keysToRead {
      let monthRead = readMonth(key)
      if monthRead.hadRaw, monthRead.payload == nil {
        monthDecodeFailures += 1
        kvsLog.error("decode failed for \(key, privacy: .public)")
      }
      guard let month = monthRead.payload else { continue }
      remoteRecords.append(contentsOf: month.records)
      if remoteDeviceId.isEmpty {
        remoteDeviceId = month.deviceId
      }
    }

    let hadRemote =
      (subjectsPayload?.subjects.isEmpty == false)
      || !remoteRecords.isEmpty
    if hadRemote {
      hasSeenRemotePayload = true
    }

    applyingRemote = true
    defer { applyingRemote = false }

    let merged = ICloudMerge.mergeAppData(
      local: data,
      remoteSubjects: subjectsPayload?.subjects ?? [],
      remoteRecords: remoteRecords,
      localDeviceId: deviceId,
      remoteDeviceId: remoteDeviceId
    )

    if hadRemote {
      data = merged
      persistLocalCache(data)
      // Reconcile union to cloud after remote merge (same as iOS pullAndMerge).
      pushToCloud(data)
    } else if ICloudMerge.activeSubjects(merged.subjects).isEmpty {
      // Still empty after pull — seed locally only (epoch timestamps; never push here).
      data = AppMutations.ensureSeedSubjects(merged)
      persistLocalCache(data)
    } else {
      data = merged
      persistLocalCache(data)
    }

    lastReadAt = Date()
    statusMessage = makeStatus(
      iCloud: iCloudAvailable,
      subjectKeyPresent: !subjectKeys.isEmpty,
      subjectsDecoded: subjectsPayload != nil,
      subjectsDecodeFailed: subjectsRead.hadRaw && subjectsPayload == nil,
      monthKeyCount: monthKeys.count,
      remoteRecordCount: remoteRecords.count,
      monthDecodeFailures: monthDecodeFailures,
      hadRemote: hadRemote
    )
    kvsLog.info("\(self.statusMessage, privacy: .public) localSubjects=\(self.data.subjects.count) localRecords=\(self.data.records.count)")
  }

  /// Apply mutation, cache locally, and push to KVS when available.
  func applyLocal(_ next: AppData, push: Bool = true) {
    data = next
    persistLocalCache(next)
    guard push, !applyingRemote else { return }
    pushToCloud(next)
  }

  private func scheduleBootstrapRetries() {
    bootstrapRetryTask?.cancel()
    bootstrapRetryTask = Task { @MainActor in
      // KVS download is async; empty first read is normal. Retry before giving up.
      for delayNs in [2_000_000_000, 5_000_000_000, 12_000_000_000] as [UInt64] {
        try? await Task.sleep(nanoseconds: delayNs)
        if Task.isCancelled { return }
        if hasSeenRemotePayload { return }
        kvsLog.info("bootstrap re-pull after delay")
        _ = store.synchronize()
        await refreshFromCloud()
      }
    }
  }

  private func pushToCloud(_ next: AppData) {
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    guard iCloudAvailable else {
      statusMessage = "iCloud 없음 — 로컬만 (Team R39JVZ3ZNL + iCloud 로그인 확인)"
      return
    }

    let encoder = JSONEncoder()
    let subjectsPayload = SubjectsPayload(deviceId: deviceId, subjects: next.subjects)
    guard let subjectsData = try? encoder.encode(subjectsPayload),
          let subjectsJSON = String(data: subjectsData, encoding: .utf8)
    else { return }
    store.set(subjectsJSON, forKey: KVSKeys.subjects)

    var byMonth: [String: [StudyRecord]] = [:]
    for record in next.records {
      let ym = KVSKeys.yearMonth(from: record.studiedOn)
      byMonth[ym, default: []].append(record)
    }
    for (ym, records) in byMonth {
      let payload = MonthPayload(deviceId: deviceId, records: records)
      guard let monthData = try? encoder.encode(payload),
            let monthJSON = String(data: monthData, encoding: .utf8)
      else { continue }
      store.set(monthJSON, forKey: KVSKeys.monthKey(ym))
    }

    _ = store.synchronize()
    if !statusMessage.contains("KVS") {
      statusMessage = "KVS 동기화됨 · subjects=\(next.subjects.count) rec=\(next.records.count)"
    }
  }

  private struct DecodeRead<T> {
    var payload: T?
    var hadRaw: Bool
  }

  private func readSubjects() -> DecodeRead<SubjectsPayload> {
    guard let raw = store.string(forKey: KVSKeys.subjects) else {
      return DecodeRead(payload: nil, hadRaw: false)
    }
    guard let data = raw.data(using: .utf8) else {
      return DecodeRead(payload: nil, hadRaw: true)
    }
    do {
      let payload = try JSONDecoder().decode(SubjectsPayload.self, from: data)
      return DecodeRead(payload: payload, hadRaw: true)
    } catch {
      kvsLog.error("subjects decode error: \(error.localizedDescription, privacy: .public)")
      return DecodeRead(payload: nil, hadRaw: true)
    }
  }

  private func readMonth(_ key: String) -> DecodeRead<MonthPayload> {
    guard let raw = store.string(forKey: key) else {
      return DecodeRead(payload: nil, hadRaw: false)
    }
    guard let data = raw.data(using: .utf8) else {
      return DecodeRead(payload: nil, hadRaw: true)
    }
    do {
      let payload = try JSONDecoder().decode(MonthPayload.self, from: data)
      return DecodeRead(payload: payload, hadRaw: true)
    } catch {
      kvsLog.error("month \(key, privacy: .public) decode error: \(error.localizedDescription, privacy: .public)")
      return DecodeRead(payload: nil, hadRaw: true)
    }
  }

  private func makeStatus(
    iCloud: Bool,
    subjectKeyPresent: Bool,
    subjectsDecoded: Bool,
    subjectsDecodeFailed: Bool,
    monthKeyCount: Int,
    remoteRecordCount: Int,
    monthDecodeFailures: Int,
    hadRemote: Bool
  ) -> String {
    if !iCloud {
      return "iCloud 없음 — 로컬만 (Team R39JVZ3ZNL ≠ Personal)"
    }
    if subjectsDecodeFailed {
      return "subjects 디코드 실패 · rec keys=\(monthKeyCount)"
    }
    if monthDecodeFailures > 0 {
      return "KVS 일부 디코드 실패 · months=\(monthDecodeFailures) · rec=\(remoteRecordCount)"
    }
    if hadRemote {
      let subj = subjectsDecoded ? "ok" : (subjectKeyPresent ? "empty" : "missing")
      return "KVS 동기화됨 · subjects=\(subj) · rec keys=\(monthKeyCount) · records=\(remoteRecordCount)"
    }
    return "클라우드 대기/비어 있음 · keys subjects=\(subjectKeyPresent ? 1 : 0) rec=\(monthKeyCount)"
  }

  private func persistLocalCache(_ next: AppData) {
    let payload = LocalAppDataCache(subjects: next.subjects, records: next.records)
    guard let encoded = try? JSONEncoder().encode(payload) else { return }
    UserDefaults.standard.set(encoded, forKey: localCacheKey)
  }

  private func loadLocalCache() -> AppData? {
    guard let raw = UserDefaults.standard.data(forKey: localCacheKey),
          let payload = try? JSONDecoder().decode(LocalAppDataCache.self, from: raw)
    else { return nil }
    return AppData(subjects: payload.subjects, records: payload.records)
  }
}

private struct LocalAppDataCache: Codable {
  var subjects: [SubjectChip]
  var records: [StudyRecord]
}

enum DeviceIdentity {
  private static let key = "poogae.mac.device-id"

  static func loadOrCreate() -> String {
    if let existing = UserDefaults.standard.string(forKey: key), !existing.isEmpty {
      return existing
    }
    let id = UUID().uuidString.lowercased()
    UserDefaults.standard.set(id, forKey: key)
    return id
  }
}
