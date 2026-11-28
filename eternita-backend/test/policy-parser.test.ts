import { parsePolicy } from '../src/policy/parser';
import { describe, expect, it } from '@jest/globals';

const sample1 = `
protocol maria:
    may see existence of entries mentioning maria
    may read summary of entries tagged family
    may not read summary of entries tagged health
`;

const sample2 = `
protocol maria:
    release letter To my daughter to maria when date 2040-05-01

protocol juan:
    transfer custody to juan
`;

const sample3 = `
protocol maria:
    may read summary of entries tagged family
    may not read summary of entries tagged health

protocol juan:
    default writing mode lightfix
`;

const handoutPolicy = `
protocol maria:
    may see existence of entries mentioning maria
    may read summary of entries tagged family
    may not read summary of entries tagged health
    release letter To my daughter to maria when date 2040-05-01
    transfer custody to juan
    default writing mode verbatim
`;

describe('policy grammar', () => {
  it('accepts permission statements', () => {
    expect(() => parsePolicy(sample1)).not.toThrow();
  });

  it('accepts letter release and custody transfer statements', () => {
    expect(() => parsePolicy(sample2)).not.toThrow();
  });

  it('accepts permission and default writing mode statements', () => {
    expect(() => parsePolicy(sample3)).not.toThrow();
  });

  it('accepts the handout sample policy', () => {
    expect(() => parsePolicy(handoutPolicy)).not.toThrow();
  });

  it('rejects an empty policy', () => {
    expect(() => parsePolicy('')).toThrow();
  });

  it('rejects an empty protocol', () => {
    const invalidPolicy = `
protocol maria:
`;

    expect(() => parsePolicy(invalidPolicy)).toThrow();
  });

  it('rejects a duplicate protocol', () => {
    const invalidPolicy = `
protocol maria:
    may read summary of entries tagged family

protocol maria:
    may read summary of entries tagged health
`;

    expect(() => parsePolicy(invalidPolicy)).toThrow();
  });

  it('rejects a letter recipient that does not match the protocol', () => {
    const invalidPolicy = `
protocol maria:
    release letter To my daughter to juan when date 2040-05-01
`;

    expect(() => parsePolicy(invalidPolicy)).toThrow();
  });

  it('rejects a custody condition', () => {
    const invalidPolicy = `
protocol juan:
    transfer custody to juan if trusteeunavailable
`;

    expect(() => parsePolicy(invalidPolicy)).toThrow();
  });

  it('rejects an unsupported writing mode', () => {
    const invalidPolicy = `
protocol juan:
    default writing mode automatic
`;

    expect(() => parsePolicy(invalidPolicy)).toThrow();
  });
});
