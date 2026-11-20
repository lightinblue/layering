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
  /// Mirror of `kvs.data` updated via `$data` (after change) so home never reads stale KVS.
  @Published private(set) var appData: AppData = .empty
  private var cancellables = Set<AnyCancellable>()
  private var didBootstrap = false

  var todayKey: String { DateKeys.todayKey() }

  var isViewingToday: Bool { selectedDateKey == todayKey }

  var studies: [HomeStudyRow] {
    TodayHomeData.studies(for: selectedDateKey, data: appData)
  }

  var reviews: [HomeReviewCard] {
    TodayHomeData.reviews(for: selectedDateKey, data: appData)
  }

  var todayReviews: [HomeReviewCard] {
    TodayHomeData.reviews(for: todayKey, data: appData)
  }

  var subjects: [SubjectChip] {
    ICloudMerge.activeSubjects(appData.subjects)
  }

  var canAddStudy: Bool {
    AppMutations.countStudies(on: selectedDateKey, in: appData) < AppMutations.maxStudiesPerDay
  }

  var canAddSubject: Bool {
    subjects.count < AppMutations.maxSubjects
  }

  var studyDateKeys: Set<String> {
    AppMutations.dateKeysWithStudies(appData)
  }

  var timelineBands: [StudyTimeline.BandView] {
    StudyTimeline.buildBands(studies: studies)
  }

  /// 0 = Sunday, 1 = Monday — from KVS `prefs`.
  var weekStartsOn: Int { kvs.prefs.weekStartsOn }

  func setWeekStartsOn(_ value: Int) {
    kvs.updatePrefs { $0.weekStartsOn = (value == 1) ? 1 : 0 }
  }

  init() {
    // Use `$data` (post-change), not `objectWillChange` (pre-change) — forwarding willChange
    // made HomeView render with an empty store right before records landed.
    kvs.$data
      .receive(on: RunLoop.main)
      .sink { [weak self] data in
        self?.appData = data
      }
      .store(in: &cancellables)
    kvs.$prefs
      .receive(on: RunLoop.main)
      .sink { [weak self] _ in self?.objectWillChange.send() }
      .store(in: &cancellables)
    kvs.$statusMessage
      .receive(on: RunLoop.main)
      .sink { [weak self] _ in self?.objectWillChange.send() }
      .store(in: &cancellables)
    kvs.$debugSummary
      .receive(on: RunLoop.main)
      .sink { [weak self] _ in self?.objectWillChange.send() }
      .store(in: &cancellables)
  }

  func bootstrap() async {
    if didBootstrap {
      await kvs.refreshFromCloud()
      return
    }
    didBootstrap = true
    await kvs.bootstrap()
    // Force mirror sync in case $data subscription raced bootstrap writes.
    appData = kvs.data
    selectedDateKey = todayKey
    // Calendar ASC shot (optional; seed isolation is handled inside KVS bootstrap).
    if ProcessInfo.processInfo.environment["POGAE_SHOT_CALENDAR"] == "1" {
      path.append(MacRoute.calendar)
    }
  }

  func openCalendar() {
    withAnimation(PogaeMotion.panel) {
      path.append(MacRoute.calendar)
    }
  }

  /// Flip home by ±1 day (iOS week-strip day change, Mac chevron).
  func shiftSelectedDay(_ days: Int) {
    let next = DateKeys.addDays(selectedDateKey, days)
    guard next != selectedDateKey else { return }
    withAnimation(PogaeMotion.settle) {
      selectedDateKey = next
    }
  }

  func goToday() {
    guard !isViewingToday else { return }
    withAnimation(PogaeMotion.settle) {
      selectedDateKey = todayKey
    }
  }

  /// Jump home to a study's 학습일 (e.g. from review detail).
  func selectDate(_ dateKey: String) {
    let next = DateKeys.normalizeDateKey(dateKey)
    guard !next.isEmpty, next != selectedDateKey else { return }
    withAnimation(PogaeMotion.settle) {
      selectedDateKey = next
    }
  }

  func forcePullFromICloud() {
    Task { await kvs.forcePullFromICloud() }
  }

  func resetLocalStoreAndPull() {
    Task { await kvs.resetLocalStoreAndPull() }
  }

  func openAddStudy(band: DayBandId? = nil) {
    guard canAddStudy else { return }
    withAnimation(PogaeMotion.quick) {
      studyEditor = .add(band: band)
    }
  }

  func openEditStudy(_ row: HomeStudyRow) {
    withAnimation(PogaeMotion.quick) {
      studyEditor = .edit(studyId: row.id)
    }
  }

  func openAddSubject() {
    guard canAddSubject else { return }
    withAnimation(PogaeMotion.quick) {
      subjectEditor = .add
    }
  }

  func openEditSubject(_ subject: SubjectChip) {
    withAnimation(PogaeMotion.quick) {
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

  /// Returns whether the editor should stay open for continuous add.
  @discardableResult
  func saveStudy(subjectId: String, content: String, memo: String?, editingStudyId: String?) -> Bool {
    let next: AppData?
    let isAdd = editingStudyId == nil
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
    guard let next else { return false }
    withAnimation(PogaeMotion.settle) {
      kvs.applyLocal(next)
      // Continuous add: keep sheet open under the daily cap.
      if !isAdd || AppMutations.countStudies(on: selectedDateKey, in: next) >= AppMutations.maxStudiesPerDay {
        studyEditor = nil
      }
    }
    return isAdd && AppMutations.countStudies(on: selectedDateKey, in: next) < AppMutations.maxStudiesPerDay
  }

  func reorderBand(bandId: DayBandId, fromOffsets: IndexSet, toOffset: Int) {
    var bands = timelineBands
    guard let bandIndex = bands.firstIndex(where: { $0.id == bandId }) else { return }
    var rows = bands[bandIndex].studyRows
    rows.move(fromOffsets: fromOffsets, toOffset: toOffset)
    bands[bandIndex] = StudyTimeline.BandView(
      id: bands[bandIndex].id,
      labelStart: bands[bandIndex].labelStart,
      labelEnd: bands[bandIndex].labelEnd,
      slots: rows.map { .study($0) },
      showAdd: bands[bandIndex].showAdd,
      addSpan: bands[bandIndex].addSpan,
      addLabel: bands[bandIndex].addLabel
    )
    let orderedIds = StudyTimeline.flattenBandStudyIds(bands)
    guard let next = AppMutations.reorderStudiesOnDay(
      kvs.data,
      studiedOn: selectedDateKey,
      orderedIds: orderedIds
    ) else { return }
    withAnimation(PogaeMotion.settle) {
      kvs.applyLocal(next)
    }
  }

  func deleteStudy(id: String) {
    guard let next = AppMutations.deleteStudy(kvs.data, studyId: id) else { return }
    withAnimation(PogaeMotion.settle) {
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
      withAnimation(PogaeMotion.settle) {
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
    withAnimation(PogaeMotion.settle) {
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
    withAnimation(PogaeMotion.settle) {
      kvs.applyLocal(next)
    }
  }

  func studyRecord(id: String) -> StudyRecord? {
    // Prefer AppModel mirror (keeps ASC shot isolation + UI in sync).
    ICloudMerge.activeRecords(appData.records).first { $0.id == id }
      ?? ICloudMerge.activeRecords(kvs.data.records).first { $0.id == id }
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
