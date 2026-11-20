import SwiftUI

enum PogaeTheme {
  static let brand = Color(hex: 0x1991FF)

  static let canvasLight = Color(hex: 0xFFFFFF)
  static let canvasDark = Color(hex: 0x0B0F14)
  static let surfaceLight = Color(hex: 0xF2F6FA)
  static let surfaceDark = Color(hex: 0x1A222C)
  static let inkLight = Color(hex: 0x000000)
  static let inkDark = Color(hex: 0xE8EEF4)
  static let bodyLight = Color(hex: 0x526477)
  static let bodyDark = Color(hex: 0xC5CED8)
  static let mutedLight = Color(hex: 0x9FB1C1)
  static let mutedDark = Color(hex: 0x8B9AAB)
  static let sectionLight = Color(hex: 0x708AA2)
  static let sectionDark = Color(hex: 0x9AABBC)
  static let primarySoftLight = Color(hex: 0xDFF0FF)
  static let primarySoftDark = Color(hex: 0x16324A)

  static func canvas(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? canvasDark : canvasLight
  }

  static func surface(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? surfaceDark : surfaceLight
  }

  static func ink(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? inkDark : inkLight
  }

  static func body(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? bodyDark : bodyLight
  }

  static func muted(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? mutedDark : mutedLight
  }

  static func section(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? sectionDark : sectionLight
  }

  static func primarySoft(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? primarySoftDark : primarySoftLight
  }

  /// Soft / faded placeholder (lighter than body/muted).
  static let placeholderLight = Color(hex: 0xE0E8EF)
  static let placeholderDark = Color(hex: 0x556575)

  static func placeholder(_ scheme: ColorScheme) -> Color {
    scheme == .dark ? placeholderDark : placeholderLight
  }
}

/// Subject chip look — matches iOS `AddStudyForm` SelectableChip (slightly tighter on Mac).
enum SubjectChipStyle {
  static let cornerRadius: CGFloat = 10
  static let borderWidth: CGFloat = 1.5
  static let idleOpacity = 0.45
  static let selectedOpacity = 1.0
  static let horizontalPadding: CGFloat = 10
  static let minHeight: CGFloat = 32
  static let fontSize: CGFloat = 13

  static func fill(hex: String?) -> Color {
    Color(hexString: hex ?? "", fallback: PogaeTheme.brand)
  }

  /// Same-hue rim as iOS `subjectBorderColor` / `darkenHex(..., 0.1)`.
  static func border(hex: String?) -> Color {
    Color(darkenedHexString: hex ?? "", amount: 0.1, fallback: PogaeTheme.brand)
  }
}

extension Color {
  init(hex: UInt32, opacity: Double = 1) {
    let r = Double((hex >> 16) & 0xFF) / 255
    let g = Double((hex >> 8) & 0xFF) / 255
    let b = Double(hex & 0xFF) / 255
    self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
  }

  init(hexString: String, fallback: Color = .gray) {
    var raw = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
    if raw.hasPrefix("#") { raw.removeFirst() }
    guard raw.count == 6, let value = UInt32(raw, radix: 16) else {
      self = fallback
      return
    }
    self.init(hex: value)
  }

  init(darkenedHexString: String, amount: Double = 0.1, fallback: Color = .gray) {
    var raw = darkenedHexString.trimmingCharacters(in: .whitespacesAndNewlines)
    if raw.hasPrefix("#") { raw.removeFirst() }
    guard raw.count == 6, let value = UInt32(raw, radix: 16) else {
      self = fallback
      return
    }
    let factor = max(0, min(1, 1 - amount))
    let r = UInt32(Double((value >> 16) & 0xFF) * factor)
    let g = UInt32(Double((value >> 8) & 0xFF) * factor)
    let b = UInt32(Double(value & 0xFF) * factor)
    self.init(hex: (r << 16) | (g << 8) | b)
  }
}
