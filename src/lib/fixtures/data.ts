import { addDays, weekStart, type LocalDate } from '../date';
import type {
  Completion,
  DailyQuestDay,
  Reward,
  RewardPurchase,
  Stat,
  Task,
  Tier,
  UserState,
} from '../types';
import { STATS } from '../types';
import { SCHEMA_VERSION, type StorageSchema } from '../storage';
import historySnapshot from './history-snapshot.json';

/**
 * Deterministic seed data for the visual-diff harness.
 *
 * Every number here is copied out of a prototype's `<script>` block, so the app
 * under test renders the same values the prototype renders. Where the prototype
 * hardcodes something the engine owns (CAP, multipliers, rank thresholds), the
 * app reads the engine instead and the numbers are only kept in sync by hand.
 *
 * Never import this module from production code paths; `src/lib/fixtures/index.ts`
 * is loaded through a build-mode gated dynamic import.
 */

/** The clock the harness pins in both `playwright.config.ts` and the dump script. */
export const FIXED_NOW = '2026-10-15T09:00:00+07:00';
export const FIXED_TODAY: LocalDate = '2026-10-15';
const FIXED_WEEK_START = weekStart(FIXED_TODAY);

/** Rank E in the PRD rank table: cap 15, multiplier 0.5, penalty 5. */
const E_CAP = 15;
const E_MULT = 0.5;
const E_PENALTY = 5;

const pointsFor = (nominal: number): number => Math.ceil(Math.min(nominal, E_CAP) * E_MULT);

const emptyCounts = (): Record<Stat, number> => ({ STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });
const emptyRequired = (): Record<Stat, number> => ({ STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 });

function counts(satisfied: Partial<Record<Stat, number>>): Record<Stat, number> {
  return { ...emptyCounts(), ...satisfied };
}

function required(spec: Partial<Record<Stat, number>>): Record<Stat, number> {
  return { ...emptyRequired(), ...spec };
}

interface VariantSpec {
  tier: Tier;
  description: string;
  points: number;
}

interface TaskSpec {
  id: string;
  familyName: string;
  stat: Stat;
  isAnchor: boolean;
  variants: VariantSpec[];
}

function task(spec: TaskSpec): Task {
  return { ...spec, createdAt: FIXED_NOW };
}

function variant(tier: Tier, description: string, points: number): VariantSpec {
  return { tier, description, points };
}

/* -------------------------------------------------------------------------- */
/* today.html                                                                  */
/* -------------------------------------------------------------------------- */

const TODAY_TASKS: Task[] = [
  task({
    id: 't-str',
    familyName: 'Squat 15x2 set',
    stat: 'STR',
    isAnchor: true,
    variants: [variant('easy', '15x2 set', 5)],
  }),
  task({
    id: 't-vit',
    familyName: 'Minum air 2L',
    stat: 'VIT',
    isAnchor: true,
    variants: [variant('easy', '2 liter', 5)],
  }),
  task({
    id: 't-int',
    familyName: 'Baca 10 halaman',
    stat: 'INT',
    isAnchor: false,
    variants: [variant('easy', '10 halaman', 5)],
  }),
  task({
    id: 't-disc',
    familyName: 'Ibadah',
    stat: 'DISC',
    isAnchor: true,
    variants: [variant('easy', 'Tepat waktu', 5)],
  }),
  task({
    id: 't-soc',
    familyName: 'Chat 1 teman',
    stat: 'SOC',
    isAnchor: true,
    variants: [variant('easy', '1 orang', 5)],
  }),
];

const TODAY_REWARDS: Reward[] = [
  { id: 'r-game', title: 'Main game 2 jam', cost: 60, createdAt: FIXED_NOW },
  { id: 'r-kopi', title: 'Kopi susu santai', cost: 35, createdAt: FIXED_NOW },
  { id: 'r-bioskop', title: 'Nonton bioskop', cost: 800, createdAt: FIXED_NOW },
];

/** `Q` in today.html: one quest row per stat, Soc penalised at 2. */
const TODAY_QUEST: { taskId: string; stat: Stat; done: boolean }[] = [
  { taskId: 't-str', stat: 'STR', done: true },
  { taskId: 't-vit', stat: 'VIT', done: true },
  { taskId: 't-int', stat: 'INT', done: false },
  { taskId: 't-disc', stat: 'DISC', done: true },
  { taskId: 't-soc', stat: 'SOC', done: false },
];

/**
 * The fourteen levels the prototype's heat strip paints, oldest first.
 * `null` is today.html's `data-l="x"`: a day on which nothing was completed.
 */
