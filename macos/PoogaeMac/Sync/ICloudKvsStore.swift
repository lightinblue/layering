import Foundation

/// Thin wrapper around `NSUbiquitousKeyValueStore` — same keys as iOS Expo module.
@MainActor
final class ICloudKvsStore: ObservableObject {
  @Published private(set) var data: AppData = .empty
  @Published private(set) var iCloudAvailable: Bool = false
  @Published private(set) var lastReadAt: Date?
  @Published private(set) var statusMessage: String = "준비 중"

  private let store = NSUbiquitousKeyValueStore.default
  private var observer: NSObjectProtocol?
  private let deviceId: String

  init(deviceId: String = DeviceIdentity.loadOrCreate()) {
    self.deviceId = deviceId
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
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
  }

  func refreshFromCloud() async {
    iCloudAvailable = FileManager.default.ubiquityIdentityToken != nil
    _ = store.synchronize()

    let subjectsPayload = readSubjects()
    var remoteRecords: [StudyRecord] = []
    var remoteDeviceId = subjectsPayload?.deviceId ?? ""

    for ym in DateKeys.nearbyYearMonths() {
      if let month = readMonth(KVSKeys.monthKey(ym)) {
        remoteRecords.append(contentsOf: month.records)
        if remoteDeviceId.isEmpty {
          remoteDeviceId = month.deviceId
        }
      }
    }

    let merged = ICloudMerge.mergeAppData(
      local: data,
      remoteSubjects: subjectsPayload?.subjects ?? [],
      remoteRecords: remoteRecords,
      localDeviceId: deviceId,
      remoteDeviceId: remoteDeviceId
    )
    data = merged
    lastReadAt = Date()
    if !iCloudAvailable {
      statusMessage = "iCloud 없음 — 로컬만"
    } else if subjectsPayload == nil && remoteRecords.isEmpty {
      statusMessage = "클라우드 비어 있음 (읽기 OK)"
    } else {
      statusMessage = "KVS 동기화됨"
    }
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

  /// Local-only mutation until KVS write/push lands in a later milestone.
  func applyLocal(_ next: AppData) {
    data = next
  }
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
