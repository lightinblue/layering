import Foundation

struct HomeStudyRow: Identifiable, Hashable {
  var id: String
  var subjectId: String
  var subjectName: String
  var subjectColor: String?
  var content: String
  var memo: String?
  var dayBand: DayBandId?
  var dayOrder: Int?
  var createdAt: String
}

struct HomeReviewCheckTarget: Hashable {
  var studyId: String
  var intervalDays: Int
}

struct HomeReviewCard: Identifiable, Hashable {
  var id: String
  var intervalDays: Int
  var subjectNames: [String]
  var subjectColors: [String]
  var completed: Bool
  var checkTargets: [HomeReviewCheckTarget]
}

enum TodayHomeData {
  static func studies(for dateKey: String, data: AppData) -> [HomeStudyRow] {
    let day = DateKeys.normalizeDateKey(dateKey)
    return ICloudMerge.activeRecords(data.records)
      .filter { DateKeys.normalizeDateKey($0.studiedOn) == day }
      .sorted(by: studySort)
      .map {
        HomeStudyRow(
          id: $0.id,
          subjectId: $0.subjectId,
          subjectName: $0.subjectName,
          subjectColor: AppMutations.resolveSubjectColor(
            name: $0.subjectName,
            subjectId: $0.subjectId,
            recordColor: $0.subjectColor,
            subjects: data.subjects
          ),
          content: $0.content,
          memo: $0.memo,
          dayBand: $0.dayBand,
          dayOrder: $0.dayOrder,
          createdAt: $0.createdAt
        )
      }
  }

  private static func studySort(_ a: StudyRecord, _ b: StudyRecord) -> Bool {
    let ao = a.dayOrder ?? Int.max
    let bo = b.dayOrder ?? Int.max
    if ao != bo { return ao < bo }
    if a.createdAt != b.createdAt { return a.createdAt < b.createdAt }
    return a.id < b.id
  }

  static func reviews(for dateKey: String, data: AppData) -> [HomeReviewCard] {
    struct Due {
      var record: StudyRecord
      var intervalDays: Int
    }

    let day = DateKeys.normalizeDateKey(dateKey)
    var due: [Due] = []
    for record in ICloudMerge.activeRecords(data.records) {
      let studiedOn = DateKeys.normalizeDateKey(record.studiedOn)
      let cycle = record.cycle.isEmpty ? ReviewIntervals.days : record.cycle
      for interval in cycle {
        if DateKeys.addDays(studiedOn, interval) == day {
          due.append(Due(record: record, intervalDays: interval))
        }
      }
    }
    guard !due.isEmpty else { return [] }

    var byInterval: [Int: [Due]] = [:]
    for item in due {
      byInterval[item.intervalDays, default: []].append(item)
    }

    return byInterval.keys.sorted().map { interval in
      let items = byInterval[interval] ?? []
      let targets = items.map {
        HomeReviewCheckTarget(studyId: $0.record.id, intervalDays: interval)
      }
      // Stable unique names (Set alone shuffled colors vs names by index).
      var seen = Set<String>()
      var names: [String] = []
      for item in items {
        let name = item.record.subjectName
        if seen.insert(name).inserted {
          names.append(name)
        }
      }
      // Parallel colors: live subject.color first (same as iOS colorByName).
      let colors: [String] = names.map { name in
        let sample = items.first { $0.record.subjectName == name }?.record
        return AppMutations.resolveSubjectColor(
          name: name,
          subjectId: sample?.subjectId,
          recordColor: sample?.subjectColor,
          subjects: data.subjects
        )
      }
      let completed = items.allSatisfy { item in
        item.record.checks[String(interval)]?.done == true
      }
      return HomeReviewCard(
        id: targets.map { "\($0.studyId)#\($0.intervalDays)" }.joined(separator: "+"),
        intervalDays: interval,
        subjectNames: names,
        subjectColors: colors,
        completed: completed,
        checkTargets: targets
      )
    }
  }
}
