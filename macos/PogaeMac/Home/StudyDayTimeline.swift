import SwiftUI

/// Port of iOS `StudyDayTimeline` — faint 8/12/18/24 marks + banded study rows.
/// Drag rows within a band to reorder (persists via `dayOrder`).
struct StudyDayTimeline: View {
  @ObservedObject var model: AppModel
  @Environment(\.colorScheme) private var colorScheme

  /// Match chip/content height so minHeight does not invent extra gap.
  private let slotHeight: CGFloat = SubjectChipStyle.minHeight
  /// Gap between study rows (not flush).
  private let slotGap: CGFloat = 4

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      ForEach(Array(model.timelineBands.enumerated()), id: \.element.id) { index, band in
        bandBlock(band, isLast: index == model.timelineBands.count - 1)
      }

      if !model.canAddStudy {
        Text("하루 \(StudyTimeline.maxStudiesPerDay)개까지")
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(PogaeTheme.muted(colorScheme))
          .padding(.top, 4)
          .transition(.opacity)
      }
    }
    .animation(PogaeMotion.settle, value: model.studies.map(\.id))
    .animation(PogaeMotion.settle, value: model.studies.map { "\($0.id):\($0.dayOrder ?? -1)" })
  }

  private func bandBlock(_ band: StudyTimeline.BandView, isLast: Bool) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      timelineMark(band.labelStart)

      VStack(alignment: .leading, spacing: slotGap) {
        BandStudyRows(
          rows: band.studyRows,
          slotHeight: slotHeight,
          slotGap: slotGap,
          onEdit: { model.openEditStudy($0) },
          onDelete: { model.deleteStudy(id: $0) },
          onMove: { from, to in
            model.reorderBand(bandId: band.id, fromOffsets: from, toOffset: to)
          }
        )

        if model.canAddStudy && band.showAdd {
          bandAddControl(band, filled: !band.studyRows.isEmpty)
            .transition(.opacity.combined(with: .scale(scale: 0.98)))
        }
      }
      .padding(.leading, 28)

      if isLast {
        timelineMark(band.labelEnd)
      }
    }
  }

  private func timelineMark(_ label: String) -> some View {
    HStack(spacing: 10) {
      Text(label)
        .font(.system(size: 11, weight: .medium).monospacedDigit())
        .foregroundStyle(PogaeTheme.muted(colorScheme).opacity(0.85))
        .frame(width: 22, alignment: .trailing)
      Rectangle()
        .fill(PogaeTheme.muted(colorScheme).opacity(0.28))
        .frame(height: 1)
    }
    .padding(.vertical, 1)
  }

  private func bandAddControl(_ band: StudyTimeline.BandView, filled: Bool) -> some View {
    let height = slotHeight * CGFloat(band.addSpan) + slotGap * CGFloat(max(0, band.addSpan - 1))
    return Button {
      model.openAddStudy(band: band.id)
    } label: {
      HStack(spacing: 6) {
        Image(systemName: "plus")
          .font(.system(size: 12, weight: .semibold))
        Text(band.addLabel)
          .font(.system(size: 13, weight: .medium))
      }
      .foregroundStyle(PogaeTheme.section(colorScheme))
      .frame(maxWidth: .infinity)
      .frame(minHeight: height)
      // Match phone: gray fill only when the band is empty.
      .background(filled ? Color.clear : PogaeTheme.surface(colorScheme))
      .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))
    }
    .buttonStyle(.plain)
    .help(band.addLabel)
  }
}

/// Drag-to-reorder study rows without a nested `List` (ScrollView-safe on macOS).
private struct BandStudyRows: View {
  let rows: [HomeStudyRow]
  let slotHeight: CGFloat
  let slotGap: CGFloat
  var onEdit: (HomeStudyRow) -> Void
  var onDelete: (String) -> Void
  var onMove: (IndexSet, Int) -> Void

  @State private var draggingId: String?

  var body: some View {
    VStack(alignment: .leading, spacing: slotGap) {
      ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
        StudyRecordRow(
          row: row,
          onEdit: { onEdit(row) },
          onDelete: { onDelete(row.id) }
        )
        .opacity(draggingId == row.id ? 0.55 : 1)
        .draggable(row.id) {
          StudyRecordRow(row: row, onEdit: {}, onDelete: {})
            .frame(width: 320)
            .opacity(0.92)
            .onAppear { draggingId = row.id }
        }
        .dropDestination(for: String.self) { items, _ in
          defer { draggingId = nil }
          guard let draggedId = items.first,
                let from = rows.firstIndex(where: { $0.id == draggedId }),
                from != index
          else { return false }
          var to = index
          if from < to { to += 1 }
          withAnimation(PogaeMotion.settle) {
            onMove(IndexSet(integer: from), to)
          }
          return true
        } isTargeted: { hovering in
          if !hovering && draggingId == row.id {
            draggingId = nil
          }
        }
        .frame(height: slotHeight)
      }
    }
    .animation(PogaeMotion.settle, value: rows.map(\.id))
  }
}
