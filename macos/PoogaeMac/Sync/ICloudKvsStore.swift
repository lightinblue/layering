import Foundation

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

  init(deviceId: String = DeviceIdentity.loadOrCreate()) {
    self.deviceId = deviceId
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    if let cached = loadLocalCache() {
      data = AppMutations.ensureSeedSubjects(cached)
    }
    observer = NotificationCenter.default.addObserver(
      forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
      object: store,
      queue: .main
    ) { [weak self] _ in
      Task { @MainActor in
        await self?.refreshFromCloud()
      }
    }
  }

  deinit {
    if let observer {
      NotificationCenter.default.removeObserver(observer)
    }
  }

  func bootstrap() async {
    _ = store.synchronize()
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    await refreshFromCloud()
    if ICloudMerge.activeSubjects(data.subjects).isEmpty {
      let seeded = AppMutations.ensureSeedSubjects(data)
      applyLocal(seeded, push: iCloudAvailable)
    }
  }

  func refreshFromCloud() async {
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    _ = store.synchronize()

    let subjectsPayload = readSubjects()
    var remoteRecords: [StudyRecord] = []
    var remoteDeviceId = subjectsPayload?.deviceId ?? ""

    var months = Set(DateKeys.nearbyYearMonths())
    months.formUnion(localYearMonths())
    for ym in months.sorted() {
      if let month = readMonth(KVSKeys.monthKey(ym)) {
        remoteRecords.append(contentsOf: month.records)
        if remoteDeviceId.isEmpty {
          remoteDeviceId = month.deviceId
        }
      }
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
    data = AppMutations.ensureSeedSubjects(merged)
    persistLocalCache(data)
    lastReadAt = Date()
    if !iCloudAvailable {
      statusMessage = "iCloud 없음 — 로컬만"
    } else if subjectsPayload == nil && remoteRecords.isEmpty {
      statusMessage = "클라우드 비어 있음 (읽기 OK)"
    } else {
      statusMessage = "KVS 동기화됨"
    }
  }

  /// Apply mutation, cache locally, and push to KVS when available.
  func applyLocal(_ next: AppData, push: Bool = true) {
    data = next
    persistLocalCache(next)
    guard push, !applyingRemote else { return }
    pushToCloud(next)
  }

  private func pushToCloud(_ next: AppData) {
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    guard iCloudAvailable else {
      statusMessage = "iCloud 없음 — 로컬만"
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
    statusMessage = "KVS 동기화됨"
  }

  private func readSubjects() -> SubjectsPayload? {
    guard let raw = store.string(forKey: KVSKeys.subjects),
          let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(SubjectsPayload.self, from: data)
  }

  private func readMonth(_ key: String) -> MonthPayload? {
    guard let raw = store.string(forKey: key),
          let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(MonthPayload.self, from: data)
  }

  private func localYearMonths() -> Set<String> {
    Set(data.records.map { KVSKeys.yearMonth(from: $0.studiedOn) })
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
