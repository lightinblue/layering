import SwiftUI

/// Navigated depth — not always on home.
struct CalendarView: View {
  @ObservedObject var model: AppModel
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.dismiss) private var dismiss

  @State private var monthAnchor: Date = Date()

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      HStack {
        Button {
          withAnimation(PoogaeMotion.settle) {
            shiftMonth(-1)
          }
        } label: {
          Image(systemName: "chevron.left")
        }
        .buttonStyle(.borderless)

        Text(monthTitle)
          .font(.system(size: 18, weight: .semibold))
          .foregroundStyle(PoogaeTheme.ink(colorScheme))
          .frame(maxWidth: .infinity)

        Button {
          withAnimation(PoogaeMotion.settle) {
            shiftMonth(1)
          }
        } label: {
          Image(systemName: "chevron.right")
        }
        .buttonStyle(.borderless)
      }

      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 8) {
        ForEach(weekdayLabels, id: \.self) { label in
          Text(label)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(PoogaeTheme.muted(colorScheme))
            .frame(maxWidth: .infinity)
        }
        ForEach(daysInMonth, id: \.self) { day in
          dayCell(day)
        }
      }

      Spacer(minLength: 0)
    }
    .padding(28)
    .background(PoogaeTheme.canvas(colorScheme).ignoresSafeArea())
    .navigationTitle("캘린더")
    .toolbar {
      ToolbarItem(placement: .cancellationAction) {
        Button("홈") {
          withAnimation(PoogaeMotion.panel) {
            dismiss()
          }
        }
      }
    }
  }

  private var monthTitle: String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "ko_KR")
    f.dateFormat = "yyyy년 M월"
    return f.string(from: monthAnchor)
  }

  private var weekdayLabels: [String] {
    ["일", "월", "화", "수", "목", "금", "토"]
  }

  private var daysInMonth: [Date?] {
    let cal = Calendar.current
    guard let range = cal.range(of: .day, in: .month, for: monthAnchor),
          let first = cal.date(from: cal.dateComponents([.year, .month], from: monthAnchor))
    else { return [] }
    let pad = cal.component(.weekday, from: first) - 1
    var cells: [Date?] = Array(repeating: nil, count: pad)
    for day in range {
      if let date = cal.date(byAdding: .day, value: day - 1, to: first) {
        cells.append(date)
      }
    }
    while cells.count % 7 != 0 { cells.append(nil) }
    return cells
  }

  @ViewBuilder
  private func dayCell(_ date: Date?) -> some View {
    if let date {
      let key = DateKeys.toKey(date)
      let selected = key == model.selectedDateKey
      let isToday = key == model.todayKey
      Button {
        withAnimation(PoogaeMotion.quick) {
          model.selectedDateKey = key
        }
        withAnimation(PoogaeMotion.panel) {
          dismiss()
        }
      } label: {
        Text("\(Calendar.current.component(.day, from: date))")
          .font(.system(size: 14, weight: selected ? .bold : .medium))
          .foregroundStyle(isToday ? PoogaeTheme.brand : PoogaeTheme.ink(colorScheme))
          .frame(maxWidth: .infinity, minHeight: 36)
          .background(
            selected
              ? PoogaeTheme.primarySoft(colorScheme)
              : Color.clear
          )
          .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
      }
      .buttonStyle(.plain)
    } else {
      Color.clear.frame(minHeight: 36)
    }
  }

  private func shiftMonth(_ delta: Int) {
    if let next = Calendar.current.date(byAdding: .month, value: delta, to: monthAnchor) {
      monthAnchor = next
    }
  }
}
