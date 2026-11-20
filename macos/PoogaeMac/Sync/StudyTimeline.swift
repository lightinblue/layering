import Foundation

/// Port of iOS `constants/study-timeline.ts` + `utils/study-timeline.ts`.
enum StudyTimeline {
  /// Hard cap on filled study records per studiedOn date (4+6+4).
  static let maxStudiesPerDay = 14

  struct BandDef: Hashable {
    var id: DayBandId
    var labelStart: String
    var labelEnd: String
    /// Hard fill cap (4 / 6 / 4).
    var emptySlots: Int
    /// Display height padding (~3 / 4 / 3).
    var visualPad: Int
    var addLabel: String
  }

  static let bands: [BandDef] = [
    BandDef(id: .morning, labelStart: "8", labelEnd: "12", emptySlots: 4, visualPad: 3, addLabel: "오전 공부"),
    BandDef(id: .afternoon, labelStart: "12", labelEnd: "18", emptySlots: 6, visualPad: 4, addLabel: "오후 공부"),
    BandDef(id: .evening, labelStart: "18", labelEnd: "24", emptySlots: 4, visualPad: 3, addLabel: "밤 공부"),
  ]

  enum Slot: Identifiable, Hashable {
    case study(HomeStudyRow)

    var id: String {
      switch self {
      case .study(let row): return row.id
      }
    }
  }

  struct BandView: Identifiable, Hashable {
    var id: DayBandId
    var labelStart: String
    var labelEnd: String
    var slots: [Slot]
    var showAdd: Bool
    /// Display height in slot units (~3/4/3 pad).
    var addSpan: Int
    var addLabel: String
  }

  static func buildBands(studies: [HomeStudyRow]) -> [BandView] {
    var assigned: [DayBandId: [HomeStudyRow]] = [
      .morning: [], .afternoon: [], .evening: [],
    ]
    var unassigned: [HomeStudyRow] = []

    for row in studies {
      if let band = row.dayBand {
        assigned[band, default: []].append(row)
      } else {
        unassigned.append(row)
      }
    }

    var queue = unassigned
    var buckets: [[HomeStudyRow]] = bands.map { band in
      var filled = assigned[band.id] ?? []
      while filled.count < band.emptySlots, !queue.isEmpty {
        filled.append(queue.removeFirst())
      }
      return filled
    }
    if !queue.isEmpty {
      buckets[buckets.count - 1].append(contentsOf: queue)
    }

    return bands.enumerated().map { index, band in
      let filled = buckets[index]
      let slots = filled.map { Slot.study($0) }
      let hardSpare = max(0, band.emptySlots - filled.count)
      let visualSpare = max(0, band.visualPad - filled.count)
      return BandView(
        id: band.id,
        labelStart: band.labelStart,
        labelEnd: band.labelEnd,
        slots: slots,
        showAdd: hardSpare > 0 || band.id == .evening,
        addSpan: max(1, visualSpare),
        addLabel: band.addLabel
      )
    }
  }

  static func count(in data: AppData, dateKey: String, band: DayBandId) -> Int {
    ICloudMerge.activeRecords(data.records)
      .filter { $0.studiedOn == dateKey && $0.dayBand == band }
      .count
  }
}
