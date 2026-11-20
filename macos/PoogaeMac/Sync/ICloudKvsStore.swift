import Foundation
import os.log

private let kvsLog = Logger(subsystem: "com.lightinblue.layering.mac", category: "KVS")

/// Thin wrapper around `NSUbiquitousKeyValueStore` — same keys as iOS Expo module.
/// Local UserDefaults mirror keeps Mac usable when iCloud is off; push when available.
@MainActor
final class ICloudKvsStore: ObservableObject {
  @Published private(set) var data: AppData = .empty
  /// Synced device settings (KVS `prefs`) — weekStartsOn + optional themePrimary.
  @Published private(set) var prefs: SyncedPrefsBody = .default
  @Published private(set) var iCloudAvailable: Bool = false
  @Published private(set) var lastReadAt: Date?
  @Published private(set) var statusMessage: String = "준비 중"
  /// Compact dump for menu-bar diagnostics (keys + sizes).
  @Published private(set) var debugSummary: String = ""

  /// Must match iOS `app.json` ubiquity-kvstore-identifier (TeamPrefix + com.lightinblue.layering).
  static let expectedKvStoreId = "R39JVZ3ZNL.com.lightinblue.layering"

  private let store = NSUbiquitousKeyValueStore.default
  private var observer: NSObjectProtocol?
  private let deviceId: String
  private let localCacheKey = "poogae.mac.app-data-v1"
  private let localPrefsCacheKey = "poogae.mac.synced-prefs-v1"
  private var prefsUpdatedAt: String = "1970-01-01T00:00:00.000Z"
  private var applyingRemote = false
  /// True once we have seen non-empty cloud subjects or month records.
  private var hasSeenRemotePayload = false
  private var bootstrapRetryTask: Task<Void, Never>?
  private var pullFeedbackTask: Task<Void, Never>?

