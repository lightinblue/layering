/**
 * Live-parse a leading subject name from free text.
 * Longest matching subject wins. No match → subject null (caller must pick).
 */

export type SubjectPrefixMatch = {
  /** Matched subject name, or null when no leading match. */
  subject: string | null;
  /** Title with matched prefix stripped (trimmed). Full text when no match. */
  title: string;
};

export function matchSubjectPrefix(
  raw: string,
  subjectNames: readonly string[],
): SubjectPrefixMatch {
  const text = raw.replace(/^\s+/, '');
  if (!text || subjectNames.length === 0) {
    return { subject: null, title: text };
  }

  const names = [...subjectNames].sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (!name) continue;
    if (!text.startsWith(name)) continue;
    const after = text.slice(name.length);
    return {
      subject: name,
      title: after.replace(/^\s+/, ''),
    };
  }

  return { subject: null, title: text };
}

/**
 * Resolve subject + title for save.
 * Prefers live prefix match; else requires an explicit selected subject.
 * Never defaults to the first subject.
 */
export function resolveSubjectAndTitle(
  raw: string,
  subjectNames: readonly string[],
  selectedSubject?: string | null,
): { subject: string; title: string } | null {
  if (subjectNames.length === 0) return null;
  const match = matchSubjectPrefix(raw, subjectNames);
  const title = match.title.trim();
  if (!title) return null;

  if (match.subject) {
    return { subject: match.subject, title };
  }

  const picked =
    selectedSubject && subjectNames.includes(selectedSubject)
      ? selectedSubject
      : null;
  if (!picked) return null;
  return { subject: picked, title };
}