const HEAT_LEVELS: (number | null)[] = [3, 2, 3, 1, null, 3, 3, 2, 3, 3, null, 2, 3, 1];

const HEAT_DAYS = HEAT_LEVELS.length;

interface DaySeed {
  date: LocalDate;
  satisfied: number;
}

function heatSeeds(): DaySeed[] {
  const first = addDays(FIXED_TODAY, -(HEAT_DAYS - 1));

  return HEAT_LEVELS.map((level, i) => ({
    date: addDays(first, i),
    satisfied: level ?? 0,
  }));
}

function dayNet(satisfied: number): number {
  const missed = STATS.length - satisfied;
  return satisfied * pointsFor(5) - missed * E_PENALTY;
}

/** Back-solves the Lifetime XP at the start of the heat window from the end value. */
function lifetimeXpBeforeHeatWindow(): number {
  let xp = 56;

  for (const seed of [...heatSeeds()].reverse()) {
    xp -= dayNet(seed.satisfied);
  }

  return xp;
}

interface BuiltDay {
  days: DailyQuestDay[];
  completions: Completion[];
  xpAfterLastClosedDay: number;
  totalCompletions: number;
  streak: number;
}

function buildHeatDays(): BuiltDay {
  const seeds = heatSeeds();
  const days: DailyQuestDay[] = [];
  const completions: Completion[] = [];

  let xp = lifetimeXpBeforeHeatWindow();
  let streak = 0;
  let total = 0;
  let seq = 0;

  for (const seed of seeds) {
    const actual = counts({});

    for (const stat of STATS.slice(0, seed.satisfied)) {
      const spec = TODAY_TASKS.find((t) => t.stat === stat);
      if (spec === undefined) continue;

      actual[stat] = 1;
      seq += 1;
      completions.push({
        id: `h${String(seq).padStart(4, '0')}`,
        taskId: spec.id,
        taskName: spec.familyName,
        stat,
        variantTier: null,
        pointsAwarded: pointsFor(5),
        completedAt: `${seed.date}T20:00:00+07:00`,
        localDate: seed.date,
      });
      total += 1;
    }

    const net = dayNet(seed.satisfied);
    xp += net;

    if (seed.satisfied > 0) {
      streak += 1;
    }

    days.push({
      date: seed.date,
      selectedTaskIdPerStat: {},
      requiredCompletions: required({ STR: 1, VIT: 1, INT: 1, DISC: 1, SOC: 1 }),
      actualCompletions: actual,
      netPointsChange: net,
      freezeUsed: false,
      closed: true,
      lifetimeXPEnd: xp,
      levelEnd: null,
      rankEnd: 'E',
    });
  }

  return { days, completions, xpAfterLastClosedDay: xp, totalCompletions: total, streak };
}

function buildToday(): { schema: StorageSchema; heatLevels: (number | null)[] } {
  const heat = buildHeatDays();

  const actual = counts({});
  const completions = [...heat.completions];

  for (const row of TODAY_QUEST) {
    if (!row.done) continue;

    actual[row.stat] += 1;
    const spec = TODAY_TASKS.find((t) => t.id === row.taskId);

    completions.push({
      id: `t${String(completions.length + 1).padStart(4, '0')}`,
      taskId: row.taskId,
      taskName: spec?.familyName ?? '',
      stat: row.stat,
      variantTier: null,
      pointsAwarded: pointsFor(5),
      completedAt: FIXED_NOW,
      localDate: FIXED_TODAY,
    });
  }

  const openDay: DailyQuestDay = {
    date: FIXED_TODAY,
    selectedTaskIdPerStat: { INT: 't-int' },
    requiredCompletions: required({ STR: 1, VIT: 1, INT: 1, DISC: 1, SOC: 2 }),
    actualCompletions: actual,
    netPointsChange: 9,
    freezeUsed: false,
    closed: false,
    lifetimeXPEnd: null,
    levelEnd: null,
    rankEnd: null,
  };

  const userState: UserState = {
    lifetimeXP: 65,
    wallet: 65,
    statXP: { STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 },
    rank: 'E',
    currentStreak: heat.streak,
    freezesUsedThisWeek: 0,
    lastFreezeWeekReset: FIXED_WEEK_START,
    penaltyStats: ['SOC'],
    equippedTitle: 'first-reward',
    unlockedTitles: ['first-reward'],
    totalCompletions: heat.totalCompletions + 3,
    totalPurchases: 0,
    lastRolloverDate: FIXED_TODAY,
  };

  return {
    heatLevels: HEAT_LEVELS,
    schema: {
      schemaVersion: SCHEMA_VERSION,
      tasks: TODAY_TASKS,
      completions,
      dailyQuestLog: [...heat.days, openDay],
      rewards: TODAY_REWARDS,
      rewardPurchases: [],
      userState,
      milestoneEvents: [],
      theme: 'dark',
    },
  };
}

