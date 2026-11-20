import AppKit
import Combine
import SwiftUI

@MainActor
final class AppModel: ObservableObject {
  @Published var path = NavigationPath()
  @Published var selectedDateKey: String = DateKeys.todayKey()
  @Published var studyEditor: StudyEditorPresentation?
  @Published var subjectEditor: SubjectEditorPresentation?

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

  var canAddSubject: Bool {
    subjects.count < AppMutations.maxSubjects
  }

  var studyDateKeys: Set<String> {
    AppMutations.dateKeysWithStudies(kvs.data)
  }

  var timelineBands: [StudyTimeline.BandView] {
    StudyTimeline.buildBands(studies: studies)
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

  /// Flip home by ±1 day (iOS week-strip day change, Mac chevron).
  func shiftSelectedDay(_ days: Int) {
    let next = DateKeys.addDays(selectedDateKey, days)
    guard next != selectedDateKey else { return }
    withAnimation(PoogaeMotion.settle) {
      selectedDateKey = next
    }
  }

  func goToday() {
    guard !isViewingToday else { return }
    withAnimation(PoogaeMotion.settle) {
      selectedDateKey = todayKey
    }
  }

  func forcePullFromICloud() {
    Task { await kvs.refreshFromCloud() }
  }

  func resetLocalStoreAndPull() {
    Task { await kvs.resetLocalStoreAndPull() }
  }

  func openAddStudy(band: DayBandId? = nil) {
    guard canAddStudy else { return }
    withAnimation(PoogaeMotion.quick) {
      studyEditor = .add(band: band)
    }
  }

  func openEditStudy(_ row: HomeStudyRow) {
    withAnimation(PoogaeMotion.quick) {
      studyEditor = .edit(studyId: row.id)
    }
  }

  func openAddSubject() {
    guard canAddSubject else { return }
    withAnimation(PoogaeMotion.quick) {
      subjectEditor = .add
    }
  }

  func openEditSubject(_ subject: SubjectChip) {
    withAnimation(PoogaeMotion.quick) {
      subjectEditor = .edit(subjectId: subject.id)
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

  func saveStudy(subjectId: String, content: String, memo: String?, editingStudyId: String?) {
    let next: AppData?
    if let editingStudyId {
      next = AppMutations.updateStudy(
        kvs.data,
        studyId: editingStudyId,
        subjectId: subjectId,
        content: content,
        memo: memo,
        studiedOn: selectedDateKey
      )
    } else {
      let band = studyEditor?.addBand
      next = AppMutations.appendStudy(
        kvs.data,
        subjectId: subjectId,
        content: content,
        memo: memo,
        studiedOn: selectedDateKey,
        dayBand: band
      )
    }
    guard let next else { return }
    withAnimation(PoogaeMotion.settle) {
      kvs.applyLocal(next)
      studyEditor = nil
    }
  }

  func deleteStudy(id: String) {
    guard let next = AppMutations.deleteStudy(kvs.data, studyId: id) else { return }
    withAnimation(PoogaeMotion.settle) {
      kvs.applyLocal(next)
      if case .edit(let editingId) = studyEditor, editingId == id {
        studyEditor = nil
      }
    }
  }

  @discardableResult
  func saveSubject(name: String, color: String, editingSubjectId: String?) -> AppMutations.SubjectFailure? {
    let result: Result<AppData, AppMutations.SubjectFailure>
    if let editingSubjectId {
      result = AppMutations.updateSubject(
        kvs.data,
        subjectId: editingSubjectId,
        rawName: name,
        color: color
      )
    } else {
      result = AppMutations.addSubject(kvs.data, rawName: name, color: color)
    }
    switch result {
    case .success(let next):
      withAnimation(PoogaeMotion.settle) {
        kvs.applyLocal(next)
        subjectEditor = nil
      }
      return nil
    case .failure(let reason):
      return reason
    }
  }

  func deleteSubject(id: String) {
    guard case .success(let next) = AppMutations.removeSubject(kvs.data, subjectId: id) else { return }
    withAnimation(PoogaeMotion.settle) {
      kvs.applyLocal(next)
      if case .edit(let editingId) = subjectEditor, editingId == id {
        subjectEditor = nil
      }
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

  func studyRecord(id: String) -> StudyRecord? {
    ICloudMerge.activeRecords(kvs.data.records).first { $0.id == id }
  }

  func subject(id: String) -> SubjectChip? {
    subjects.first { $0.id == id }
  }
}

enum MacRoute: Hashable {
  case calendar
}

enum StudyEditorPresentation: Identifiable, Equatable {
  case add(band: DayBandId?)
  case edit(studyId: String)

  var id: String {
    switch self {
    case .add(let band): return "add-\(band?.rawValue ?? "none")"
    case .edit(let studyId): return "edit-\(studyId)"
    }
  }

  var editingStudyId: String? {
    if case .edit(let studyId) = self { return studyId }
    return nil
  }

  var addBand: DayBandId? {
    if case .add(let band) = self { return band }
    return nil
  }
}

enum SubjectEditorPresentation: Identifiable, Equatable {
  case add
  case edit(subjectId: String)

  var id: String {
    switch self {
    case .add: return "add"
    case .edit(let subjectId): return "edit-\(subjectId)"
    }
  }

  var editingSubjectId: String? {
    if case .edit(let subjectId) = self { return subjectId }
    return nil
  }
}
