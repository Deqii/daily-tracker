import { describe, expect, it } from 'vitest';
import {
  buildTaskVariants,
  emptyTaskFormDraft,
  isVariantDraftFilled,
  taskToFormDraft,
  validateTaskForm,
  type TaskFormDraft,
  type TaskVariantDraft,
} from './task-form';
import type { Task } from './types';

function card(
  tier: TaskVariantDraft['tier'],
  description: string,
  points: string
): TaskVariantDraft {
  return { tier, description, points };
}

function draft(overrides: Partial<TaskFormDraft> = {}): TaskFormDraft {
  return { ...emptyTaskFormDraft(), ...overrides };
}

function task(): Task {
  return {
    id: 'push0001',
    familyName: 'Push up routine',
    stat: 'STR',
    isAnchor: false,
    variants: [
      { tier: 'ringan', description: '10x2 set', points: 5 },
      { tier: 'berat', description: '30x4 set', points: 15 },
    ],
    createdAt: '2026-10-01T08:00:00+07:00',
  };
}

describe('emptyTaskFormDraft', () => {
  it('starts blank with one card per tier in fixed order', () => {
    const form = emptyTaskFormDraft();

    expect(form).toEqual({
      familyName: '',
      stat: 'STR',
      isAnchor: false,
      variants: [
        { tier: 'ringan', description: '', points: '' },
        { tier: 'sedang', description: '', points: '' },
        { tier: 'berat', description: '', points: '' },
      ],
    });
  });
});

describe('taskToFormDraft', () => {
  it('fills the matching cards and leaves missing tiers empty', () => {
    const form = taskToFormDraft(task());

    expect(form.familyName).toBe('Push up routine');
    expect(form.stat).toBe('STR');
    expect(form.isAnchor).toBe(false);
    expect(form.variants).toEqual([
      { tier: 'ringan', description: '10x2 set', points: '5' },
      { tier: 'sedang', description: '', points: '' },
      { tier: 'berat', description: '30x4 set', points: '15' },
    ]);
  });

  it('round-trips a valid draft back to variants', () => {
    expect(buildTaskVariants(taskToFormDraft(task()))).toEqual(task().variants);
  });
});

describe('isVariantDraftFilled', () => {
  it('is false only when both fields are blank', () => {
    expect(isVariantDraftFilled(card('ringan', '', ''))).toBe(false);
    expect(isVariantDraftFilled(card('ringan', '   ', ''))).toBe(false);
    expect(isVariantDraftFilled(card('ringan', 'run', ''))).toBe(true);
    expect(isVariantDraftFilled(card('ringan', '', '5'))).toBe(true);
  });
});

describe('validateTaskForm', () => {
  it('reports no variant when every card is empty', () => {
    const errors = validateTaskForm(draft({ familyName: 'Push up' }), 'E');

    expect(errors.noVariant).toBe(true);
    expect(errors.valid).toBe(false);
  });

  it('requires the task name', () => {
    const form = draft({ variants: [card('ringan', '10x2 set', '5')] });

    expect(validateTaskForm(form, 'E').familyName).toBe(true);
    expect(validateTaskForm(form, 'E').valid).toBe(false);
  });

  it('ignores a fully empty card next to a filled one', () => {
    const form = draft({
      familyName: 'Push up',
      variants: [card('ringan', '10x2 set', '5'), card('sedang', '', ''), card('berat', '', '')],
    });

    expect(validateTaskForm(form, 'E')).toEqual({
      familyName: false,
      variants: [
        { description: false, points: null, overCap: null },
        { description: false, points: null, overCap: null },
        { description: false, points: null, overCap: null },
      ],
      noVariant: false,
      valid: true,
    });
  });

  it('asks for points when a card has a description but no value', () => {
    const form = draft({ familyName: 'Push up', variants: [card('ringan', '10x2 set', '')] });

    expect(validateTaskForm(form, 'E').variants[0]).toEqual({
      description: false,
      points: 'MISSING',
      overCap: null,
    });
    expect(validateTaskForm(form, 'E').valid).toBe(false);
  });

  it('asks what to do when a card has points but no description', () => {
    const form = draft({ familyName: 'Push up', variants: [card('ringan', '', '5')] });

    expect(validateTaskForm(form, 'E').variants[0]).toEqual({
      description: true,
      points: null,
      overCap: null,
    });
    expect(validateTaskForm(form, 'E').valid).toBe(false);
  });

  it('rejects points that are not a whole number of 1 or more', () => {
    for (const points of ['0', '-2', '1.5', 'abc']) {
      const form = draft({ familyName: 'Push up', variants: [card('ringan', '10x2 set', points)] });

      expect(validateTaskForm(form, 'E').variants[0]?.points).toBe('INVALID');
      expect(validateTaskForm(form, 'E').variants[0]?.overCap).toBeNull();
      expect(validateTaskForm(form, 'E').valid).toBe(false);
    }
  });

  it('accepts points exactly at the rank cap', () => {
    const form = draft({ familyName: 'Push up', variants: [card('ringan', '10x2 set', '15')] });

    expect(validateTaskForm(form, 'E').variants[0]?.overCap).toBeNull();
    expect(validateTaskForm(form, 'E').valid).toBe(true);
  });

  it('rejects points above the cap and reports the cap', () => {
    const form = draft({ familyName: 'Push up', variants: [card('ringan', '10x2 set', '16')] });

    expect(validateTaskForm(form, 'E').variants[0]).toEqual({
      description: false,
      points: null,
      overCap: 15,
    });
    expect(validateTaskForm(form, 'E').valid).toBe(false);
  });

  it('uses the cap of the rank it is given', () => {
    const form = draft({ familyName: 'Push up', variants: [card('ringan', '10x2 set', '40')] });

    expect(validateTaskForm(form, 'D').variants[0]?.overCap).toBe(25);
    expect(validateTaskForm(form, 'C').variants[0]?.overCap).toBeNull();
    expect(validateTaskForm(form, 'C').valid).toBe(true);
  });

  it('treats rank S as uncapped', () => {
    const form = draft({ familyName: 'Push up', variants: [card('ringan', '10x2 set', '1000')] });

    expect(validateTaskForm(form, 'S').variants[0]?.overCap).toBeNull();
    expect(validateTaskForm(form, 'S').valid).toBe(true);
  });

  it('accepts a complete single-tier task', () => {
    const form = draft({ familyName: 'Push up', variants: [card('ringan', '10x2 set', '5')] });

    expect(validateTaskForm(form, 'E').valid).toBe(true);
  });

  it('accepts a complete family and trims whitespace', () => {
    const form = draft({
      familyName: '  Push up routine  ',
      variants: [card('ringan', ' 10x2 set ', ' 5 '), card('berat', ' 30x4 set ', ' 15 ')],
    });

    expect(validateTaskForm(form, 'E').valid).toBe(true);
    expect(buildTaskVariants(form)).toEqual([
      { tier: 'ringan', description: '10x2 set', points: 5 },
      { tier: 'berat', description: '30x4 set', points: 15 },
    ]);
  });
});

describe('buildTaskVariants', () => {
  it('keeps only the filled cards in tier order', () => {
    const form = draft({
      familyName: 'Push up',
      variants: [
        card('ringan', '', ''),
        card('sedang', '20x3 set', '9'),
        card('berat', '30x4', '15'),
      ],
    });

    expect(buildTaskVariants(form)).toEqual([
      { tier: 'sedang', description: '20x3 set', points: 9 },
      { tier: 'berat', description: '30x4', points: 15 },
    ]);
  });
});