/* -------------------------------------------------------------------------- */
/* tasks.html                                                                  */
/* -------------------------------------------------------------------------- */

const TASK_LIBRARY: Task[] = [
  task({
    id: 't01',
    familyName: 'Push up routine',
    stat: 'STR',
    isAnchor: false,
    variants: [
      variant('easy', '10x2 set', 5),
      variant('medium', '20x3 set', 12),
      variant('hard', '30x4 set atau jogging 2km', 25),
    ],
  }),
  task({
    id: 't02',
    familyName: 'Squat 15x2 set',
    stat: 'STR',
    isAnchor: false,
    variants: [variant('easy', '15x2 set', 5)],
  }),
  task({
    id: 't03',
    familyName: 'Jalan cepat 20 menit',
    stat: 'STR',
    isAnchor: true,
    variants: [variant('easy', '20 menit', 5)],
  }),
  task({
    id: 't04',
    familyName: 'Minum air 2L',
    stat: 'VIT',
    isAnchor: true,
    variants: [variant('easy', '2 liter', 3)],
  }),
  task({
    id: 't05',
    familyName: 'Tidur sebelum 23.00',
    stat: 'VIT',
    isAnchor: false,
    variants: [variant('easy', 'Sebelum 23.00', 4)],
  }),
  task({
    id: 't06',
    familyName: 'Baca 10 halaman',
    stat: 'INT',
    isAnchor: false,
    variants: [variant('easy', '10 halaman', 3)],
  }),
  task({
    id: 't07',
    familyName: 'Belajar coding',
    stat: 'INT',
    isAnchor: false,
    variants: [
      variant('easy', '30 menit', 6),
      variant('medium', '1 jam', 14),
      variant('hard', '2 jam', 30),
    ],
  }),
  task({
    id: 't08',
    familyName: 'Ibadah',
    stat: 'DISC',
    isAnchor: true,
    variants: [variant('easy', 'Tepat waktu', 3)],
  }),
  task({
    id: 't09',
    familyName: 'Fokus tanpa HP',
    stat: 'DISC',
    isAnchor: false,
    variants: [
      variant('easy', '30 menit', 6),
      variant('medium', '60 menit', 14),
      variant('hard', '90 menit', 26),
    ],
  }),
  task({
    id: 't10',
    familyName: 'Chat 1 teman',
    stat: 'SOC',
    isAnchor: true,
    variants: [variant('easy', '1 orang', 5)],
  }),
  task({
    id: 't11',
    familyName: 'Telepon keluarga',
    stat: 'SOC',
    isAnchor: false,
    variants: [variant('easy', '10 menit', 3)],
  }),
];

/** `pick: true` in tasks.html, i.e. the rotating row chosen for today. */
const TODAY_PICKS: Partial<Record<Stat, string>> = {
  STR: 't02',
  VIT: 't05',
  INT: 't06',
  DISC: 't09',
  SOC: 't11',
};

function buildTasks(): StorageSchema {
  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: TASK_LIBRARY,
    completions: [],
    dailyQuestLog: [],
    rewards: [],
    rewardPurchases: [],
    userState: baseUserState(),
    milestoneEvents: [],
    theme: 'dark',
  };
}

function baseUserState(): UserState {
  return {
    lifetimeXP: 0,
    wallet: 0,
    statXP: { STR: 0, VIT: 0, INT: 0, DISC: 0, SOC: 0 },
    rank: 'E',
    currentStreak: 0,
    freezesUsedThisWeek: 0,
    lastFreezeWeekReset: FIXED_WEEK_START,
    penaltyStats: [],
    equippedTitle: null,
    unlockedTitles: [],
    totalCompletions: 0,
    totalPurchases: 0,
    lastRolloverDate: FIXED_TODAY,
  };
}

/* -------------------------------------------------------------------------- */
/* rewards.html                                                                */
/* -------------------------------------------------------------------------- */

