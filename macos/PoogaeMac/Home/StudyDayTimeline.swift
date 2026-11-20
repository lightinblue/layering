import SwiftUI

/// Port of iOS `StudyDayTimeline` — faint 8/12/18/24 marks + banded study rows.
/// Drag rows within a band to reorder (persists via `dayOrder`).
struct StudyDayTimeline: View {
  @ObservedObject var model: AppModel
  @Environment(\.colorScheme) private var colorScheme

  private let slotHeight: CGFloat = 36
  private let slotGap: CGFloat = 5

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      ForEach(Array(model.timelineBands.enumerated()), id: \.element.id) { index, band in
        bandBlock(band, isLast: index == model.timelineBands.count - 1)
      }

      if !model.canAddStudy {
        Text("하루 \(StudyTimeline.maxStudiesPerDay)개까지")
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(PoogaeTheme.muted(colorScheme))
          .padding(.top, 4)
          .transition(.opacity)
      }
    }
    .animation(PoogaeMotion.settle, value: model.studies.map(\.id))
    .animation(PoogaeMotion.settle, value: model.studies.map { "\($0.id):\($0.dayOrder ?? -1)" })
  }

  private func bandBlock(_ band: StudyTimeline.BandView, isLast: Bool) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      timelineMark(band.labelStart)

      VStack(alignment: .leading, spacing: slotGap) {
        if !band.studyRows.isEmpty {
          List {
            ForEach(band.studyRows) { row in
              StudyRecordRow(
                row: row,
                onEdit: { model.openEditStudy(row) },
                onDelete: { model.deleteStudy(id: row.id) }
              )
              .listRowInsets(EdgeInsets(top: 2, leading: 0, bottom: 2, trailing: 0))
              .listRowSeparator(.hidden)
              .listRowBackground(Color.clear)
              .transition(.opacity.combined(with: .move(edge: .top)))
            }
            .onMove { source, destination in
              withAnimation(PoogaeMotion.settle) {
                model.reorderBand(bandId: band.id, fromOffsets: source, toOffset: destination)
              }
            }
          }
          .listStyle(.plain)
          .scrollContentBackground(.hidden)
          .scrollDisabled(true)
          .frame(height: listHeight(for: band.studyRows.count))
          .environment(\.defaultMinListRowHeight, slotHeight)
        }

        if model.canAddStudy && band.showAdd {
          bandAddControl(band)
            .transition(.opacity.combined(with: .scale(scale: 0.98)))
        }
      }
      .padding(.leading, 28)

      if isLast {
        timelineMark(band.labelEnd)
      }
    }
  }

  private func listHeight(for count: Int) -> CGFloat {
    guard count > 0 else { return 0 }
    return CGFloat(count) * (slotHeight + slotGap)
  }

  private func timelineMark(_ label: String) -> some View {
    HStack(spacing: 10) {
      Text(label)
        .font(.system(size: 11, weight: .medium).monospacedDigit())
        .foregroundStyle(PoogaeTheme.muted(colorScheme).opacity(0.85))
        .frame(width: 22, alignment: .trailing)
      Rectangle()
        .fill(PoogaeTheme.muted(colorScheme).opacity(0.28))
        .frame(height: 1)
    }
    .padding(.vertical, 1)
  }

  private func bandAddControl(_ band: StudyTimeline.BandView) -> some View {
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
      .foregroundStyle(PoogaeTheme.section(colorScheme))
      .frame(maxWidth: .infinity)
      .frame(minHeight: height)
      .background(PoogaeTheme.surface(colorScheme))
      .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))
    }
    .buttonStyle(.plain)
    .help(band.addLabel)
  }
}
