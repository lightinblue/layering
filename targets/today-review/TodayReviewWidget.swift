import SwiftUI
import WidgetKit

// MARK: - Timeline

struct TodayReviewEntry: TimelineEntry {
  let date: Date
  let snapshot: TodayReviewSnapshot
}

struct TodayReviewProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayReviewEntry {
    TodayReviewEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayReviewEntry) -> Void) {
    let snapshot = context.isPreview ? TodayReviewSnapshot.placeholder : TodayReviewStore.loadSnapshot()
    completion(TodayReviewEntry(date: Date(), snapshot: snapshot))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayReviewEntry>) -> Void) {
    let now = Date()
    let snapshot = TodayReviewStore.loadSnapshot()
    let entry = TodayReviewEntry(date: now, snapshot: snapshot)
    // Prefer app-side reloadWidget; midnight + 15m is a safety net if ofKind misses.
    let timeline = Timeline(
      entries: [entry],
      policy: .after(TodayReviewStore.nextTimelineReload(after: now))
    )
    completion(timeline)
  }
}

extension TodayReviewSnapshot {
  static let placeholder = TodayReviewSnapshot(
    updatedAt: ISO8601DateFormatter().string(from: Date()),
    todayKey: "2026-11-12",
    totalCount: 3,
    remainingCount: 2,
    items: [
      TodayReviewItem(
        id: "p1",
        intervalDays: 1,
        completed: false,
        subjects: [
          TodayReviewSubject(name: "분류", color: "#62B3F6", glyph: "분"),
          TodayReviewSubject(name: "교육학", color: "#5DCB85", glyph: "교"),
        ]
      ),
      TodayReviewItem(
        id: "p2",
        intervalDays: 3,
        completed: false,
        subjects: [
          TodayReviewSubject(name: "전공", color: "#62B3F6", glyph: "전"),
        ]
      ),
      TodayReviewItem(
        id: "p3",
        intervalDays: 7,
        completed: true,
        subjects: [
          TodayReviewSubject(name: "정검", color: "#B2B2B2", glyph: "정"),
        ]
      ),
    ]
  )
}

// MARK: - Widget

struct TodayReviewWidget: Widget {
  static let kind = "TodayReviewWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: TodayReviewProvider()) { entry in
      TodayReviewWidgetView(entry: entry)
        .containerBackground(for: .widget) {
          WidgetPalette.canvas
        }
        .widgetURL(TodayReviewStore.homeURL)
    }
    .configurationDisplayName("오늘 할 복습")
    .description("오늘 남은 복습을 보여 줘요.")
    // Extra Large = iPad home-screen size; same card list as Large.
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
  }
}

// MARK: - Root view

struct TodayReviewWidgetView: View {
  @Environment(\.widgetFamily) private var family
  var entry: TodayReviewEntry

  var body: some View {
    switch family {
    case .systemSmall:
      SmallSummaryView(snapshot: entry.snapshot)
    case .systemMedium:
      MediumSummaryView(snapshot: entry.snapshot)
    case .systemExtraLarge:
      LargeCardListView(snapshot: entry.snapshot, maxCards: 8)
    default:
      LargeCardListView(snapshot: entry.snapshot, maxCards: 5)
    }
  }
}

// MARK: - Small / Medium summaries

/// Signature blue theme-dot + section title (matches home accent ellipse / primary).
private struct WidgetSectionTitle: View {
  var fontSize: CGFloat = 14

  var body: some View {
    HStack(spacing: 6) {
      Circle()
        .fill(WidgetPalette.primary)
        .frame(width: 7, height: 7)
        .accessibilityHidden(true)
      Text("오늘 할 복습")
        .font(.system(size: fontSize, weight: .semibold))
        .foregroundColor(WidgetPalette.accentText)
        .lineLimit(1)
    }
  }
}

private struct SmallSummaryView: View {
  let snapshot: TodayReviewSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      WidgetSectionTitle(fontSize: 13)