/** `R` in rewards.html: cost plus the `b` count of purchases. */
const REWARD_CATALOG: { id: string; title: string; cost: number; bought: number }[] = [
  { id: 'r01', title: 'Main game 2 jam', cost: 60, bought: 4 },
  { id: 'r02', title: 'Kopi susu santai', cost: 35, bought: 8 },
  { id: 'r03', title: 'Beli buku baru', cost: 150, bought: 0 },
  { id: 'r04', title: 'Jajan favorit', cost: 250, bought: 1 },
  { id: 'r05', title: 'Nonton bioskop', cost: 800, bought: 2 },
];

/**
 * The five purchases the prototype's log shows, newest first, with the day
 * offsets its relative labels imply. The remaining purchases exist only to make
 * each card's `Dibeli N×` counter match `REWARD_CATALOG`.
 */
const PURCHASE_LOG: { rewardId: string; daysAgo: number }[] = [
  { rewardId: 'r01', daysAgo: 1 },
  { rewardId: 'r02', daysAgo: 2 },
  { rewardId: 'r05', daysAgo: 5 },
  { rewardId: 'r02', daysAgo: 6 },
  { rewardId: 'r04', daysAgo: 9 },
];

function buildRewards(): StorageSchema {
  const rewards: Reward[] = REWARD_CATALOG.map(({ id, title, cost }) => ({
    id,
    title,
    cost,
    createdAt: FIXED_NOW,
  }));

  const byId = new Map(rewards.map((r) => [r.id, r]));
  const purchases: RewardPurchase[] = [];

  const push = (rewardId: string, daysAgo: number, seq: number) => {
    const reward = byId.get(rewardId);
    if (reward === undefined) return;

    const date = addDays(FIXED_TODAY, -daysAgo);

    purchases.push({
      id: `p${String(seq).padStart(3, '0')}`,
      rewardId,
      rewardTitle: reward.title,
      costAtPurchase: reward.cost,
      purchasedAt: `${date}T19:00:00+07:00`,
      localDate: date,
    });
  };

  let seq = 0;

  for (const entry of PURCHASE_LOG) {
    push(entry.rewardId, entry.daysAgo, seq++);
  }

  // Backfill only the shortfall, so each card's `Dibeli N×` counter matches the
  // prototype while the log keeps the five entries the prototype shows.
  for (const { id, bought } of REWARD_CATALOG) {
    const logged = PURCHASE_LOG.filter((p) => p.rewardId === id).length;

    for (let n = logged; n < bought; n += 1) {
      push(id, 30 + n - logged, seq++);
    }
  }

  purchases.sort((a, b) => (a.purchasedAt < b.purchasedAt ? 1 : -1));

  const userState = baseUserState();
  userState.wallet = 65;
  userState.lifetimeXP = 65;
  userState.statXP = { STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 };
  userState.equippedTitle = 'first-reward';
  userState.unlockedTitles = ['first-reward'];
  userState.totalPurchases = purchases.length;

  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    completions: [],
    dailyQuestLog: [],
    rewards,
    rewardPurchases: purchases,
    userState,
    milestoneEvents: [],
    theme: 'dark',
  };
}

/* -------------------------------------------------------------------------- */
/* history.html                                                                */
/* -------------------------------------------------------------------------- */

type SnapshotDay = {
  index: number;
  date: string;
  mask: string;
  satisfiedStats: number;
  netPointsChange: number;
  lifetimeXPEnd: number;
  levelEnd: number;
  rankEnd: string;
  streakEnd: number;
  events: { kind: string; title: string; subtitle: string }[];
};

type SnapshotEvent = {
  kind: string;
  title: string;
  subtitle: string;
  dayIndex: number;
  date: string;
};

const SNAPSHOT = historySnapshot as unknown as {
  chips: { rank: string; streak: string };
  days: SnapshotDay[];
  events: SnapshotEvent[];
};

/**
 * The prototype walks `MASKS` from a starting Lifetime XP of 300 and ends on the
 * day before today. Its simulation ignores the balance gate, freezes and 2x, so
 * these snapshots are replayed verbatim rather than recomputed by the engine.
 */
