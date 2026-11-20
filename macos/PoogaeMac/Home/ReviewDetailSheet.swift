import SwiftUI

/// 「복습 내용」 — studies grouped by subject; 「n일 전」 beside each item (no 학습일).
struct ReviewDetailSheet: View {
  @ObservedObject var model: AppModel
  let card: HomeReviewCard
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.dismiss) private var dismiss

  private var studies: [StudyRecord] {
    let ids = card.checkTargets.map(\.studyId)
    return ids.compactMap { model.studyRecord(id: $0) }
  }

  private var groups: [(subjectName: String, subjectColor: String?, items: [StudyRecord])] {
    var order: [String] = []
    var map: [String: (color: String?, items: [StudyRecord])] = [:]
    for study in studies {
      if map[study.subjectName] == nil {
        order.append(study.subjectName)
        map[study.subjectName] = (study.subjectColor, [study])
      } else {
        map[study.subjectName]?.items.append(study)
      }
    }
    return order.map { name in
      let g = map[name]!
      return (name, g.color, g.items)
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Text("복습 내용")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(PoogaeTheme.ink(colorScheme))
        Spacer()
        Button("닫기") {
          withAnimation(PoogaeMotion.quick) { dismiss() }
        }
        .buttonStyle(.plain)
        .foregroundStyle(PoogaeTheme.section(colorScheme))
      }
      .padding(.horizontal, 22)
      .padding(.top, 22)
      .padding(.bottom, 14)

      ScrollView(.vertical, showsIndicators: true) {
        LazyVStack(alignment: .leading, spacing: 10) {
          if groups.isEmpty {
            Text("연결된 공부 기록이 없어요")
              .font(.system(size: 14, weight: .medium))
              .foregroundStyle(PoogaeTheme.muted(colorScheme))
              .frame(maxWidth: .infinity, alignment: .leading)
              .padding(14)
              .background(PoogaeTheme.surface(colorScheme))
              .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
          } else {
            ForEach(groups, id: \.subjectName) { group in
              subjectGroupCard(group)
            }
          }
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 20)
      }
    }
    .frame(width: 420, height: 360)
    .background(PoogaeTheme.canvas(colorScheme))
  }

  private func subjectGroupCard(
    _ group: (subjectName: String, subjectColor: String?, items: [StudyRecord])
  ) -> some View {
    let ago = "\(card.intervalDays)일 전"
    return VStack(alignment: .leading, spacing: 10) {
      Text(group.subjectName)
        .font(.system(size: SubjectChipStyle.fontSize, weight: .semibold))
        .foregroundStyle(.white)
        .padding(.horizontal, SubjectChipStyle.horizontalPadding)
        .frame(minHeight: SubjectChipStyle.minHeight)
        .background(SubjectChipStyle.fill(hex: group.subjectColor))
        .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))

      VStack(alignment: .leading, spacing: 6) {
        ForEach(group.items) { study in
          Button {
            dismiss()
            model.openEditStudy(
              HomeStudyRow(
                id: study.id,
                subjectId: study.subjectId,
                subjectName: study.subjectName,
                subjectColor: study.subjectColor,
                content: study.content,
                memo: study.memo,
                dayBand: study.dayBand,
                dayOrder: study.dayOrder,
                createdAt: study.createdAt
              )
            )
          } label: {
            HStack(alignment: .top, spacing: 8) {
              Text("•")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(PoogaeTheme.ink(colorScheme))
                .frame(width: 12, alignment: .leading)
              Text(study.content)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(PoogaeTheme.ink(colorScheme))
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
              Text(ago)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(PoogaeTheme.muted(colorScheme))
                .fixedSize(horizontal: true, vertical: false)
            }
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .help("기록 수정")
        }
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(PoogaeTheme.surface(colorScheme))
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}
