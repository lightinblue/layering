import SwiftUI

/// Add or edit a study: subject chips + title + optional memo.
struct StudyEditorSheet: View {
  @ObservedObject var model: AppModel
  let presentation: StudyEditorPresentation
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.dismiss) private var dismiss

  @State private var selectedSubjectId: String?
  @State private var title: String = ""
  @State private var memo: String = ""

  private var isEditing: Bool { presentation.editingStudyId != nil }

  private var canSave: Bool {
    guard selectedSubjectId != nil else { return false }
    let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return false }
    if isEditing { return true }
    return model.canAddStudy
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Text(isEditing ? "기록 수정" : "기록 추가")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(PoogaeTheme.ink(colorScheme))
        Spacer()
        Button("닫기") {
          withAnimation(PoogaeMotion.quick) { dismiss() }
        }
        .buttonStyle(.plain)
        .foregroundStyle(PoogaeTheme.section(colorScheme))
      }
      .padding(.horizontal, 22)
      .padding(.top, 22)
      .padding(.bottom, 14)

      ScrollView(.vertical, showsIndicators: true) {
        VStack(alignment: .leading, spacing: 18) {
          VStack(alignment: .leading, spacing: 8) {
            HStack {
              Text("과목")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(PoogaeTheme.section(colorScheme))
              Spacer()
              if model.canAddSubject {
                Button {
                  model.openAddSubject()
                } label: {
                  Label("과목 추가", systemImage: "plus")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(PoogaeTheme.brand)
                }
                .buttonStyle(.plain)
              }
            }

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
            TextField(
              "",
              text: $title,
              prompt: Text("1-3단원 / p. 22-36")
                .foregroundStyle(PoogaeTheme.placeholder(colorScheme))
            )
            .textFieldStyle(.plain)
            .font(.system(size: 15, weight: .medium))
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(PoogaeTheme.surface(colorScheme))
            .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))
            .onSubmit(saveIfPossible)
            .onChange(of: title) { _, value in
              if value.count > AppMutations.maxTitleLength {
                title = String(value.prefix(AppMutations.maxTitleLength))
              }
            }
          }

          VStack(alignment: .leading, spacing: 8) {
            Text("메모")
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(PoogaeTheme.section(colorScheme))
            TextField(
              "",
              text: $memo,
              prompt: Text("추가로 기록하고 싶은 내용")
                .foregroundStyle(PoogaeTheme.placeholder(colorScheme)),
              axis: .vertical
            )
            .textFieldStyle(.plain)
            .font(.system(size: 15, weight: .medium))
            .lineLimit(2...4)
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .frame(minHeight: 88, alignment: .topLeading)
            .background(PoogaeTheme.surface(colorScheme))
            .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))
            // Plain Enter saves; Shift+Enter keeps a newline in the memo.
            .onKeyPress(keys: [.return]) { press in
              if press.modifiers.contains(.shift) {
                return .ignored
              }
              saveIfPossible()
              return .handled
            }
            .onChange(of: memo) { _, value in
              if value.count > AppMutations.maxMemoLength {
                memo = String(value.prefix(AppMutations.maxMemoLength))
              }
            }
          }

          HStack(spacing: 10) {
            if let studyId = presentation.editingStudyId {
              Button(role: .destructive) {
                model.deleteStudy(id: studyId)
              } label: {
                Text("삭제")
                  .font(.system(size: 14, weight: .semibold))
                  .frame(maxWidth: .infinity)
                  .padding(.vertical, 11)
                  .foregroundStyle(Color(hex: 0xE25555))
                  .background(PoogaeTheme.surface(colorScheme))
                  .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
              }
              .buttonStyle(.plain)
            }

            Button(action: saveIfPossible) {
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
            .keyboardShortcut(.defaultAction)
          }
          .padding(.top, 4)
          .padding(.bottom, 8)
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 16)
      }
    }
    .frame(width: 440, height: 420)
    .background(PoogaeTheme.canvas(colorScheme))
    .onAppear(perform: hydrate)
    .onChange(of: model.subjects.map(\.id)) { _, ids in
      if selectedSubjectId == nil || !(ids.contains(selectedSubjectId ?? "")) {
        selectedSubjectId = ids.first
      }
    }
    .sheet(item: $model.subjectEditor) { subjectPresentation in
      SubjectEditorSheet(model: model, presentation: subjectPresentation)
        .transition(.opacity.combined(with: .scale(scale: 0.98)))
    }
  }

  private func hydrate() {
    if let studyId = presentation.editingStudyId, let record = model.studyRecord(id: studyId) {
      selectedSubjectId = record.subjectId
      title = record.content
      memo = record.memo ?? ""
    } else if selectedSubjectId == nil {
      selectedSubjectId = model.subjects.first?.id
    }
  }

  private func saveIfPossible() {
    guard canSave, let subjectId = selectedSubjectId else { return }
    model.saveStudy(
      subjectId: subjectId,
      content: title,
      memo: memo,
      editingStudyId: presentation.editingStudyId
    )
  }

  private func subjectChip(_ subject: SubjectChip) -> some View {
    let selected = subject.id == selectedSubjectId
    let fill = SubjectChipStyle.fill(hex: subject.color)
    let border = SubjectChipStyle.border(hex: subject.color)
    return Button {
      withAnimation(PoogaeMotion.quick) {
        selectedSubjectId = subject.id
      }
    } label: {
      Text(subject.name)
        .font(.system(size: SubjectChipStyle.fontSize, weight: .medium))
        .foregroundStyle(.white)
        .padding(.horizontal, SubjectChipStyle.horizontalPadding)
        .frame(minHeight: SubjectChipStyle.minHeight)
        .background(fill)
        .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))
        .overlay(
          RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous)
            .strokeBorder(border, lineWidth: SubjectChipStyle.borderWidth)
        )
        .opacity(selected ? SubjectChipStyle.selectedOpacity : SubjectChipStyle.idleOpacity)
    }
    .buttonStyle(.plain)
    .animation(PoogaeMotion.quick, value: selected)
    .contextMenu {
      Button("수정") { model.openEditSubject(subject) }
      Button("삭제", role: .destructive) { model.deleteSubject(id: subject.id) }
    }
    .help("클릭해서 선택")
  }
}
