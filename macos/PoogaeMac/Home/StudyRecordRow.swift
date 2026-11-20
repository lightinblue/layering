import SwiftUI

struct StudyRecordRow: View {
  let row: HomeStudyRow
  var onEdit: () -> Void
  var onDelete: () -> Void
  @Environment(\.colorScheme) private var colorScheme

  /// Home list chip height (unchanged); gray body matches this.
  private let chipHeight: CGFloat = 36

  var body: some View {
    Button(action: onEdit) {
      HStack(spacing: 10) {
        Text(row.subjectName)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(.white)
          .padding(.horizontal, 10)
          .frame(minWidth: 64, minHeight: chipHeight)
          .background(chipColor)
          .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

        Text(row.content)
          .font(.system(size: 14, weight: .medium))
          .foregroundStyle(PoogaeTheme.body(colorScheme))
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, 14)
          .frame(height: chipHeight)
          .background(PoogaeTheme.surface(colorScheme))
          .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
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
      return Color(hexString: hex, fallback: PoogaeTheme.brand)
    }
    return PoogaeTheme.brand
  }
}
