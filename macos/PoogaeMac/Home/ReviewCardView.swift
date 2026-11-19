import SwiftUI

struct ReviewCardView: View {
  let card: HomeReviewCard
  var onToggle: () -> Void
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    Button(action: onToggle) {
      VStack(alignment: .leading, spacing: 12) {
        HStack(spacing: 10) {
          ZStack {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
              .fill(card.completed ? PoogaeTheme.brand : PoogaeTheme.muted(colorScheme).opacity(0.35))
              .frame(width: 28, height: 28)
            if card.completed {
              Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
            }
          }

          Text("\(card.intervalDays)일 전")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(PoogaeTheme.section(colorScheme))
            .lineLimit(1)
        }

        HStack(spacing: 4) {
          ForEach(Array(card.subjectNames.prefix(4).enumerated()), id: \.offset) { index, name in
            Text(String(name.prefix(1)))
              .font(.system(size: 11, weight: .semibold))
              .foregroundStyle(.white)
              .frame(width: 22, height: 22)
              .background(colorForSubject(at: index, name: name))
              .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
          }
        }
      }
      .padding(14)
      .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
      .background(
        card.completed
          ? PoogaeTheme.primarySoft(colorScheme)
          : PoogaeTheme.surface(colorScheme)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .strokeBorder(
            card.completed ? PoogaeTheme.brand : Color.clear,
            lineWidth: card.completed ? 2 : 0
          )
      )
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
    .buttonStyle(.plain)
    .animation(PoogaeMotion.settle, value: card.completed)
  }

  private func colorForSubject(at index: Int, name: String) -> Color {
    if index < card.subjectColors.count {
      return Color(hexString: card.subjectColors[index], fallback: PoogaeTheme.brand)
    }
    return PoogaeTheme.brand
  }
}
