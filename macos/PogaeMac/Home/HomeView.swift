import SwiftUI

/// Landscape home: LEFT 공부 기록 (day timeline) | RIGHT 복습.
struct HomeView: View {
  @ObservedObject var model: AppModel
  @Environment(\.colorScheme) private var colorScheme
  @State private var reviewDetail: HomeReviewCard?

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      header
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 22)

      // Equal flexible columns (~50/50 when wide); mins keep narrow windows usable.
      HStack(alignment: .top, spacing: 16) {
        studySection
          .frame(minWidth: 260, maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
          .layoutPriority(1)

        reviewSection
          .frame(minWidth: 200, maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
          .layoutPriority(1)
      }
      .padding(.horizontal, 20)
      .padding(.bottom, 16)
    }
    .background(PogaeTheme.canvas(colorScheme).ignoresSafeArea())
    .animation(PogaeMotion.settle, value: model.selectedDateKey)
    .animation(PogaeMotion.settle, value: model.studies.map(\.id))
    .animation(PogaeMotion.settle, value: model.reviews.map(\.id))
    .sheet(item: $model.studyEditor) { presentation in
      StudyEditorSheet(model: model, presentation: presentation)
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }
    .sheet(item: $reviewDetail) { card in
      ReviewDetailSheet(model: model, card: card)
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }
    .task(id: model.reviews.map(\.id)) {
      // ASC only: open first review after isolated seed is visible (re-read, don't capture stale).
      guard ProcessInfo.processInfo.environment["POGAE_SHOT_REVIEW_DETAIL"] == "1",
            reviewDetail == nil,
            let first = model.reviews.first,
            model.studyRecord(id: first.checkTargets.first?.studyId ?? "") != nil
      else { return }
      try? await Task.sleep(nanoseconds: 400_000_000)
      guard reviewDetail == nil, let latest = model.reviews.first else { return }
      withAnimation(PogaeMotion.quick) {
        reviewDetail = latest
      }
    }
  }

  private var header: some View {
    HStack(alignment: .center, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        HStack(spacing: 8) {
          Circle()
            .fill(PogaeTheme.brand)
            .frame(width: 10, height: 10)
          Text(model.isViewingToday ? "오늘" : "선택한 날")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(PogaeTheme.section(colorScheme))
          if !model.isViewingToday {
            Button("오늘로") {
              model.goToday()
            }
            .buttonStyle(.plain)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(PogaeTheme.brand.opacity(0.85))
            .help("오늘로 이동")
          }
        }

        HStack(spacing: 4) {
          dayArrow(systemName: "chevron.left", help: "이전 날") {
            model.shiftSelectedDay(-1)
          }

          Text(headerDateLabel)
            .font(.system(size: 24, weight: .bold))
            .foregroundStyle(PogaeTheme.ink(colorScheme))
            .lineLimit(1)
            .minimumScaleFactor(0.85)

          dayArrow(systemName: "chevron.right", help: "다음 날") {
            model.shiftSelectedDay(1)
          }
        }
      }

      Spacer(minLength: 8)

      Button {
        model.openCalendar()
      } label: {
        Label("캘린더", systemImage: "calendar")
          .font(.system(size: 13, weight: .medium))
          .padding(.horizontal, 12)
          .padding(.vertical, 8)
          .background(PogaeTheme.surface(colorScheme))
          .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
      }
      .buttonStyle(.plain)
      .help("캘린더로 이동")
    }
  }

  private func dayArrow(systemName: String, help: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: systemName)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(PogaeTheme.muted(colorScheme).opacity(0.75))
        .frame(width: 28, height: 28)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .help(help)
  }

  private var studySection: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("공부 기록")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(PogaeTheme.section(colorScheme))

      ScrollView(.vertical, showsIndicators: false) {
        StudyDayTimeline(model: model)
      }
    }
  }

  private var reviewSection: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("복습")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(PogaeTheme.section(colorScheme))

      ScrollView(.vertical, showsIndicators: false) {
        if model.reviews.isEmpty {
          emptyReview
        } else {
          LazyVStack(alignment: .leading, spacing: 10) {
            ForEach(model.reviews) { card in
              ReviewCardView(
                card: card,
                onToggle: { model.toggleReview(card) },
                onDetail: {
                  withAnimation(PogaeMotion.quick) {
                    reviewDetail = card
                  }
                }
              )
              .frame(maxWidth: .infinity)
              .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
          }
        }
      }
    }
  }

  private var emptyReview: some View {
    Text("할 복습이 없어요")
      .font(.system(size: 14, weight: .medium))
      .foregroundStyle(PogaeTheme.muted(colorScheme))
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(14)
      .background(PogaeTheme.surface(colorScheme))
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
