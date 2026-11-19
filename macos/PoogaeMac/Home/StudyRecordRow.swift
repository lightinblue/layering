import SwiftUI

struct StudyRecordRow: View {
  let row: HomeStudyRow
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    HStack(spacing: 10) {
      Text(row.subjectName)
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .frame(minWidth: 64, minHeight: 36)
        .background(chipColor)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

      VStack(alignment: .leading, spacing: 2) {
        Text(row.content)
          .font(.system(size: 14, weight: .medium))
          .foregroundStyle(PoogaeTheme.body(colorScheme))
          .lineLimit(1)
        if let memo = row.memo, !memo.isEmpty {
          Text(memo)
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(PoogaeTheme.muted(colorScheme))
            .lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 14)
      .frame(minHeight: 44)
      .background(PoogaeTheme.surface(colorScheme))
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
  }

  private var chipColor: Color {
    if let hex = row.subjectColor {
      return Color(hexString: hex, fallback: PoogaeTheme.brand)
    }
    return PoogaeTheme.brand
  }
}
