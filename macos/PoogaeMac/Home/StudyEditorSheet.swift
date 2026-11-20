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
    VStack(alignment: .leading, spacing: 18) {
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
            // Drop at end
            Color.clear
              .frame(width: 12, height: 28)
              .dropDestination(for: String.self) { items, _ in
                guard let id = items.first else { return false }
                model.moveSubject(draggedId: id, beforeId: nil)
                return true
              }
          }
          .animation(PoogaeMotion.settle, value: model.subjects.map(\.id))
        }
        Text("드래그해서 순서 변경")
          .font(.system(size: 10, weight: .regular))
          .foregroundStyle(PoogaeTheme.muted(colorScheme))
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

        Button {
          guard let subjectId = selectedSubjectId else { return }
          model.saveStudy(
            subjectId: subjectId,
            content: title,
            memo: memo,
            editingStudyId: presentation.editingStudyId
          )
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
    }
    .padding(22)
    .frame(width: 440, height: 380)
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

  private func subjectChip(_ subject: SubjectChip) -> some View {
    let selected = subject.id == selectedSubjectId
    let fill = SubjectChipStyle.fill(hex: subject.color)
    let border = SubjectChipStyle.border(hex: subject.color)
    return Text(subject.name)
      .font(.system(size: 15, weight: .medium))
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
      .animation(PoogaeMotion.quick, value: selected)
      .contentShape(Rectangle())
      .onTapGesture {
        withAnimation(PoogaeMotion.quick) {
          selectedSubjectId = subject.id
        }
      }
      .draggable(subject.id) {
        Text(subject.name)
          .font(.system(size: 15, weight: .medium))
          .foregroundStyle(.white)
          .padding(.horizontal, SubjectChipStyle.horizontalPadding)
          .frame(minHeight: SubjectChipStyle.minHeight)
          .background(fill)
          .clipShape(RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous))
          .overlay(
            RoundedRectangle(cornerRadius: SubjectChipStyle.cornerRadius, style: .continuous)
              .strokeBorder(border, lineWidth: SubjectChipStyle.borderWidth)
          )
          .opacity(0.98)
      }
      .dropDestination(for: String.self) { items, _ in
        guard let id = items.first, id != subject.id else { return false }
        model.moveSubject(draggedId: id, beforeId: subject.id)
        return true
      }
      .contextMenu {
        Button("수정") { model.openEditSubject(subject) }
        Button("삭제", role: .destructive) { model.deleteSubject(id: subject.id) }
      }
      .help("드래그해서 순서 변경 · 클릭해서 선택")
  }
}
