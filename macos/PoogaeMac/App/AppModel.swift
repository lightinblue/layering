import AppKit
import Combine
import SwiftUI

@MainActor
final class AppModel: ObservableObject {
  @Published var path = NavigationPath()
  @Published var selectedDateKey: String = DateKeys.todayKey()
  @Published var isPresentingAddStudy = false

  let kvs = ICloudKvsStore()
  private var cancellables = Set<AnyCancellable>()

  var todayKey: String { DateKeys.todayKey() }

  var isViewingToday: Bool { selectedDateKey == todayKey }

  var studies: [HomeStudyRow] {
    TodayHomeData.studies(for: selectedDateKey, data: kvs.data)
  }

  var reviews: [HomeReviewCard] {
    TodayHomeData.reviews(for: selectedDateKey, data: kvs.data)
  }

  var todayReviews: [HomeReviewCard] {
    TodayHomeData.reviews(for: todayKey, data: kvs.data)
  }

  var subjects: [SubjectChip] {
    ICloudMerge.activeSubjects(kvs.data.subjects)
  }

  var canAddStudy: Bool {
    AppMutations.countStudies(on: selectedDateKey, in: kvs.data) < AppMutations.maxStudiesPerDay
  }

  var studyDateKeys: Set<String> {
    AppMutations.dateKeysWithStudies(kvs.data)
  }

  init() {
    kvs.objectWillChange
      .receive(on: RunLoop.main)
      .sink { [weak self] _ in
        self?.objectWillChange.send()
      }
      .store(in: &cancellables)
  }

  func bootstrap() async {
    await kvs.bootstrap()
    selectedDateKey = todayKey
  }

  func openCalendar() {
    withAnimation(PoogaeMotion.panel) {
      path.append(MacRoute.calendar)
    }
  }

  func openAddStudy() {
    guard canAddStudy else { return }
    withAnimation(PoogaeMotion.quick) {
      isPresentingAddStudy = true
    }
  }

  func focusMainWindow() {
    NSApp.activate(ignoringOtherApps: true)
    if let window = NSApp.windows.first(where: {
      $0.title == "포개" || $0.identifier?.rawValue == "main"
    }) {
      window.makeKeyAndOrderFront(nil)
    } else {
      NSApp.windows.first?.makeKeyAndOrderFront(nil)
    }
  }

  func addStudy(subjectId: String, content: String, memo: String?) {
    guard let next = AppMutations.appendStudy(
      kvs.data,
      subjectId: subjectId,
      content: content,
      memo: memo,
      studiedOn: selectedDateKey
    ) else { return }

    withAnimation(PoogaeMotion.settle) {
      kvs.applyLocal(next)
      isPresentingAddStudy = false
    }
  }

  func toggleReview(_ card: HomeReviewCard) {
    var next = kvs.data
    let now = ISO8601DateFormatter.fractional.string(from: Date())
    for target in card.checkTargets {
      guard let idx = next.records.firstIndex(where: { $0.id == target.studyId }) else {
        continue
      }
      let key = String(target.intervalDays)
      let wasDone = next.records[idx].checks[key]?.done == true
      next.records[idx].checks[key] = ReviewCheck(done: !wasDone, updatedAt: now)
      next.records[idx].updatedAt = now
    }
    withAnimation(PoogaeMotion.settle) {
      kvs.applyLocal(next)
    }
  }
}

enum MacRoute: Hashable {
  case calendar
}
