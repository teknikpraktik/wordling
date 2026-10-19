import { describe, expect, it } from 'vitest';
import { editDistance, gradeAnswer, isSubstantialChange, normalize } from './normalize';

describe('normalize', () => {
  it('ignores case, outer whitespace and repeated spaces', () => {
    expect(normalize('  Ice   CREAM ')).toBe('ice cream');
  });
  it('unifies apostrophes and drops trailing punctuation', () => {
    expect(normalize('It’s fine.')).toBe("it's fine");
  });
});

describe('gradeAnswer', () => {
  it('accepts exact answers regardless of case/spacing', () => {
    expect(gradeAnswer('  BUTTERFLY ', ['butterfly']).verdict).toBe('correct');
  });
  it('accepts registered alternative translations', () => {
    const g = gradeAnswer('hound', ['dog', 'hound']);
    expect(g.verdict).toBe('correct');
    expect(g.expected).toBe('hound');
  });
  it('requires correct spelling: a typo is not correct', () => {
    expect(gradeAnswer('buterfly', ['butterfly']).verdict).toBe('typo');
    expect(gradeAnswer('buterfly', ['butterfly']).expected).toBe('butterfly');
  });
  it('treats a transposition as a single typo', () => {
    expect(gradeAnswer('frist', ['first']).verdict).toBe('typo');
  });
  it('does not call short unrelated words typos', () => {
    expect(gradeAnswer('car', ['cat']).verdict).toBe('wrong');
    expect(gradeAnswer('dig', ['dog']).verdict).toBe('wrong');
  });
  it('marks completely different answers wrong and shows the primary answer', () => {
    const g = gradeAnswer('flower', ['butterfly', 'moth']);
    expect(g.verdict).toBe('wrong');
    expect(g.expected).toBe('butterfly');
  });
  it('reports empty input', () => {
    expect(gradeAnswer('   ', ['dog']).verdict).toBe('empty');
  });
  it('accepts a leading "to"/"a" either way, but not misspellings', () => {
    expect(gradeAnswer('run', ['to run']).verdict).toBe('correct');
    expect(gradeAnswer('to run', ['run']).verdict).toBe('correct');
    expect(gradeAnswer('to rum', ['run']).verdict).toBe('wrong');
  });
});

describe('editDistance', () => {
  it('computes Damerau distance', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('ab', 'ba')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('isSubstantialChange', () => {
  it('ignores casing and whitespace', () => {
    expect(isSubstantialChange('Dog', ' dog ')).toBe(false);
  });
  it('treats a spelling fix as non-substantial', () => {
    expect(isSubstantialChange('buterfly', 'butterfly')).toBe(false);
  });
  it('treats a different word as substantial', () => {
    expect(isSubstantialChange('dog', 'cat')).toBe(true);
    expect(isSubstantialChange('big', 'enormous')).toBe(true);
  });
});
