import type { LocalDate, Stat, Task } from '../lib/types';
import { STATS } from '../lib/types';
import { fnv1a32, mulberry32 } from '../lib/random';

/** Quest-active stats: stats with at least one task, in the fixed order STR, VIT, INT, DISC, SOC. */
export function getQuestStats(tasks: readonly Task[]): Stat[] {
  const withTasks = new Set<Stat>();

  for (const task of tasks) {
    withTasks.add(task.stat);
  }

  return STATS.filter((stat) => withTasks.has(stat));
}

/**
 * One rotating-task pick per quest-active stat that has any rotating task, seeded by
 * `fnv1a32("${date}:${stat}")` into mulberry32 (PRD §7.3). Candidates are sorted by id and the
 * index is `floor(rand() × n)`, so the result is deterministic and independent of input order.
 * Anchors are never returned and a stat with no rotating task is absent.
 */
export function selectDailyTasks(
  tasks: readonly Task[],
  date: LocalDate
): Partial<Record<Stat, string>> {
  const rotatingByStat = new Map<Stat, Task[]>();

  for (const task of tasks) {
    if (task.isAnchor) {
      continue;
    }

    const list = rotatingByStat.get(task.stat) ?? [];
    list.push(task);
    rotatingByStat.set(task.stat, list);
  }

  const picks: Partial<Record<Stat, string>> = {};

  for (const stat of getQuestStats(tasks)) {
    const candidates = rotatingByStat.get(stat);

    if (candidates === undefined || candidates.length === 0) {
      continue;
    }

    const sorted = [...candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const rand = mulberry32(fnv1a32(`${date}:${stat}`));
    const picked = sorted[Math.floor(rand() * sorted.length)];

    if (picked !== undefined) {
      picks[stat] = picked.id;
    }
  }

  return picks;
}
