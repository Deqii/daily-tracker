import { describe, expect, it } from 'vitest';
import {
  buildRewardFromDraft,
  emptyRewardFormDraft,
  rewardToFormDraft,
  validateRewardForm,
  type RewardFormDraft,
} from './reward-form';
import type { Reward } from './types';

function draft(overrides: Partial<RewardFormDraft> = {}): RewardFormDraft {
  return { ...emptyRewardFormDraft(), ...overrides };
}

function reward(): Reward {
  return {
    id: 'rew00001',
    title: 'Kopi susu santai',
    cost: 35,
    createdAt: '2026-10-01T08:00:00+07:00',
  };
}

describe('emptyRewardFormDraft', () => {
  it('starts blank', () => {
    expect(emptyRewardFormDraft()).toEqual({ title: '', cost: '' });
  });
});

describe('rewardToFormDraft', () => {
  it('fills the title and cost as raw input', () => {
    expect(rewardToFormDraft(reward())).toEqual({ title: 'Kopi susu santai', cost: '35' });
  });

  it('round-trips a valid draft back to title and cost', () => {
    const fromDraft = buildRewardFromDraft(rewardToFormDraft(reward()));

    expect(fromDraft).toEqual({ title: reward().title, cost: reward().cost });
  });
});

describe('validateRewardForm', () => {
  it('requires the reward name', () => {
    const form = draft({ cost: '35' });

    expect(validateRewardForm(form).title).toBe(true);
    expect(validateRewardForm(form).valid).toBe(false);
  });

  it('rejects a cost that is not a whole number of 1 or more', () => {
    for (const cost of ['', '0', '-5', '1.5', 'abc']) {
      const form = draft({ title: 'Kopi susu', cost });

      expect(validateRewardForm(form).cost).toBe(true);
      expect(validateRewardForm(form).valid).toBe(false);
    }
  });

  it('accepts a 1-point reward', () => {
    const form = draft({ title: 'Teh', cost: '1' });

    expect(validateRewardForm(form)).toEqual({ title: false, cost: false, valid: true });
  });

  it('accepts a complete reward and trims whitespace', () => {
    const form = draft({ title: '  Kopi susu santai  ', cost: ' 35 ' });

    expect(validateRewardForm(form).valid).toBe(true);
    expect(buildRewardFromDraft(form)).toEqual({ title: 'Kopi susu santai', cost: 35 });
  });
});
