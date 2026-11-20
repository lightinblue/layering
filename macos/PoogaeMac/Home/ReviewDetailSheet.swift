import SwiftUI

/// 「복습 내용」 — subject / content / memo for studies on a review card (phone parity).
struct ReviewDetailSheet: View {
  @ObservedObject var model: AppModel
  let card: HomeReviewCard
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.dismiss) private var dismiss

  private var studies: [StudyRecord] {
    let ids = card.checkTargets.map(\.studyId)
    return ids.compactMap { model.studyRecord(id: $0) }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text("복습 내용")
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(PoogaeTheme.ink(colorScheme))
          Text("\(card.intervalDays)일 전")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(PoogaeTheme.muted(colorScheme))
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
          if studies.isEmpty {
            Text("연결된 공부 기록이 없어요")
              .font(.system(size: 14, weight: .medium))
              .foregroundStyle(PoogaeTheme.muted(colorScheme))
              .frame(maxWidth: .infinity, alignment: .leading)
              .padding(14)
              .background(PoogaeTheme.surface(colorScheme))
              .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
          } else {
            ForEach(studies) { study in
              studyCard(study)
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

  private func studyCard(_ study: StudyRecord) -> some View {
    let memo = study.memo?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        Text(study.subjectName)
          .font(.system(size: SubjectChipStyle.fontSize, weight: .semibold))
          .foregroundStyle(.white)
          .padding(.horizontal, SubjectChipStyle.horizontalPadding)
          .frame(minHeight: SubjectChipStyle.minHeight)
          .background(SubjectChipStyle.fill(hex: study.subjectColor))
          .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))

        Text("학습일 \(DateKeys.normalizeDateKey(study.studiedOn))")
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(PoogaeTheme.section(colorScheme))
          .lineLimit(1)
      }

      Text(study.content)
        .font(.system(size: 14, weight: .medium))
        .foregroundStyle(PoogaeTheme.ink(colorScheme))
        .frame(maxWidth: .infinity, alignment: .leading)

      if !memo.isEmpty {
        Text(memo)
          .font(.system(size: 13, weight: .regular))
          .foregroundStyle(PoogaeTheme.muted(colorScheme))
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(PoogaeTheme.surface(colorScheme))
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    .contentShape(Rectangle())
    .onTapGesture {
      dismiss()
      model.openEditStudy(
        HomeStudyRow(
          id: study.id,
          subjectId: study.subjectId,
          subjectName: study.subjectName,
          subjectColor: study.subjectColor,
          content: study.content,
          memo: study.memo,
          dayBand: study.dayBand
        )
      )
    }
  }
}
