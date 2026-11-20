import Foundation

struct HomeStudyRow: Identifiable, Hashable {
  var id: String
  var subjectId: String
  var subjectName: String
  var subjectColor: String?
  var content: String
  var memo: String?
  var dayBand: DayBandId?
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
    ICloudMerge.activeRecords(data.records)
      .filter { $0.studiedOn == dateKey }
      .sorted { $0.createdAt < $1.createdAt }
      .map {
        HomeStudyRow(
          id: $0.id,
          subjectId: $0.subjectId,
          subjectName: $0.subjectName,
          subjectColor: $0.subjectColor,
          content: $0.content,
          memo: $0.memo,
          dayBand: $0.dayBand
        )
      }
  }

  static func reviews(for dateKey: String, data: AppData) -> [HomeReviewCard] {
    struct Due {
      var record: StudyRecord
      var intervalDays: Int
    }

    var due: [Due] = []
    for record in ICloudMerge.activeRecords(data.records) {
      let cycle = record.cycle.isEmpty ? ReviewIntervals.days : record.cycle
      for interval in cycle {
        if DateKeys.addDays(record.studiedOn, interval) == dateKey {
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
      let names = Array(Set(items.map(\.record.subjectName)))
      let colors = items.compactMap(\.record.subjectColor)
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