  init(deviceId: String = DeviceIdentity.loadOrCreate()) {
    self.deviceId = deviceId
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    if let cached = loadLocalCache() {
      // Local cache only — never push seed from init.
      data = cached
    }
    if let cachedPrefs = loadLocalPrefsCache() {
      prefs = cachedPrefs.prefs
      prefsUpdatedAt = cachedPrefs.updatedAt
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
        await self?.refreshFromCloud(mode: .pullOnly)
      }
    }
  }

  deinit {
    if let observer {
      NotificationCenter.default.removeObserver(observer)
    }
    bootstrapRetryTask?.cancel()
    pullFeedbackTask?.cancel()
  }

  enum PullMode {
    /// Read + merge into memory/cache. Never write back to KVS (avoids Mac tombstone poison).
    case pullOnly
    /// Drop local first, then adopt remote snapshot (or empty) without pushing.
    case hardReset
  }

  func bootstrap() async {
    logEnvironment()
    _ = store.synchronize()
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    await refreshFromCloud(mode: .pullOnly)

    // Local-only seed for empty UI. NEVER push — early push overwrites phone subjects
    // when KVS has not downloaded yet (looks like “클라우드 비어 있음”).
    if ICloudMerge.activeSubjects(data.subjects).isEmpty {
      data = AppMutations.ensureSeedSubjects(data)
      persistLocalCache(data)
      kvsLog.info("local seed applied (no cloud push)")
    }

    scheduleBootstrapRetries()
  }

  func refreshFromCloud(mode: PullMode = .pullOnly) async {
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    _ = store.synchronize()

    let dict = store.dictionaryRepresentation
    let allKeys = Array(dict.keys).sorted()
    let subjectKeys = allKeys.filter { $0 == KVSKeys.subjects }
    let monthKeys = allKeys.filter { $0.hasPrefix(KVSKeys.monthPrefix) }
    let otherKeys = allKeys.filter {
      $0 != KVSKeys.subjects && $0 != KVSKeys.prefs && !$0.hasPrefix(KVSKeys.monthPrefix)
    }

    logDictionary(dict, allKeys: allKeys)

    pullAndMergePrefs()

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
      remoteRecords.append(contentsOf: month.records.map(Self.normalizedRecord))
      if remoteDeviceId.isEmpty {
        remoteDeviceId = month.deviceId
      }
    }

    let remoteSubjects = subjectsPayload?.subjects ?? []
    let hadRemote = !remoteSubjects.isEmpty || !remoteRecords.isEmpty
    if hadRemote {
      hasSeenRemotePayload = true
    }

    applyingRemote = true
    defer { applyingRemote = false }

    let localForMerge: AppData = (mode == .hardReset) ? .empty : data
    let merged = ICloudMerge.mergeAppData(
      local: localForMerge,
      remoteSubjects: remoteSubjects,
      remoteRecords: remoteRecords,
      localDeviceId: deviceId,
      remoteDeviceId: remoteDeviceId
    )

    let normalized = Self.normalizedAppData(merged)
    if hadRemote {
      // Adopt cloud into AppModel. Do NOT push — Mac pull used to re-write tombstones
      // and could win LWW over newer phone actives.
      data = normalized
      persistLocalCache(data)
    } else if ICloudMerge.activeSubjects(normalized.subjects).isEmpty {
      if mode == .hardReset {
        data = .empty
        persistLocalCache(data)
      } else {
        // Still empty after pull — seed locally only (epoch timestamps; never push here).
        data = AppMutations.ensureSeedSubjects(normalized)
        persistLocalCache(data)
      }
    } else {
      data = normalized
      persistLocalCache(data)
    }

    lastReadAt = Date()
    let activeSubjects = ICloudMerge.activeSubjects(data.subjects)
    let activeTotal = ICloudMerge.activeRecords(data.records).count
    let deletedTotal = data.records.filter { $0.deleted == true }.count
    let studiedDays = Set(
      ICloudMerge.activeRecords(data.records).map { DateKeys.normalizeDateKey($0.studiedOn) }
    ).sorted()
    statusMessage = makeStatus(
      iCloud: iCloudAvailable,
      subjectKeyPresent: !subjectKeys.isEmpty,
      subjectsDecoded: subjectsPayload != nil,
      subjectsDecodeFailed: subjectsRead.hadRaw && subjectsPayload == nil,
      subjectNames: activeSubjects.map(\.name),
      monthKeyCount: monthKeys.count,
      remoteRecordCount: remoteRecords.count,
      activeRecordCount: activeTotal,
      deletedRecordCount: deletedTotal,
      studiedDays: studiedDays,
      monthDecodeFailures: monthDecodeFailures,
      hadRemote: hadRemote,
      totalKeyCount: allKeys.count
    )
    debugSummary = makeDebugSummary(
      allKeys: allKeys,
      monthKeys: monthKeys,
      otherKeys: otherKeys,
      dict: dict,
      subjectsBytes: subjectsRead.rawByteCount,
      records: data.records,
      activeSubjects: activeSubjects
    )
    for record in data.records {
      kvsLog.info(
        "record id=\(record.id, privacy: .public) studiedOn=\(record.studiedOn, privacy: .public) deleted=\(record.deleted ?? false) content=\(record.content.prefix(24), privacy: .public)"
      )
    }
    kvsLog.info("\(self.statusMessage, privacy: .public) localSubjects=\(self.data.subjects.count) localRecords=\(self.data.records.count)")
    kvsLog.info("debug \(self.debugSummary, privacy: .public)")
  }

  /// User-initiated pull — always flashes status so the menu bar shows feedback even when
  /// the settled message matches the previous one (common when cloud is unchanged).
  func forcePullFromICloud() async {
    pullFeedbackTask?.cancel()
    statusMessage = "다시 받는 중…"
    kvsLog.info("user force pull")
    _ = store.synchronize()
    await refreshFromCloud(mode: .pullOnly)
    flashSettledStatus()
  }

  /// Wipe Mac local mirror + in-memory state, re-pull cloud as source of truth (never pushes).
  func resetLocalStoreAndPull() async {
    pullFeedbackTask?.cancel()
    UserDefaults.standard.removeObject(forKey: localCacheKey)
    data = .empty
    hasSeenRemotePayload = false
    statusMessage = "하드 리셋 후 재동기화…"
    debugSummary = ""
    kvsLog.info("hard reset: local cache cleared; pull-only (no push)")
    _ = store.synchronize()
    await refreshFromCloud(mode: .hardReset)
    if !hasSeenRemotePayload {
      scheduleBootstrapRetries()
    }
    flashSettledStatus()
  }

  private func flashSettledStatus() {
    let settled = statusMessage
    statusMessage = "방금 갱신 · \(settled)"
    pullFeedbackTask = Task { @MainActor in
      try? await Task.sleep(nanoseconds: 2_500_000_000)
      guard !Task.isCancelled else { return }
      if statusMessage.hasPrefix("방금 갱신 · ") {
        statusMessage = settled
      }
    }
  }

  /// Apply mutation, cache locally, and push to KVS when available.
  func applyLocal(_ next: AppData, push: Bool = true) {
    data = next
    persistLocalCache(next)
    guard push, !applyingRemote else { return }
    pushToCloud(next)
  }

  /// Update synced prefs locally and push KVS `prefs` (LWW stamp = now).
  func updatePrefs(_ mutate: (inout SyncedPrefsBody) -> Void) {
    guard !applyingRemote else { return }
    var next = prefs
    mutate(&next)
    next.weekStartsOn = (next.weekStartsOn == 1) ? 1 : 0
    prefs = next
    let stamp = ISO8601DateFormatter.fractional.string(from: Date())
    prefsUpdatedAt = stamp
    persistLocalPrefsCache(
      SyncedPrefsPayload(deviceId: deviceId, updatedAt: stamp, prefs: next)
    )
    pushPrefsToCloud(
      SyncedPrefsPayload(deviceId: deviceId, updatedAt: stamp, prefs: next)
    )
  }

  /// Pull/merge KVS `prefs` with local mirror. Seeds cloud once if empty.
  private func pullAndMergePrefs() {
    let remote = readPrefs().payload
    let local = SyncedPrefsPayload(
      deviceId: deviceId,
      updatedAt: prefsUpdatedAt,
      prefs: prefs
    )

    guard let remote else {
      // Avoid seeding into an undownloaded store (same Mac caution as subjects).
      // Once other KVS keys exist, migrate local prefs once.
      let dictHasKeys = !store.dictionaryRepresentation.isEmpty
      if dictHasKeys || hasSeenRemotePayload {
        let stamp = ISO8601DateFormatter.fractional.string(from: Date())
        let seed = SyncedPrefsPayload(deviceId: deviceId, updatedAt: stamp, prefs: prefs)
        prefsUpdatedAt = stamp
        persistLocalPrefsCache(seed)
        pushPrefsToCloud(seed)
      } else {
        persistLocalPrefsCache(
          SyncedPrefsPayload(deviceId: deviceId, updatedAt: prefsUpdatedAt, prefs: prefs)
        )
      }
      return
    }

    let localStampIsEpoch = prefsUpdatedAt.hasPrefix("1970-")
    let localForMerge = localStampIsEpoch
      ? SyncedPrefsPayload(
        deviceId: deviceId,
        updatedAt: ISO8601DateFormatter.fractional.string(from: Date()),
        prefs: prefs
      )
      : local

    let winner = ICloudMerge.mergeSyncedPrefs(
      local: localForMerge,
      remote: remote,
      localDeviceId: deviceId
    ) ?? remote

    applyingRemote = true
    prefs = winner.prefs
    prefsUpdatedAt = winner.updatedAt
    persistLocalPrefsCache(winner)
    applyingRemote = false

    if winner.deviceId != remote.deviceId
      || winner.updatedAt != remote.updatedAt
      || winner.prefs != remote.prefs
    {
      pushPrefsToCloud(winner)
    }
  }

  private func pushPrefsToCloud(_ payload: SyncedPrefsPayload) {
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    guard iCloudAvailable else { return }
    let encoder = JSONEncoder()
    guard let data = try? encoder.encode(payload),
          let json = String(data: data, encoding: .utf8)
    else { return }
    store.set(json, forKey: KVSKeys.prefs)
    _ = store.synchronize()
    kvsLog.info("pushed prefs weekStartsOn=\(payload.prefs.weekStartsOn)")
  }

  private func scheduleBootstrapRetries() {
    bootstrapRetryTask?.cancel()
    bootstrapRetryTask = Task { @MainActor in
      // KVS download is async; empty first read is normal. Retry before giving up.
      for delayNs in [2_000_000_000, 5_000_000_000, 12_000_000_000, 30_000_000_000] as [UInt64] {
        try? await Task.sleep(nanoseconds: delayNs)
        if Task.isCancelled { return }
        if hasSeenRemotePayload { return }
        kvsLog.info("bootstrap re-pull after delay")
        _ = store.synchronize()
        await refreshFromCloud(mode: .pullOnly)
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
  }

  private struct DecodeRead<T> {
    var payload: T?
    var hadRaw: Bool
    var rawByteCount: Int
  }

  private func readSubjects() -> DecodeRead<SubjectsPayload> {
    decodeJSON(SubjectsPayload.self, key: KVSKeys.subjects)
  }

  private func readMonth(_ key: String) -> DecodeRead<MonthPayload> {
    decodeJSON(MonthPayload.self, key: key)
  }

  private func readPrefs() -> DecodeRead<SyncedPrefsPayload> {
    decodeJSON(SyncedPrefsPayload.self, key: KVSKeys.prefs)
  }

  /// iOS writes UTF-8 JSON strings; also accept Data / NSString object forms.
  private func decodeJSON<T: Decodable>(_ type: T.Type, key: String) -> DecodeRead<T> {
    guard let bytes = rawUTF8Bytes(forKey: key) else {
      return DecodeRead(payload: nil, hadRaw: false, rawByteCount: 0)
    }
    do {
      let payload = try JSONDecoder().decode(type, from: bytes)
      return DecodeRead(payload: payload, hadRaw: true, rawByteCount: bytes.count)
    } catch {
      kvsLog.error("\(key, privacy: .public) decode error: \(error.localizedDescription, privacy: .public)")
      return DecodeRead(payload: nil, hadRaw: true, rawByteCount: bytes.count)
    }
  }

  private func rawUTF8Bytes(forKey key: String) -> Data? {
    if let s = store.string(forKey: key), let d = s.data(using: .utf8) {
      return d
    }
    if let d = store.data(forKey: key) {
      return d
    }
    if let obj = store.object(forKey: key) as? String, let d = obj.data(using: .utf8) {
      return d
    }
    if let obj = store.object(forKey: key) as? Data {
      return obj
    }
    return nil
  }

  private func logEnvironment() {
    let token = FileManager.default.ubiquityIdentityToken != nil
    kvsLog.info("kvstore expected=\(Self.expectedKvStoreId, privacy: .public) ubiquityToken=\(token) deviceId=\(self.deviceId, privacy: .public)")
    kvsLog.info("entitlement note: signed app must include network.client + ubiquity-kvstore-identifier=\(Self.expectedKvStoreId, privacy: .public)")
  }

  private func logDictionary(_ dict: [AnyHashable: Any], allKeys: [String]) {
    kvsLog.info("dictionaryRepresentation count=\(dict.count) keys=[\(allKeys.joined(separator: ","), privacy: .public)]")
    for key in allKeys {
      let value = dict[key]
      let typeName = value.map { String(describing: type(of: $0)) } ?? "nil"
      let bytes: Int
      if let s = value as? String {
        bytes = s.utf8.count
      } else if let d = value as? Data {
        bytes = d.count
      } else {
        bytes = -1
      }
      kvsLog.info("  key=\(key, privacy: .public) type=\(typeName, privacy: .public) bytes=\(bytes)")
    }
  }

  private static func normalizedRecord(_ record: StudyRecord) -> StudyRecord {
    var next = record
    next.studiedOn = DateKeys.normalizeDateKey(record.studiedOn)
    return next
  }

  private static func normalizedAppData(_ data: AppData) -> AppData {
    AppData(
      subjects: data.subjects,
      records: data.records.map(normalizedRecord)
    )
  }

  private func makeStatus(
    iCloud: Bool,
    subjectKeyPresent: Bool,
    subjectsDecoded: Bool,
    subjectsDecodeFailed: Bool,
    subjectNames: [String],
    monthKeyCount: Int,
    remoteRecordCount: Int,
    activeRecordCount: Int,
    deletedRecordCount: Int,
    studiedDays: [String],
    monthDecodeFailures: Int,
    hadRemote: Bool,
    totalKeyCount: Int
  ) -> String {
    if !iCloud {
      return "iCloud 없음 — 로컬만 (Mac Apple ID / iCloud 로그인 확인)"
    }
    if subjectsDecodeFailed {
      return "subjects 디코드 실패 · dict=\(totalKeyCount) · rec keys=\(monthKeyCount)"
    }
    if monthDecodeFailures > 0 {
      return "KVS 일부 디코드 실패 · months=\(monthDecodeFailures) · rec=\(remoteRecordCount)"
    }
    if hadRemote {
      let names = subjectNames.isEmpty ? "-" : subjectNames.joined(separator: ",")
      let days = studiedDays.isEmpty ? "-" : studiedDays.joined(separator: ",")
      if activeRecordCount == 0 && deletedRecordCount > 0 {
        return "KVS 과목=\(names) · 활성공부=0 · 삭제tombstone=\(deletedRecordCount) · 폰에서 공부 추가 필요"
      }
      let subj = subjectsDecoded ? "ok(\(names))" : (subjectKeyPresent ? "empty" : "missing")
      return "KVS 동기화됨 · subjects=\(subj) · dict=\(totalKeyCount) · rec=\(remoteRecordCount) active=\(activeRecordCount) days=\(days)"
    }
    return "클라우드 비어 있음 · dict=\(totalKeyCount) · subjects=\(subjectKeyPresent ? 1 : 0) · rec=\(monthKeyCount) · 컨테이너 \(Self.expectedKvStoreId)"
  }

  private func makeDebugSummary(
    allKeys: [String],
    monthKeys: [String],
    otherKeys: [String],
    dict: [AnyHashable: Any],
    subjectsBytes: Int,
    records: [StudyRecord],
    activeSubjects: [SubjectChip]
  ) -> String {
    let keyPreview = allKeys.isEmpty ? "(none)" : allKeys.prefix(12).joined(separator: ", ")
    let more = allKeys.count > 12 ? "…" : ""
    let other = otherKeys.isEmpty ? "" : " other=[\(otherKeys.joined(separator: ","))]"
    let active = ICloudMerge.activeRecords(records)
    let deleted = records.filter { $0.deleted == true }.count
    let rows = active.prefix(6).map { r in
      "\(r.studiedOn):\(r.content.prefix(10))"
    }.joined(separator: " | ")
    let tomb = records.filter { $0.deleted == true }.prefix(4).map { r in
      "!\(r.studiedOn):\(r.content.prefix(8))"
    }.joined(separator: " | ")
    let rowPart = rows.isEmpty ? "rows=-" : "rows=[\(rows)]"
    let tombPart = deleted == 0 ? "" : " tomb=[\(tomb)]"
    let subjPart = "appSubjects=[\(activeSubjects.map(\.name).joined(separator: ","))]"
    return "dict=\(dict.count) keys=[\(keyPreview)\(more)] subjectsBytes=\(subjectsBytes) months=\(monthKeys.count) \(subjPart) activeRec=\(active.count) deletedRec=\(deleted) \(rowPart)\(tombPart)\(other)"
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
    return Self.normalizedAppData(AppData(subjects: payload.subjects, records: payload.records))
  }

  private func persistLocalPrefsCache(_ payload: SyncedPrefsPayload) {
    guard let encoded = try? JSONEncoder().encode(payload) else { return }
    UserDefaults.standard.set(encoded, forKey: localPrefsCacheKey)
  }

  private func loadLocalPrefsCache() -> SyncedPrefsPayload? {
    guard let raw = UserDefaults.standard.data(forKey: localPrefsCacheKey),
          let payload = try? JSONDecoder().decode(SyncedPrefsPayload.self, from: raw)
    else { return nil }
    return payload
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
