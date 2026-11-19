import SwiftUI

enum PoogaeTheme {
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
}
