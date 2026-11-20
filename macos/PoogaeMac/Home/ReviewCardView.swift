import SwiftUI

struct ReviewCardView: View {
  let card: HomeReviewCard
  var onToggle: () -> Void
  var onDetail: () -> Void
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    Button(action: onDetail) {
      HStack(alignment: .center, spacing: 12) {
        HStack(spacing: 8) {
          Button(action: onToggle) {
            ZStack {
              RoundedRectangle(cornerRadius: 7, style: .continuous)
                .fill(card.completed ? PoogaeTheme.brand : PoogaeTheme.muted(colorScheme).opacity(0.35))
                .frame(width: 24, height: 24)
              if card.completed {
                Image(systemName: "checkmark")
                  .font(.system(size: 11, weight: .bold))
                  .foregroundStyle(.white)
              }
            }
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .help(card.completed ? "복습 완료 해제" : "복습 완료")

          Text("\(card.intervalDays)일 전")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(PoogaeTheme.section(colorScheme))
            .lineLimit(1)
        }

        Spacer(minLength: 8)

        // Full subject chips on the right; wrap to a 2nd line when needed.
        SubjectChipFlow(names: card.subjectNames, colors: card.subjectColors)
          .frame(maxWidth: 168, alignment: .trailing)
      }
      .padding(.horizontal, 12)
      .padding(.vertical, 10)
      .frame(maxWidth: .infinity, minHeight: 72, alignment: .center)
      .background(
        card.completed
          ? PoogaeTheme.primarySoft(colorScheme)
          : PoogaeTheme.surface(colorScheme)
      )
      // Always reserve 2pt stroke so checking doesn't shift content.
      .overlay(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .strokeBorder(
            card.completed ? PoogaeTheme.brand : Color.clear,
            lineWidth: 2
          )
      )
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
    .buttonStyle(.plain)
    .help("복습 내용 보기")
    .animation(PoogaeMotion.settle, value: card.completed)
  }
}

/// Wrapping row of full-name subject chips (right-aligned).
private struct SubjectChipFlow: View {
  let names: [String]
  let colors: [String]

  var body: some View {
    // Simple wrap via flexible stack — enough for 1–4 subjects on a card.
    VStack(alignment: .trailing, spacing: 4) {
      ForEach(chipRows, id: \.self) { row in
        HStack(spacing: 4) {
          ForEach(row, id: \.offset) { item in
            Text(item.name)
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(.white)
              .padding(.horizontal, 8)
              .frame(minHeight: 22)
              .background(chipColor(at: item.offset, name: item.name))
              .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
              .lineLimit(1)
          }
        }
      }
    }
  }

  private struct ChipItem: Hashable {
    var offset: Int
    var name: String
  }

  /// Pack names into up to 2 visual rows (prefer 2+2 / 1+rest).
  private var chipRows: [[ChipItem]] {
    let items = Array(names.prefix(4).enumerated()).map {
      ChipItem(offset: $0.offset, name: $0.element)
    }
    guard !items.isEmpty else { return [] }
    if items.count <= 2 { return [items] }
    let mid = (items.count + 1) / 2
    return [Array(items.prefix(mid)), Array(items.suffix(from: mid))]
  }

  private func chipColor(at index: Int, name: String) -> Color {
    if index < colors.count {
      return Color(hexString: colors[index], fallback: PoogaeTheme.brand)
    }
    return PoogaeTheme.brand
  }
}
