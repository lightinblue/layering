/**
 * Live-parse a leading subject name from free text.
 * Longest matching subject wins. No match → subject null (caller uses first).
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

/** Resolve subject + title for save (no match → first subject, full text). */
export function resolveSubjectAndTitle(
  raw: string,
  subjectNames: readonly string[],
): { subject: string; title: string } | null {
  if (subjectNames.length === 0) return null;
  const match = matchSubjectPrefix(raw, subjectNames);
  const subject = match.subject ?? subjectNames[0]!;
  const title = (match.subject ? match.title : match.title).trim();
  if (!title) return null;
  return { subject, title };
}
