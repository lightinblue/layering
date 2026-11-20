import SwiftUI

struct StudyRecordRow: View {
  let row: HomeStudyRow
  var onEdit: () -> Void
  var onDelete: () -> Void
  @Environment(\.colorScheme) private var colorScheme

  private var chipHeight: CGFloat { SubjectChipStyle.minHeight }

  var body: some View {
    Button(action: onEdit) {
      HStack(spacing: 5) {
        Text(row.subjectName)
          .font(.system(size: SubjectChipStyle.fontSize, weight: .semibold))
          .foregroundStyle(.white)
          .padding(.horizontal, SubjectChipStyle.horizontalPadding)
          .frame(minWidth: 56, minHeight: chipHeight)
          .background(chipColor)
          .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))

        Text(row.content)
          .font(.system(size: 13, weight: .medium))
          .foregroundStyle(PogaeTheme.body(colorScheme))
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, 12)
          .frame(height: chipHeight)
          .background(PogaeTheme.surface(colorScheme))
          .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .contextMenu {
      Button("수정", action: onEdit)
      Button("삭제", role: .destructive, action: onDelete)
    }
    .help("클릭해서 수정")
  }

  private var chipColor: Color {
    if let hex = row.subjectColor {
      return Color(hexString: hex, fallback: PogaeTheme.brand)
    }
    return PogaeTheme.brand
  }
}
