import SwiftUI

/// Landscape home: LEFT 공부 기록 | RIGHT 복습 (calendar is a depth).
struct HomeView: View {
  @ObservedObject var model: AppModel
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      header
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 22)

      HStack(alignment: .top, spacing: 16) {
        studySection
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

        reviewSection
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
      .padding(.horizontal, 20)
      .padding(.bottom, 16)
    }
    .background(PoogaeTheme.canvas(colorScheme).ignoresSafeArea())
    .animation(PoogaeMotion.settle, value: model.studies.count)
    .animation(PoogaeMotion.settle, value: model.reviews.map(\.id))
    .sheet(item: $model.studyEditor) { presentation in
      StudyEditorSheet(model: model, presentation: presentation)
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }
  }

  private var header: some View {
    HStack(alignment: .firstTextBaseline) {
      VStack(alignment: .leading, spacing: 4) {
        HStack(spacing: 8) {
          Circle()
            .fill(PoogaeTheme.brand)
            .frame(width: 10, height: 10)
          Text(model.isViewingToday ? "오늘" : "선택한 날")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(PoogaeTheme.section(colorScheme))
        }
        Text(headerDateLabel)
          .font(.system(size: 24, weight: .bold))
          .foregroundStyle(PoogaeTheme.ink(colorScheme))
      }

      Spacer()

      Button {
        model.openCalendar()
      } label: {
        Label("캘린더", systemImage: "calendar")
          .font(.system(size: 13, weight: .medium))
          .padding(.horizontal, 12)
          .padding(.vertical, 8)
          .background(PoogaeTheme.surface(colorScheme))
          .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
      }
      .buttonStyle(.plain)
      .help("캘린더로 이동")
    }
  }

  private var studySection: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("공부 기록")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(PoogaeTheme.section(colorScheme))
        Spacer(minLength: 0)
        Button {
          model.openAddStudy()
        } label: {
          Label("추가", systemImage: "plus")
            .font(.system(size: 12, weight: .semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundStyle(model.canAddStudy ? PoogaeTheme.brand : PoogaeTheme.muted(colorScheme))
            .background(PoogaeTheme.surface(colorScheme))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!model.canAddStudy)
        .help(model.canAddStudy ? "공부 기록 추가" : "하루 최대 3개")
      }

      ScrollView(.vertical, showsIndicators: false) {
        if model.studies.isEmpty {
          emptyStudy
        } else {
          LazyVStack(alignment: .leading, spacing: 8) {
            ForEach(model.studies) { row in
              StudyRecordRow(
                row: row,
                onEdit: { model.openEditStudy(row) },
                onDelete: { model.deleteStudy(id: row.id) }
              )
              .transition(.opacity.combined(with: .move(edge: .top)))
            }
          }
        }
      }
    }
  }

  private var reviewSection: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("복습")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(PoogaeTheme.section(colorScheme))

      ScrollView(.vertical, showsIndicators: false) {
        if model.reviews.isEmpty {
          emptyReview
        } else {
          LazyVStack(alignment: .leading, spacing: 10) {
            ForEach(model.reviews) { card in
              ReviewCardView(card: card) {
                model.toggleReview(card)
              }
              .frame(maxWidth: .infinity)
              .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
          }
        }
      }
    }
  }

  private var emptyStudy: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("공부 기록이 없어요")
        .font(.system(size: 14, weight: .medium))
        .foregroundStyle(PoogaeTheme.muted(colorScheme))
      if model.canAddStudy {
        Button {
          model.openAddStudy()
        } label: {
          Text("첫 기록 추가")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(PoogaeTheme.brand)
        }
        .buttonStyle(.plain)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(14)
    .background(PoogaeTheme.surface(colorScheme))
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }

  private var emptyReview: some View {
    Text("할 복습이 없어요")
      .font(.system(size: 14, weight: .medium))
      .foregroundStyle(PoogaeTheme.muted(colorScheme))
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(14)
      .background(PoogaeTheme.surface(colorScheme))
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }

  private var headerDateLabel: String {
    guard let date = DateKeys.parse(model.selectedDateKey) else {
      return model.selectedDateKey
    }
    let f = DateFormatter()
    f.locale = Locale(identifier: "ko_KR")
    f.dateFormat = "M월 d일 EEEE"
    return f.string(from: date)
  }
}
