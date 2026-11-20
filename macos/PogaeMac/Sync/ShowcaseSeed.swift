import Foundation

/// In-memory ASC / screenshot demo (`POGAE_SHOT_SEED=1` only).
/// Never push to iCloud; never write UserDefaults — see `ICloudKvsStore.enterShotIsolation`.
enum ShowcaseSeed {
  /// All demo rows/subjects use this id prefix — recovery soft-deletes anything marked.
  static let idPrefix = "shot-"

  /// Mac ShowcaseSeed + iOS `screenshot-seed.ts` subject ids (defensive; prefix covers them).
  static let knownSubjectIds: Set<String> = [
    "shot-sub-korean", "shot-sub-class", "shot-sub-edu",
    "shot-sub-list", "shot-sub-path", "shot-sub-media",
  ]

  /// Demo study titles from Mac ShowcaseSeed + phone screenshot seed (folded match).
  /// Used only together with seed subject / prefix heuristics — never alone on 교육학/점검/기타.
  static let knownDemoContents: Set<String> = Set(
    [
      "1단원 문학 필기", "DDC 000대 정리", "1단원 교육과정", "DDC 연습 문제",
      "문법 핵심 정리", "교육심리 용어", "KDC 표 암기", "현대시 기출 요약",
      "1단원 핵심 정리", "교육과정 개론", "DDC 600대 연습", "생활지도 사례",
      "고전 산문 요약", "분류 기출 20문항",
      "목록규칙 필기", "사서직 기출 요약", "시청각 자료 정리", "MARC 필드 복습",
      "분류 체계 총정리", "목록 평가 정리", "핵심 도식 암기", "도서관법 요약", "모의고사 해설",
    ].map { ICloudMerge.foldedText($0) }
  )

  static func isSeedId(_ id: String) -> Bool {
    id.hasPrefix(idPrefix) || knownSubjectIds.contains(id)
  }

  static func make(today: String = DateKeys.todayKey(), now: Date = Date()) -> AppData {
    let at = ISO8601DateFormatter.fractional.string(from: now)
    // First-run style chips (≤4 chars), aligned with iOS home-mock / screenshot flavor.
    let korean = SubjectChip(id: "shot-sub-korean", name: "국어", color: "#F65E83", order: 0, updatedAt: at)
    let classify = SubjectChip(id: "shot-sub-class", name: "분류", color: "#62B3F6", order: 1, updatedAt: at)
    let edu = SubjectChip(id: "shot-sub-edu", name: "교육학", color: "#B7A4E9", order: 2, updatedAt: at)

    var records: [StudyRecord] = []
    var order = 0

    func add(
      id: String,
      subject: SubjectChip,
      content: String,
      studiedOn: String,
      band: DayBandId,
      completedIntervals: [Int] = []
    ) {
      records.append(
        StudyRecord(
          id: id,
          subjectId: subject.id,
          subjectName: subject.name,
          subjectColor: subject.color,
          content: content,
          memo: nil,
          studiedOn: studiedOn,
          dayBand: band,
          dayOrder: order,
          cycle: ReviewIntervals.days,
          checks: checks(completed: Set(completedIntervals), at: at),
          createdAt: at,
          updatedAt: at
        )
      )
      order += 1
    }

    // Today — morning / afternoon / evening bands
    add(id: "shot-today-m1", subject: korean, content: "1단원 문학 필기", studiedOn: today, band: .morning)
    add(id: "shot-today-m2", subject: classify, content: "DDC 000대 정리", studiedOn: today, band: .morning)
    add(id: "shot-today-a1", subject: edu, content: "1단원 교육과정", studiedOn: today, band: .afternoon)
    add(id: "shot-today-a2", subject: classify, content: "DDC 연습 문제", studiedOn: today, band: .afternoon)
    add(id: "shot-today-a3", subject: korean, content: "문법 핵심 정리", studiedOn: today, band: .afternoon)
    add(id: "shot-today-e1", subject: edu, content: "교육심리 용어", studiedOn: today, band: .evening)
    add(id: "shot-today-e2", subject: classify, content: "KDC 표 암기", studiedOn: today, band: .evening)

    // Past → reviews due today (1 / 3 / 7). Some intervals marked done → checked cards.
    let d1 = DateKeys.addDays(today, -1)
    add(id: "shot-d1-a", subject: korean, content: "현대시 기출 요약", studiedOn: d1, band: .morning)
    add(id: "shot-d1-b", subject: classify, content: "1단원 핵심 정리", studiedOn: d1, band: .afternoon)
    add(id: "shot-d1-c", subject: edu, content: "교육과정 개론", studiedOn: d1, band: .evening)

    let d3 = DateKeys.addDays(today, -3)
    // 3일 전 card → checked (interval 3 done)
    add(
      id: "shot-d3-a",
      subject: classify,
      content: "DDC 600대 연습",
      studiedOn: d3,
      band: .afternoon,
      completedIntervals: [1, 3]
    )
    add(
      id: "shot-d3-b",
      subject: edu,
      content: "생활지도 사례",
      studiedOn: d3,
      band: .evening,
      completedIntervals: [1, 3]
    )

    let d7 = DateKeys.addDays(today, -7)
    add(
      id: "shot-d7-a",
      subject: korean,
      content: "고전 산문 요약",
      studiedOn: d7,
      band: .morning,
      completedIntervals: [1, 3]
    )
    add(
      id: "shot-d7-b",
      subject: classify,
      content: "분류 기출 20문항",
      studiedOn: d7,
      band: .afternoon,
      completedIntervals: [1, 3]
    )

    return AppData(subjects: [korean, classify, edu], records: records)
  }

  private static func checks(completed: Set<Int>, at: String) -> [String: ReviewCheck] {
    var out: [String: ReviewCheck] = [:]
    for interval in ReviewIntervals.days {
      out[String(interval)] = ReviewCheck(done: completed.contains(interval), updatedAt: at)
    }
    return out
  }
}
