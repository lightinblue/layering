import SwiftUI

struct ReviewCardView: View {
  let card: HomeReviewCard
  var onToggle: () -> Void
  var onDetail: () -> Void
  @Environment(\.colorScheme) private var colorScheme

  private var subjectLabel: String {
    card.subjectNames.joined(separator: " · ")
  }

  var body: some View {
    Button(action: onDetail) {
      HStack(alignment: .top, spacing: 12) {
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

          Text("자세히")
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(PoogaeTheme.muted(colorScheme))
        }

        Spacer(minLength: 8)

        Text(subjectLabel)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(PoogaeTheme.ink(colorScheme))
          .multilineTextAlignment(.trailing)
          .lineLimit(2)
          .frame(maxWidth: 140, alignment: .trailing)
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
}
