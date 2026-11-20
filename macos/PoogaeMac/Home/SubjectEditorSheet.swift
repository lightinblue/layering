import SwiftUI

/// Add or edit a subject chip (name ≤4 + color).
struct SubjectEditorSheet: View {
  @ObservedObject var model: AppModel
  let presentation: SubjectEditorPresentation
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.dismiss) private var dismiss

  @State private var name: String = ""
  @State private var color: String = AppMutations.subjectColorOptions[4]
  @State private var errorMessage: String?

  private var isEditing: Bool { presentation.editingSubjectId != nil }

  private var canSave: Bool {
    AppMutations.normalizeSubjectName(name) != nil
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text(isEditing ? "과목 수정" : "과목 추가")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(PoogaeTheme.ink(colorScheme))
        Spacer()
        Button("닫기") {
          withAnimation(PoogaeMotion.quick) { dismiss() }
        }
        .buttonStyle(.plain)
        .foregroundStyle(PoogaeTheme.section(colorScheme))
      }

      VStack(alignment: .leading, spacing: 8) {
        Text("이름 (최대 \(AppMutations.maxSubjectNameLength)자)")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(PoogaeTheme.section(colorScheme))
        TextField("예: 전공", text: $name)
          .textFieldStyle(.plain)
          .padding(.horizontal, 12)
          .padding(.vertical, 10)
          .background(PoogaeTheme.surface(colorScheme))
          .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
          .onChange(of: name) { _, value in
            if value.count > AppMutations.maxSubjectNameLength {
              name = String(value.prefix(AppMutations.maxSubjectNameLength))
            }
            errorMessage = nil
          }
      }

      VStack(alignment: .leading, spacing: 8) {
        Text("색")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(PoogaeTheme.section(colorScheme))
        HStack(spacing: 8) {
          ForEach(AppMutations.subjectColorOptions, id: \.self) { hex in
            Button {
              withAnimation(PoogaeMotion.quick) { color = hex }
            } label: {
              Circle()
                .fill(Color(hexString: hex, fallback: PoogaeTheme.brand))
                .frame(width: 22, height: 22)
                .overlay(
                  Circle()
                    .strokeBorder(.white.opacity(color == hex ? 0.95 : 0), lineWidth: 2)
                )
                .overlay(
                  Circle()
                    .strokeBorder(PoogaeTheme.ink(colorScheme).opacity(color == hex ? 0.35 : 0), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
          }
        }
      }

      if let errorMessage {
        Text(errorMessage)
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(Color(hex: 0xE25555))
          .transition(.opacity)
      }

      Spacer(minLength: 0)

      HStack(spacing: 10) {
        if let subjectId = presentation.editingSubjectId {
          Button(role: .destructive) {
            model.deleteSubject(id: subjectId)
          } label: {
            Text("삭제")
              .font(.system(size: 13, weight: .semibold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 10)
              .foregroundStyle(Color(hex: 0xE25555))
              .background(PoogaeTheme.surface(colorScheme))
              .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
          }
          .buttonStyle(.plain)
        }

        Button {
          if let failure = model.saveSubject(
            name: name,
            color: color,
            editingSubjectId: presentation.editingSubjectId
          ) {
            withAnimation(PoogaeMotion.quick) {
              errorMessage = failureMessage(failure)
            }
          }
        } label: {
          Text("저장")
            .font(.system(size: 13, weight: .semibold))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .foregroundStyle(.white)
            .background(canSave ? PoogaeTheme.brand : PoogaeTheme.muted(colorScheme).opacity(0.45))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!canSave)
      }
    }
    .padding(20)
    .frame(width: 360, height: 280)
    .background(PoogaeTheme.canvas(colorScheme))
    .onAppear {
      if let id = presentation.editingSubjectId, let subject = model.subject(id: id) {
        name = subject.name
        color = subject.color ?? AppMutations.subjectColorOptions[4]
      }
    }
  }

  private func failureMessage(_ failure: AppMutations.SubjectFailure) -> String {
    switch failure {
    case .empty: return "이름을 입력해 주세요"
    case .tooLong: return "이름은 \(AppMutations.maxSubjectNameLength)자까지예요"
    case .duplicate: return "같은 이름 과목이 있어요"
    case .limit: return "과목은 \(AppMutations.maxSubjects)개까지예요"
    case .missing: return "과목을 찾을 수 없어요"
    }
  }
}
