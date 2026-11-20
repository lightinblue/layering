import SwiftUI

struct ReviewCardView: View {
  let card: HomeReviewCard
  var onToggle: () -> Void
  var onDetail: () -> Void
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    Button(action: onDetail) {
      VStack(alignment: .leading, spacing: 8) {
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

        HStack(spacing: 4) {
          ForEach(Array(card.subjectNames.prefix(4).enumerated()), id: \.offset) { index, name in
            Text(String(name.prefix(1)))
              .font(.system(size: 10, weight: .semibold))
              .foregroundStyle(.white)
              .frame(width: 20, height: 20)
              .background(colorForSubject(at: index, name: name))
              .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
          }
        }
      }
      .padding(.horizontal, 12)
      .padding(.vertical, 10)
      .frame(maxWidth: .infinity, minHeight: 72, alignment: .topLeading)
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
    .help("복습 내용 보기")
    .animation(PoogaeMotion.settle, value: card.completed)
  }

  private func colorForSubject(at index: Int, name: String) -> Color {
    if index < card.subjectColors.count {
      return Color(hexString: card.subjectColors[index], fallback: PoogaeTheme.brand)
    }
    return PoogaeTheme.brand
  }
}
