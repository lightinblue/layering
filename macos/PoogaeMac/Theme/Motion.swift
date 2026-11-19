import SwiftUI

enum PoogaeMotion {
  /// Soft ease-out settle — matches iOS `EASE_OUT_MS` language (~380–450ms).
  static let settle = Animation.easeOut(duration: 0.42)
  static let quick = Animation.easeOut(duration: 0.22)
  static let panel = Animation.easeOut(duration: 0.48)
}