      if snapshot.isEmpty {
        Spacer(minLength: 0)
        Text("오늘 할 복습이 없어요")
          .font(.system(size: 15, weight: .medium))
          .foregroundColor(WidgetPalette.body)
          .fixedSize(horizontal: false, vertical: true)
        Spacer(minLength: 0)
      } else {
        Spacer(minLength: 0)
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text("\(snapshot.remainingCount)")
            .font(.system(size: 42, weight: .bold, design: .rounded))
            .foregroundColor(WidgetPalette.primary)
            .minimumScaleFactor(0.7)
            .lineLimit(1)
          Text("건")
            .font(.system(size: 16, weight: .semibold))
            .foregroundColor(WidgetPalette.body)
        }
        Text(snapshot.remainingCount == 0 ? "모두 끝냈어요" : "남음")
          .font(.system(size: 13, weight: .medium))
          .foregroundColor(WidgetPalette.accentText)
        Spacer(minLength: 0)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(14)
  }
}

private struct MediumSummaryView: View {
  let snapshot: TodayReviewSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      WidgetSectionTitle(fontSize: 14)

      if snapshot.isEmpty {
        Spacer(minLength: 0)
        Text("오늘 할 복습이 없어요")
          .font(.system(size: 18, weight: .semibold))
          .foregroundColor(WidgetPalette.body)
        Text("탭해서 홈으로 가요")
          .font(.system(size: 13, weight: .medium))
          .foregroundColor(WidgetPalette.muted)
        Spacer(minLength: 0)
      } else {
        Spacer(minLength: 0)
        HStack(alignment: .firstTextBaseline, spacing: 10) {
          Text("\(snapshot.remainingCount)건 남음")
            .font(.system(size: 28, weight: .bold, design: .rounded))
            .foregroundColor(WidgetPalette.primary)
            .minimumScaleFactor(0.8)
            .lineLimit(1)
          Spacer(minLength: 0)
          Text("전체 \(snapshot.totalCount)건")
            .font(.system(size: 14, weight: .medium))
            .foregroundColor(WidgetPalette.accentText)
        }
        if snapshot.remainingCount == 0 {
          Text("오늘 복습을 모두 끝냈어요")
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(WidgetPalette.body)
        }
        Spacer(minLength: 0)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(16)
  }
}

// MARK: - Large / Extra Large card list

private struct LargeCardListView: View {
  let snapshot: TodayReviewSnapshot
  var maxCards: Int = 5

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        WidgetSectionTitle(fontSize: 14)
        Spacer(minLength: 0)
        if !snapshot.isEmpty {
          Text("\(snapshot.remainingCount)/\(snapshot.totalCount)")
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundColor(WidgetPalette.primary)
        }
      }

      if snapshot.isEmpty {
        Spacer(minLength: 0)
        VStack(alignment: .leading, spacing: 6) {
          Text("오늘 할 복습이 없어요")
            .font(.system(size: 17, weight: .semibold))
            .foregroundColor(WidgetPalette.body)
          Text("탭해서 홈으로 가요")
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(WidgetPalette.muted)
        }
        Spacer(minLength: 0)
      } else {
        VStack(spacing: 8) {
          ForEach(Array(snapshot.items.prefix(maxCards))) { item in
            ReviewCardRow(item: item)
              // Force checkbox chrome to redraw when completed flips.
              .id("\(item.id)-\(item.completed)")
          }
        }
        Spacer(minLength: 0)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .padding(16)
  }
}

/// Chip (full name ≤4) + interval (“N일 전”) + checkbox look.
/// No study title, no 「자세히」.
private struct ReviewCardRow: View {
  let item: TodayReviewItem

