import SwiftUI

/// 「복습 내용」 — header 「n일 전」+ date; body grouped by subject bullets.
struct ReviewDetailSheet: View {
  @ObservedObject var model: AppModel
  let card: HomeReviewCard
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.dismiss) private var dismiss

  private var studies: [StudyRecord] {
    let ids = card.checkTargets.map(\.studyId)
    return ids.compactMap { model.studyRecord(id: $0) }
  }

  private var studiedOnLabel: String {
    let dates = Array(
      Set(
        studies
          .map { DateKeys.normalizeDateKey($0.studiedOn) }
          .filter { !$0.isEmpty }
      )
    ).sorted()
    return dates.first ?? ""
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
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 4) {
          Text("복습 내용")
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(PoogaeTheme.ink(colorScheme))
          HStack(spacing: 10) {
            Text("\(card.intervalDays)일 전")
              .font(.system(size: 12, weight: .medium))
              .foregroundStyle(PoogaeTheme.muted(colorScheme))
            if !studiedOnLabel.isEmpty {
              Text(studiedOnLabel)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(PoogaeTheme.section(colorScheme))
            }
          }
        }
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

  private func goToStudyDate(_ studiedOn: String) {
    dismiss()
    model.selectDate(studiedOn)
  }

  private func subjectGroupCard(
    _ group: (subjectName: String, subjectColor: String?, items: [StudyRecord])
  ) -> some View {
    let chipDate = group.items.first?.studiedOn ?? ""
    return VStack(alignment: .leading, spacing: 10) {
      // Subject chip is tappable (navigates; never opens edit).
      Button {
        goToStudyDate(chipDate)
      } label: {
        Text(group.subjectName)
          .font(.system(size: SubjectChipStyle.fontSize, weight: .semibold))
          .foregroundStyle(.white)
          .padding(.horizontal, SubjectChipStyle.horizontalPadding)
          .frame(minHeight: SubjectChipStyle.minHeight)
          .background(SubjectChipStyle.fill(hex: group.subjectColor))
          .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))
          .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .help("학습일로 이동")

      VStack(alignment: .leading, spacing: 2) {
        ForEach(group.items) { study in
          Button {
            goToStudyDate(study.studiedOn)
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
            }
            // Full-row hit box: empty trailing padding is tappable too.
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, minHeight: 28, alignment: .leading)
            .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .help("학습일로 이동")
        }
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(PoogaeTheme.surface(colorScheme))
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}