function buildHistory(): StorageSchema {
  const snapshotDays = SNAPSHOT.days;
  const last = snapshotDays[snapshotDays.length - 1];

  if (last === undefined) {
    throw new Error('history-snapshot.json has no days');
  }

  const days: DailyQuestDay[] = snapshotDays.map((day) => ({
    date: day.date,
    selectedTaskIdPerStat: {},
    requiredCompletions: maskToRequired(day.mask),
    actualCompletions: maskToActual(day.mask),
    netPointsChange: day.netPointsChange,
    freezeUsed: false,
    closed: true,
    lifetimeXPEnd: day.lifetimeXPEnd,
    levelEnd: day.levelEnd,
    rankEnd: day.rankEnd as DailyQuestDay['rankEnd'],
  }));

  days.push({
    date: FIXED_TODAY,
    selectedTaskIdPerStat: {},
    requiredCompletions: emptyRequired(),
    actualCompletions: emptyCounts(),
    netPointsChange: 0,
    freezeUsed: false,
    closed: false,
    lifetimeXPEnd: null,
    levelEnd: null,
    rankEnd: null,
  });

  const userState = baseUserState();
  userState.lifetimeXP = last.lifetimeXPEnd;
  userState.wallet = last.lifetimeXPEnd;
  userState.statXP = { STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 };
  userState.rank = SNAPSHOT.chips.rank as UserState['rank'];
  userState.currentStreak = Number(SNAPSHOT.chips.streak);
  userState.unlockedTitles = ['first-reward', 'streak-7', 'completions-100'];
  userState.equippedTitle = 'first-reward';

  const milestoneEvents = SNAPSHOT.events
    .filter((e) => e.kind === 'up' || e.kind === 'down')
    .map((e) => {
      const from = e.kind === 'up' ? 'E' : 'D';
      const to = e.kind === 'up' ? 'D' : 'E';

      return {
        id: `m${e.dayIndex}`,
        type: e.kind === 'up' ? ('rankUp' as const) : ('rankDown' as const),
        localDate: e.date,
        from: from as UserState['rank'],
        to: to as UserState['rank'],
        seen: true,
      };
    });

  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    completions: [],
    dailyQuestLog: days,
    rewards: [],
    rewardPurchases: [],
    userState,
    milestoneEvents,
    theme: 'dark',
  };
}

function maskToRequired(mask: string): Record<Stat, number> {
  const out = emptyRequired();
  STATS.forEach((stat, i) => {
    out[stat] = mask[i] === '1' ? 1 : 0;
  });
  return out;
}

function maskToActual(mask: string): Record<Stat, number> {
  const out = emptyCounts();
  STATS.forEach((stat, i) => {
    out[stat] = mask[i] === '1' ? 1 : 0;
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* settings.html                                                               */
/* -------------------------------------------------------------------------- */

/** `SX` in settings.html, which matches the today fixture's `statXP`. */
const SETTINGS_STAT_XP: Record<Stat, number> = { STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 };

function buildSettings(): StorageSchema {
  const userState = baseUserState();
  userState.lifetimeXP = 65;
  userState.wallet = 65;
  userState.statXP = SETTINGS_STAT_XP;
  userState.rank = 'E';
  userState.currentStreak = 4;
  userState.equippedTitle = 'first-reward';
  userState.unlockedTitles = ['first-reward'];
  userState.totalCompletions = 1;

  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    completions: [],
    dailyQuestLog: [],
    rewards: [],
    rewardPurchases: [],
    userState,
    milestoneEvents: [],
    theme: 'dark',
  };
}

/* -------------------------------------------------------------------------- */
/* registry                                                                    */
/* -------------------------------------------------------------------------- */

/** Extra keys outside the PRD schema that a prototype reads directly. */
export interface ExtraSeed {
  readonly key: string;
  readonly value: unknown;
}

export interface Fixture {
  readonly schema: StorageSchema;
  readonly extra?: ExtraSeed[];
}

export type FixtureName = 'today' | 'tasks' | 'rewards' | 'history' | 'settings';

const today = buildToday();

export const FIXTURES: Record<FixtureName, Fixture> = {
  today: {
    schema: today.schema,
    extra: [{ key: 'daily-tracker:motion', value: 'on' }],
  },
  tasks: {
    schema: buildTasks(),
    extra: [{ key: 'daily-tracker:questPicks', value: TODAY_PICKS }],
  },
  rewards: {
    schema: buildRewards(),
    extra: [{ key: 'daily-tracker:motion', value: 'on' }],
  },
  history: {
    schema: buildHistory(),
    extra: [{ key: 'daily-tracker:motion', value: 'on' }],
  },
  settings: {
    schema: buildSettings(),
    extra: [
      { key: 'daily-tracker:motion', value: 'on' },
      // settings.html shows "Backup terakhir: 9 hari lalu"; the app's backup-age
      // banner is Issue 6 work, so the key is seeded here ahead of its reader.
      { key: 'daily-tracker:lastExportAt', value: '2026-10-06T09:00:00+07:00' },
    ],
  },
};

export const FIXTURE_NAMES = Object.keys(FIXTURES) as FixtureName[];
