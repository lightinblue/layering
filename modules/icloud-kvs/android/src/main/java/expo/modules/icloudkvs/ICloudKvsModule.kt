package expo.modules.icloudkvs

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android stub — iCloud KVS is iOS-only. All calls no-op / return empty.
 */
class ICloudKvsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ICloudKvs")

    Events("onExternalChange")

    Function("isICloudAvailable") {
      false
    }

    AsyncFunction("get") { _: String ->
      null as String?
    }

    AsyncFunction("set") { _: String, _: String ->
      false
    }

    AsyncFunction("remove") { _: String ->
      false
    }

    AsyncFunction("getAllKeys") {
      emptyList<String>()
    }

    AsyncFunction("synchronize") {
      false
    }
  }
}
