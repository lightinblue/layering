import { describe, expect, it } from 'vitest';

import {
  matchSubjectPrefix,
  resolveSubjectAndTitle,
} from '@/utils/parse-subject-prefix';

const SUBJECTS = ['전공', '교육학', '정검'] as const;

describe('matchSubjectPrefix', () => {
  it('matches the longest leading subject name', () => {
    expect(matchSubjectPrefix('교육학 1단원', SUBJECTS)).toEqual({
      subject: '교육학',
      title: '1단원',
    });
  });

  it('matches without a space after the subject', () => {
    expect(matchSubjectPrefix('전공1-3단원', SUBJECTS)).toEqual({
      subject: '전공',
      title: '1-3단원',
    });
  });

  it('returns null subject when nothing matches', () => {
    expect(matchSubjectPrefix('미분적분', SUBJECTS)).toEqual({
      subject: null,
      title: '미분적분',
    });
  });
});

describe('resolveSubjectAndTitle', () => {
  it('strips a matched prefix on save', () => {
    expect(resolveSubjectAndTitle('전공 p.22', SUBJECTS)).toEqual({
      subject: '전공',
      title: 'p.22',
    });
  });

  it('falls back to the first subject with full text', () => {
    expect(resolveSubjectAndTitle('복습하기', SUBJECTS)).toEqual({
      subject: '전공',
      title: '복습하기',
    });
  });

  it('rejects empty title after strip', () => {
    expect(resolveSubjectAndTitle('전공', SUBJECTS)).toBeNull();
    expect(resolveSubjectAndTitle('전공   ', SUBJECTS)).toBeNull();
  });
});