  var body: some View {
    HStack(spacing: 10) {
      CheckboxLook(completed: item.completed)

      Text(item.intervalLabel)
        .font(.system(size: 14, weight: .semibold))
        .foregroundColor(item.completed ? WidgetPalette.muted : WidgetPalette.accentText)
        .lineLimit(1)
        .layoutPriority(1)

      Spacer(minLength: 4)

      HStack(spacing: 4) {
        ForEach(item.subjects) { subject in
          SubjectChip(subject: subject)
        }
      }
      .layoutPriority(2)
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 9)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        // Home review card: surface → primarySoft when completed.
        .fill(item.completed ? WidgetPalette.primarySoft : WidgetPalette.surface)
    )
    .overlay(
      RoundedRectangle(cornerRadius: 12, style: .continuous)
        .strokeBorder(
          item.completed ? WidgetPalette.primary : Color.clear,
          lineWidth: 1.5
        )
    )
  }
}

private struct CheckboxLook: View {
  let completed: Bool

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .fill(completed ? WidgetPalette.primary : WidgetPalette.mutedLight)
        .frame(width: 28, height: 28)

      if completed {
        Image(systemName: "checkmark")
          .font(.system(size: 12, weight: .bold))
          .foregroundColor(.white)
      }
    }
    .accessibilityHidden(true)
  }
}

private struct SubjectChip: View {
  let subject: TodayReviewSubject

  var body: some View {
    Text(subject.chipLabel)
      .font(.system(size: 11, weight: .bold))
      .foregroundColor(.white)
      .padding(.horizontal, 7)
      .padding(.vertical, 4)
      .background(
        RoundedRectangle(cornerRadius: 6, style: .continuous)
          .fill(Color(hex: subject.color) ?? WidgetPalette.muted)
      )
      .lineLimit(1)
  }
}

// MARK: - Palette / helpers

/// Hardcoded sRGB mirrors of `constants/tokens.ts`.
/// Named asset catalog colors (`Color("primary")`) can fail to resolve in the
/// widget extension / gallery preview — that left Small/Medium blank white and
/// Large showing only hex-colored subject chips. Inline colors always paint.
private enum WidgetPalette {
  static let canvas = Color(hexLiteral: "#ffffff")
  static let primary = Color(hexLiteral: "#1991ff")
  static let primarySoft = Color(hexLiteral: "#dff0ff")
  static let surface = Color(hexLiteral: "#f2f6fa")
  static let muted = Color(hexLiteral: "#9fb1c1")
  static let mutedLight = Color(hexLiteral: "#ced7e0")
  static let body = Color(hexLiteral: "#526477")
  static let accentText = Color(hexLiteral: "#708aa2")
}

private extension Color {
  /// Non-failable token color; falls back to mid gray if malformed.
  init(hexLiteral: String) {
    self = Color(hex: hexLiteral) ?? Color(.sRGB, red: 0.5, green: 0.5, blue: 0.5, opacity: 1)
  }

  init?(hex: String) {
    var raw = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if raw.hasPrefix("#") {
      raw.removeFirst()
    }
    guard raw.count == 6, let value = UInt64(raw, radix: 16) else {
      return nil
    }
    let r = Double((value >> 16) & 0xFF) / 255
    let g = Double((value >> 8) & 0xFF) / 255
    let b = Double(value & 0xFF) / 255
    self = Color(.sRGB, red: r, green: g, blue: b, opacity: 1)
  }
}

#Preview(as: .systemSmall) {
  TodayReviewWidget()
} timeline: {
  TodayReviewEntry(date: .now, snapshot: .placeholder)
  TodayReviewEntry(date: .now, snapshot: .empty)
}

#Preview(as: .systemMedium) {
  TodayReviewWidget()
} timeline: {
  TodayReviewEntry(date: .now, snapshot: .placeholder)
}

#Preview(as: .systemLarge) {
  TodayReviewWidget()
} timeline: {
  TodayReviewEntry(date: .now, snapshot: .placeholder)
  TodayReviewEntry(date: .now, snapshot: .empty)
}

#Preview(as: .systemExtraLarge) {
  TodayReviewWidget()
} timeline: {
  TodayReviewEntry(date: .now, snapshot: .placeholder)
}
