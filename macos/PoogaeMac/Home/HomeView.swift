import SwiftUI

/// Landscape home: today's study records + review cards (calendar is a depth).
struct HomeView: View {
  @ObservedObject var model: AppModel
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      header
        .padding(.horizontal, 28)
        .padding(.top, 22)
        .padding(.bottom, 18)

      ScrollView(.vertical, showsIndicators: false) {
        VStack(alignment: .leading, spacing: 28) {
          studySection
          reviewSection
        }
        .padding(.horizontal, 28)
        .padding(.bottom, 28)
      }
    }
    .background(PoogaeTheme.canvas(colorScheme).ignoresSafeArea())
    .animation(PoogaeMotion.settle, value: model.studies.count)
    .animation(PoogaeMotion.settle, value: model.reviews.map(\.id))
  }

  private var header: some View {
    HStack(alignment: .firstTextBaseline) {
      VStack(alignment: .leading, spacing: 6) {
        HStack(spacing: 8) {
          Circle()
            .fill(PoogaeTheme.brand)
            .frame(width: 10, height: 10)
          Text("오늘")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(PoogaeTheme.section(colorScheme))
        }
        Text(headerDateLabel)
          .font(.system(size: 28, weight: .bold))
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
    VStack(alignment: .leading, spacing: 12) {
      Text("공부 기록")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(PoogaeTheme.section(colorScheme))

      if model.studies.isEmpty {
        emptyStudy
      } else {
        LazyVStack(alignment: .leading, spacing: 8) {
          ForEach(model.studies) { row in
            StudyRecordRow(row: row)
              .transition(.opacity.combined(with: .move(edge: .top)))
          }
        }
      }
    }
  }

  private var reviewSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("복습")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(PoogaeTheme.section(colorScheme))

      if model.reviews.isEmpty {
        emptyReview
      } else {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(alignment: .top, spacing: 12) {
            ForEach(model.reviews) { card in
              ReviewCardView(card: card) {
                model.toggleReview(card)
              }
              .frame(width: 200)
              .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
          }
          .padding(.vertical, 2)
        }
      }
    }
  }

  private var emptyStudy: some View {
    Text("오늘 공부 기록이 없어요")
      .font(.system(size: 14, weight: .medium))
      .foregroundStyle(PoogaeTheme.muted(colorScheme))
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(16)
      .background(PoogaeTheme.surface(colorScheme))
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }

  private var emptyReview: some View {
    Text("오늘 할 복습이 없어요")
      .font(.system(size: 14, weight: .medium))
      .foregroundStyle(PoogaeTheme.muted(colorScheme))
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(16)
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
