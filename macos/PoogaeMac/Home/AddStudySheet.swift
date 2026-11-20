import SwiftUI

/// Subject chip + title + optional memo — matches iOS add intent.
struct AddStudySheet: View {
  @ObservedObject var model: AppModel
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.dismiss) private var dismiss

  @State private var selectedSubjectId: String?
  @State private var title: String = ""
  @State private var memo: String = ""

  private var canSave: Bool {
    guard selectedSubjectId != nil else { return false }
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    return !trimmed.isEmpty && model.canAddStudy
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        Text("기록 추가")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(PoogaeTheme.ink(colorScheme))
        Spacer()
        Button("닫기") {
          withAnimation(PoogaeMotion.quick) { dismiss() }
        }
        .buttonStyle(.plain)
        .foregroundStyle(PoogaeTheme.section(colorScheme))
      }

      VStack(alignment: .leading, spacing: 8) {
        Text("과목")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(PoogaeTheme.section(colorScheme))
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 8) {
            ForEach(model.subjects) { subject in
              subjectChip(subject)
            }
          }
        }
      }

      VStack(alignment: .leading, spacing: 8) {
        Text("학습 내용")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(PoogaeTheme.section(colorScheme))
        TextField("무엇을 공부했나요?", text: $title)
          .textFieldStyle(.plain)
          .padding(.horizontal, 12)
          .padding(.vertical, 10)
          .background(PoogaeTheme.surface(colorScheme))
          .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
          .onChange(of: title) { _, value in
            if value.count > AppMutations.maxTitleLength {
              title = String(value.prefix(AppMutations.maxTitleLength))
            }
          }
      }

      VStack(alignment: .leading, spacing: 8) {
        Text("메모 (선택)")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(PoogaeTheme.section(colorScheme))
        TextField("짧은 메모", text: $memo, axis: .vertical)
          .textFieldStyle(.plain)
          .lineLimit(2...3)
          .padding(.horizontal, 12)
          .padding(.vertical, 10)
          .background(PoogaeTheme.surface(colorScheme))
          .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
          .onChange(of: memo) { _, value in
            if value.count > AppMutations.maxMemoLength {
              memo = String(value.prefix(AppMutations.maxMemoLength))
            }
          }
      }

      Spacer(minLength: 0)

      Button {
        guard let subjectId = selectedSubjectId else { return }
        model.addStudy(subjectId: subjectId, content: title, memo: memo)
      } label: {
        Text("저장")
          .font(.system(size: 14, weight: .semibold))
          .frame(maxWidth: .infinity)
          .padding(.vertical, 11)
          .foregroundStyle(.white)
          .background(canSave ? PoogaeTheme.brand : PoogaeTheme.muted(colorScheme).opacity(0.45))
          .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
      }
      .buttonStyle(.plain)
      .disabled(!canSave)
    }
    .padding(22)
    .frame(width: 420, height: 360)
    .background(PoogaeTheme.canvas(colorScheme))
    .onAppear {
      if selectedSubjectId == nil {
        selectedSubjectId = model.subjects.first?.id
      }
    }
  }

  private func subjectChip(_ subject: SubjectChip) -> some View {
    let selected = subject.id == selectedSubjectId
    let fill = Color(hexString: subject.color ?? "", fallback: PoogaeTheme.brand)
    return Button {
      withAnimation(PoogaeMotion.quick) {
        selectedSubjectId = subject.id
      }
    } label: {
      Text(subject.name)
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(selected ? .white : PoogaeTheme.ink(colorScheme))
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(selected ? fill : PoogaeTheme.surface(colorScheme))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
          RoundedRectangle(cornerRadius: 10, style: .continuous)
            .strokeBorder(selected ? Color.clear : fill.opacity(0.35), lineWidth: 1)
        )
    }
    .buttonStyle(.plain)
  }
}
