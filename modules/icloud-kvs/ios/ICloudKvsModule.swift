import ExpoModulesCore
import Foundation

public class ICloudKvsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("ICloudKvs")

    Events("onExternalChange")

    OnCreate {
      let store = NSUbiquitousKeyValueStore.default
      _ = store.synchronize()
      self.observer = NotificationCenter.default.addObserver(
        forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
        object: store,
        queue: .main
      ) { [weak self] notification in
        guard let self else { return }
        let reason =
          notification.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int ?? -1
        let keys =
          notification.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
        self.sendEvent("onExternalChange", [
          "reason": reason,
          "keys": keys,
        ])
      }
    }

    OnDestroy {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
        self.observer = nil
      }
    }

    Function("isICloudAvailable") { () -> Bool in
      FileManager.default.ubiquityIdentityToken != nil
    }

    AsyncFunction("get") { (key: String) -> String? in
      NSUbiquitousKeyValueStore.default.string(forKey: key)
    }

    AsyncFunction("set") { (key: String, value: String) -> Bool in
      let store = NSUbiquitousKeyValueStore.default
      store.set(value, forKey: key)
      return store.synchronize()
    }

    AsyncFunction("remove") { (key: String) -> Bool in
      let store = NSUbiquitousKeyValueStore.default
      store.removeObject(forKey: key)
      return store.synchronize()
    }

    AsyncFunction("getAllKeys") { () -> [String] in
      let dict = NSUbiquitousKeyValueStore.default.dictionaryRepresentation
      return Array(dict.keys)
    }

    AsyncFunction("synchronize") { () -> Bool in
      NSUbiquitousKeyValueStore.default.synchronize()
    }
  }
}
