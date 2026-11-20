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
  /// Compact dump for menu-bar diagnostics (keys + sizes).
  @Published private(set) var debugSummary: String = ""

  /// Must match iOS `app.json` ubiquity-kvstore-identifier (TeamPrefix + com.lightinblue.layering).
  static let expectedKvStoreId = "R39JVZ3ZNL.com.lightinblue.layering"

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
    logEnvironment()
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

    let dict = store.dictionaryRepresentation
    let allKeys = dict.keys.compactMap { $0 as? String }.sorted()
    let subjectKeys = allKeys.filter { $0 == KVSKeys.subjects }
    let monthKeys = allKeys.filter { $0.hasPrefix(KVSKeys.monthPrefix) }
    let otherKeys = allKeys.filter { $0 != KVSKeys.subjects && !$0.hasPrefix(KVSKeys.monthPrefix) }

    logDictionary(dict, allKeys: allKeys)

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

    let normalized = Self.normalizedAppData(merged)
    if hadRemote {
      data = normalized
      persistLocalCache(data)
      // Reconcile union to cloud after remote merge (same as iOS pullAndMerge).
      pushToCloud(data)
    } else if ICloudMerge.activeSubjects(normalized.subjects).isEmpty {
      // Still empty after pull — seed locally only (epoch timestamps; never push here).
      data = AppMutations.ensureSeedSubjects(normalized)
      persistLocalCache(data)
    } else {
      data = normalized
      persistLocalCache(data)
    }

    lastReadAt = Date()
    let activeTotal = ICloudMerge.activeRecords(data.records).count
    let studiedDays = Set(
      ICloudMerge.activeRecords(data.records).map { DateKeys.normalizeDateKey($0.studiedOn) }
    ).sorted()
    statusMessage = makeStatus(
      iCloud: iCloudAvailable,
      subjectKeyPresent: !subjectKeys.isEmpty,
      subjectsDecoded: subjectsPayload != nil,
      subjectsDecodeFailed: subjectsRead.hadRaw && subjectsPayload == nil,
      monthKeyCount: monthKeys.count,
      remoteRecordCount: remoteRecords.count,
      activeRecordCount: activeTotal,
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
      records: data.records
    )
    for record in data.records {
      kvsLog.info(
        "record id=\(record.id, privacy: .public) studiedOn=\(record.studiedOn, privacy: .public) deleted=\(record.deleted ?? false) content=\(record.content.prefix(24), privacy: .public)"
      )
    }
    kvsLog.info("\(self.statusMessage, privacy: .public) localSubjects=\(self.data.subjects.count) localRecords=\(self.data.records.count)")
    kvsLog.info("debug \(self.debugSummary, privacy: .public)")
  }

  /// Wipe Mac local mirror + in-memory seed, then re-pull (does not clear iCloud).
  func resetLocalStoreAndPull() async {
    UserDefaults.standard.removeObject(forKey: localCacheKey)
    data = .empty
    hasSeenRemotePayload = false
    statusMessage = "로컬 초기화 후 재동기화…"
    debugSummary = ""
    kvsLog.info("local cache cleared; re-pulling")
    _ = store.synchronize()
    await refreshFromCloud()
    if ICloudMerge.activeSubjects(data.subjects).isEmpty {
      data = AppMutations.ensureSeedSubjects(data)
      persistLocalCache(data)
    }
    scheduleBootstrapRetries()
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
      for delayNs in [2_000_000_000, 5_000_000_000, 12_000_000_000, 30_000_000_000] as [UInt64] {
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
    monthKeyCount: Int,
    remoteRecordCount: Int,
    activeRecordCount: Int,
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
      let subj = subjectsDecoded ? "ok" : (subjectKeyPresent ? "empty" : "missing")
      let days = studiedDays.isEmpty ? "-" : studiedDays.joined(separator: ",")
      return "KVS 동기화됨 · subjects=\(subj) · dict=\(totalKeyCount) · records=\(remoteRecordCount) active=\(activeRecordCount) days=\(days)"
    }
    return "클라우드 비어 있음 · dict=\(totalKeyCount) · subjects=\(subjectKeyPresent ? 1 : 0) · rec=\(monthKeyCount) · 컨테이너 \(Self.expectedKvStoreId)"
  }

  private func makeDebugSummary(
    allKeys: [String],
    monthKeys: [String],
    otherKeys: [String],
    dict: [AnyHashable: Any],
    subjectsBytes: Int,
    records: [StudyRecord]
  ) -> String {
    let keyPreview = allKeys.isEmpty ? "(none)" : allKeys.prefix(12).joined(separator: ", ")
    let more = allKeys.count > 12 ? "…" : ""
    let other = otherKeys.isEmpty ? "" : " other=[\(otherKeys.joined(separator: ","))]"
    let active = ICloudMerge.activeRecords(records)
    let rows = active.prefix(6).map { r in
      "\(r.studiedOn)\(r.deleted == true ? "!" : ""):\(r.content.prefix(10))"
    }.joined(separator: " | ")
    let rowPart = rows.isEmpty ? "rows=-" : "rows=[\(rows)]"
    return "dict=\(dict.count) keys=[\(keyPreview)\(more)] subjectsBytes=\(subjectsBytes) months=\(monthKeys.count) \(rowPart)\(other)"
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
