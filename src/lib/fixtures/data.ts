import { addDays, weekStart, type LocalDate } from '../date';
import { closeDayStreak, type StreakState } from '../../engine/streak';
import { getRankConfig } from '../../engine/rank';
import type {
  Completion,
  DailyQuestDay,
  MilestoneEvent,
  Reward,
  RewardPurchase,
  Stat,
  Task,
  Tier,
  UserState,
} from '../types';
import { RANKS, STATS, TIERS } from '../types';
import { SCHEMA_VERSION, type StorageSchema } from '../storage';
import historySnapshot from './history-snapshot.json';
import historyLongSnapshot from './history-long-snapshot.json';
import historyOpenSnapshot from './history-open-snapshot.json';
import rewardsSnapshot from './rewards-snapshot.json';
import todaySnapshot from './today-snapshot.json';
import todayStatesSnapshot from './today-states-snapshot.json';

/**
 * Deterministic seed data for the visual-diff harness.
 *
 * Every number here comes from a snapshot under this folder, and every snapshot
 * is produced by running the prototype in Playwright and reading what it
 * rendered (`scripts/dump-fixtures.mjs`). Never hand-copy a value out of a
 * prototype `<script>` into this file: that is how the heat strip and the
 * purchase log went stale when PR #157 corrected the prototypes.
 *
 * Where the prototype hardcodes something the engine owns (CAP, multipliers, rank
 * thresholds), the app reads the engine instead and the numbers are only kept in
 * sync by hand.
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
 * The fourteen levels the prototype's heat strip paints, oldest first, dumped
 * from the rendered `#heat i[data-l]` cells. `null` is today.html's `data-l="x"`:
 * a day on which nothing was completed (DEVIATIONS.md note 1).
 *
 * The strip's LAST cell is today, not yesterday: it paints `1`, and today is the
 * one day with three of five stats done, which is `data-l="1"` under the mapping
 * below. That is the reading DEVIATIONS.md note 1 takes ("four closed days plus
 * today"), and it is the only one under which the strip, Streak 5 and the two
 * red days all hold at the fixed clock. The prototype's per-cell `title`
 * attributes count the strip 14..1 hari lalu, one more than the array spans;
 * the titles are a labelling slip in the prototype, not a rule.
 */
const HEAT_LEVELS: (number | null)[] = (
  todaySnapshot as unknown as {
    heatLevels: (number | null)[];
  }
).heatLevels;

const HEAT_DAYS = HEAT_LEVELS.length;

/**
 * `data-l` -> how many of the five stats were satisfied, using the same mapping
 * as `history.html`: `c >= 5 ? 3 : c === 4 ? 2 : c === 3 ? 1 : 'x'`.
 *
 * `x` means "not enough stat satisfied to be green", which for the Today strip
 * is a day with no completions at all - the two red cells are days the streak
 * had to be rescued on or reset by.
 */
function satisfiedForLevel(level: number | null): number {
  if (level === 3) return 5;
  if (level === 2) return 4;
  if (level === 1) return 3;

  return 0;
}

interface HeatCell {
  date: LocalDate;
  /** 0 for today, 1 for yesterday, and so on. */
  daysAgo: number;
  satisfied: number;
}

function heatCells(): HeatCell[] {
  return HEAT_LEVELS.map((level, i) => {
    const daysAgo = HEAT_DAYS - 1 - i;

    return {
      date: addDays(FIXED_TODAY, -daysAgo),
      daysAgo,
      satisfied: satisfiedForLevel(level),
    };
  });
}

/** Every cell except today's, which is the open day rather than a closed one. */
function closedHeatCells(): HeatCell[] {
  return heatCells().filter((cell) => cell.daysAgo > 0);
}

/**
 * The freeze week the streak walk starts from: the week the seeded window opens
 * in. Anything before the first seeded day is outside the fixture, and the walk
 * has to begin somewhere; beginning in that same week is what lets the second
 * half of the window roll over into the current week and free the freeze.
 */
function heatWindowWeekStart(): LocalDate {
  const first = closedHeatCells()[0];

  if (first === undefined) throw new Error('today heat strip has no closed cells');

  return weekStart(first.date);
}

function dayNet(satisfied: number): number {
  const missed = STATS.length - satisfied;
  return satisfied * pointsFor(5) - missed * E_PENALTY;
}

/** Back-solves the Lifetime XP at the start of the heat window from the end value. */
function lifetimeXpBeforeHeatWindow(): number {
  let xp = 56;

  for (const seed of [...closedHeatCells()].reverse()) {
    xp -= dayNet(seed.satisfied);
  }

  return xp;
}

interface BuiltDay {
  days: DailyQuestDay[];
  completions: Completion[];
  xpAfterLastClosedDay: number;
  totalCompletions: number;
  /** Where the PRD §2.1 streak walk over the heat window ends up. */
  streakState: StreakState;
}

function buildHeatDays(): BuiltDay {
  const seeds = closedHeatCells();
  const days: DailyQuestDay[] = [];
  const completions: Completion[] = [];

  let xp = lifetimeXpBeforeHeatWindow();
  let streakState: StreakState = {
    currentStreak: 0,
    freezesUsedThisWeek: 0,
    lastFreezeWeekReset: heatWindowWeekStart(),
  };
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

    // Replayed through the engine rather than counted here, so the seeded
    // `currentStreak`, `freezesUsedThisWeek` and each day's `freezeUsed` cannot
    // drift away from the completions that are seeded beside them.
    const close = closeDayStreak(
      streakState,
      { date: seed.date, completionCount: seed.satisfied, hasQuestStats: true },
      'E'
    );

    streakState = close.streakState;

    days.push({
      date: seed.date,
      selectedTaskIdPerStat: {},
      requiredCompletions: required({ STR: 1, VIT: 1, INT: 1, DISC: 1, SOC: 1 }),
      actualCompletions: actual,
      netPointsChange: net,
      freezeUsed: close.freezeUsed,
      closed: true,
      lifetimeXPEnd: xp,
      levelEnd: null,
      rankEnd: 'E',
    });
  }

  return { days, completions, xpAfterLastClosedDay: xp, totalCompletions: total, streakState };
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
    currentStreak: heat.streakState.currentStreak,
    freezesUsedThisWeek: heat.streakState.freezesUsedThisWeek,
    lastFreezeWeekReset: heat.streakState.lastFreezeWeekReset,
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
/* today.html?state=...                                                        */
/* -------------------------------------------------------------------------- */

interface TodayStateQuest {
  readonly stat: Stat;
  readonly name: string;
  readonly nominal: number | null;
  readonly need: number;
  readonly done: number;
  readonly tiers:
    | readonly {
        readonly name: string;
        readonly description: string;
        readonly nominal: number;
      }[]
    | null;
}

interface TodayStateDump {
  readonly rank: string;
  readonly level: number;
  readonly xp: number;
  readonly wallet: number;
  readonly stats: Record<Stat, number>;
  readonly multiplier: number;
  readonly title: string | null;
  readonly freezes: number;
  readonly quests: readonly TodayStateQuest[];
  readonly qCount: string | null;
  readonly blocked: string | null;
  readonly emptyTitle: string | null;
  readonly penaltyTitle: string | null;
  readonly message: string | null;
  readonly overlay: {
    readonly role: string | null;
    readonly label: string | null;
    readonly big: string | null;
    readonly text: string | null;
    readonly details: readonly (readonly [string | null, string | null])[];
  } | null;
  readonly notice: string | null;
  readonly banner: {
    readonly role: string | null;
    readonly recovery: boolean;
    readonly text: string;
  } | null;
}

/** Dumped by `buildTodayStates` in `scripts/dump-fixtures.mjs`. */
const TODAY_STATE_DUMPS = (
  todayStatesSnapshot as unknown as { states: Record<string, TodayStateDump> }
).states;

const TODAY_BASE = buildToday();

function levelUpEvent(dump: TodayStateDump, id: string): MilestoneEvent {
  const match = /Level ([0-9]+) to ([0-9]+)/.exec(dump.overlay?.text ?? '');

  if (match === null) {
    throw new Error('today-states-snapshot.json: level-up overlay has no "Level N to M" text');
  }

  return {
    id,
    type: 'levelUp',
    localDate: FIXED_TODAY,
    from: Number(match[1]),
    to: Number(match[2]),
    seen: false,
  };
}

function rankChangeEvent(
  dump: TodayStateDump,
  type: 'rankUp' | 'rankDown',
  id: string
): MilestoneEvent {
  const to = (
    type === 'rankUp' ? dump.overlay?.big : /Rank dropped to ([A-Z])/.exec(dump.notice ?? '')?.[1]
  ) as string | undefined;

  if (to === undefined || RANKS.includes(to as (typeof RANKS)[number]) === false) {
    throw new Error(`today-states-snapshot.json: ${type} state has no valid target rank`);
  }

  const index = RANKS.indexOf(to as (typeof RANKS)[number]);

  return {
    id,
    type,
    localDate: FIXED_TODAY,
    from: RANKS[Math.max(0, index - 1)] ?? 'E',
    to: to as (typeof RANKS)[number],
    seen: false,
  };
}

interface BuiltTodayState {
  readonly schema: StorageSchema;
  readonly post?: 'storage-failure' | 'recovery';
}

function buildTodayState(name: string, dump: TodayStateDump): BuiltTodayState {
  const schema = structuredClone(TODAY_BASE.schema);
  const rank = dump.rank as UserState['rank'];

  schema.userState.rank = rank;

  if (dump.title === null) {
    schema.userState.equippedTitle = null;
  }

  if (dump.blocked !== null) {
    schema.userState.lifetimeXP = dump.xp;
    schema.userState.statXP = { ...dump.stats };
  }

  const used = getRankConfig(rank).freezesPerWeek - dump.freezes;

  if (used >= 0 && used !== schema.userState.freezesUsedThisWeek) {
    schema.userState.freezesUsedThisWeek = used;
    schema.userState.lastFreezeWeekReset = FIXED_WEEK_START;
  }

  if (dump.quests.length === 0) {
    schema.tasks = [];
    schema.completions = [];
    const open = schema.dailyQuestLog[schema.dailyQuestLog.length - 1];

    if (open !== undefined) {
      open.selectedTaskIdPerStat = {};
    }
  }

  const tierQuest = dump.quests.find((q) => q.tiers !== null);

  if (tierQuest?.tiers != null) {
    const index = schema.tasks.findIndex((task) => task.id === 't-int');

    if (index < 0) {
      throw new Error('today fixture has no t-int task to replace with the tier picker');
    }

    const existing = schema.tasks[index];

    if (existing === undefined) {
      throw new Error('today fixture has no t-int task to replace with the tier picker');
    }

    schema.tasks[index] = {
      id: existing.id,
      familyName: tierQuest.name,
      stat: existing.stat,
      isAnchor: existing.isAnchor,
      createdAt: existing.createdAt,
      variants: tierQuest.tiers.map((tier, i) => ({
        tier: TIERS[i] ?? 'easy',
        description: tier.description,
        points: tier.nominal,
      })),
    };
  }

  if (dump.overlay?.label === 'Level up') {
    schema.milestoneEvents = [levelUpEvent(dump, `today-${name}`)];
  } else if (dump.overlay?.label === 'Rank up') {
    schema.milestoneEvents = [rankChangeEvent(dump, 'rankUp', `today-${name}`)];
  } else if (dump.notice !== null) {
    schema.milestoneEvents = [rankChangeEvent(dump, 'rankDown', `today-${name}`)];
  }

  if (name === 'storage') {
    return { schema, post: 'storage-failure' };
  }

  if (name === 'recovery') {
    return { schema, post: 'recovery' };
  }

  return { schema };
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
  const userState = baseUserState();

  // Header chips, as tasks.html's own header renders them: `E`, `5`, `65`.
  userState.wallet = 65;
  userState.currentStreak = 5;

  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: TASK_LIBRARY,
    completions: [],
    dailyQuestLog: [],
    rewards: [],
    rewardPurchases: [],
    userState,
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

/** `R` in rewards.html: cost plus the `b` count of purchases, dumped from the page. */
interface RewardsSnapshot {
  readonly catalog: {
    readonly id: number;
    readonly title: string;
    readonly cost: number;
    readonly bought: number;
  }[];
  readonly purchases: { readonly title: string; readonly cost: number; readonly when: string }[];
  readonly totalSpent: number;
}

const REWARDS_SNAPSHOT = rewardsSnapshot as unknown as RewardsSnapshot;

/**
 * The prototype's relative day label -> whole days before the fixed clock.
 * "Yesterday" is the only label that is not written as a number.
 */
function daysAgoFor(label: string): number {
  if (label === 'Yesterday') return 1;

  const match = /^(\d+) days ago$/.exec(label);

  if (match === null) {
    throw new Error(`rewards-snapshot.json: unknown relative label "${label}"`);
  }

  return Number(match[1]);
}

function buildRewards(): StorageSchema {
  const rewards: Reward[] = REWARDS_SNAPSHOT.catalog.map((entry) => ({
    id: `r${String(entry.id).padStart(2, '0')}`,
    title: entry.title,
    cost: entry.cost,
    createdAt: FIXED_NOW,
  }));

  const byTitle = new Map(rewards.map((r) => [r.title, r]));

  // Every purchase the prototype logs, newest first by day offset, with the
  // title and cost snapshotted on the purchase itself (PRD data model) so a
  // later cost edit cannot rewrite history.
  const purchases: RewardPurchase[] = REWARDS_SNAPSHOT.purchases.map((entry, i) => {
    const reward = byTitle.get(entry.title);

    if (reward === undefined) {
      throw new Error(`rewards-snapshot.json: purchase "${entry.title}" is not in the catalog`);
    }

    const date = addDays(FIXED_TODAY, -daysAgoFor(entry.when));

    return {
      id: `p${String(i + 1).padStart(3, '0')}`,
      rewardId: reward.id,
      rewardTitle: entry.title,
      costAtPurchase: entry.cost,
      purchasedAt: `${date}T19:00:00+07:00`,
      localDate: date,
    };
  });

  purchases.sort((a, b) => (a.purchasedAt < b.purchasedAt ? 1 : -1));

  /**
   * Test scaffolding for the Rewards page's average income (DEVIATIONS.md,
   * "Test scaffolding"): thirteen closed days at +13 each plus today's open day
   * at +9 average to exactly 13 over fourteen calendar days, the prototype's
   * fixed `AVG`. The prototype hardcodes that number; the app derives it.
   */
  const dailyQuestLog: DailyQuestDay[] = [];

  for (let offset = 13; offset >= 1; offset--) {
    const date = addDays(FIXED_TODAY, -offset);

    dailyQuestLog.push({
      date,
      selectedTaskIdPerStat: {},
      requiredCompletions: emptyRequired(),
      actualCompletions: emptyCounts(),
      netPointsChange: 13,
      freezeUsed: false,
      closed: true,
      lifetimeXPEnd: 65,
      levelEnd: null,
      rankEnd: 'E',
    });
  }

  dailyQuestLog.push({
    date: FIXED_TODAY,
    selectedTaskIdPerStat: {},
    requiredCompletions: emptyRequired(),
    actualCompletions: emptyCounts(),
    netPointsChange: 9,
    freezeUsed: false,
    closed: false,
    lifetimeXPEnd: null,
    levelEnd: null,
    rankEnd: null,
  });

  const userState = baseUserState();
  userState.wallet = 65;
  userState.lifetimeXP = 65;
  userState.statXP = { STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 };
  userState.equippedTitle = 'first-reward';
  userState.unlockedTitles = ['first-reward'];
  userState.totalPurchases = purchases.length;
  // Streak chip, as rewards.html's own header renders it: `5`. Nothing is
  // completed today in this fixture, so the display streak is the stored one.
  userState.currentStreak = 5;
  userState.lastRolloverDate = FIXED_TODAY;

  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    completions: [],
    dailyQuestLog,
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
  freeze: boolean;
  open: boolean;
  events: { kind: string; title: string; subtitle: string }[];
};

type SnapshotEvent = {
  kind: string;
  title: string;
  subtitle: string;
  dayIndex: number;
  date: string;
};

type HistorySnapshot = {
  chips: { rank: string; streak: string };
  days: SnapshotDay[];
  events: SnapshotEvent[];
};

const SNAPSHOT = historySnapshot as unknown as HistorySnapshot;
const LONG_SNAPSHOT = historyLongSnapshot as unknown as HistorySnapshot;
const OPEN_SNAPSHOT = historyOpenSnapshot as unknown as HistorySnapshot;

const RANK_CHANGE = /^Rank (up|down): ([EDCBAS]) to ([EDCBAS])$/;
const LEVEL_UP = /^Level up: (\d+) to (\d+)$/;
const NEW_TITLE = /^New title: (.+)$/;

/**
 * Maps the prototype's dumped event list into the stored engine event log.
 *
 * The engine already records level-ups and rank changes. The prototype also
 * shows title unlocks; the engine has no title-unlock event variant yet, so the
 * fixture seeds the same stored `titleUnlock` entries (see DEVIATIONS.md, "Test
 * scaffolding"), and the page reads them from `milestoneEvents` like any other
 * event. The engine's title rule is untouched.
 */
function historyMilestones(snapshot: HistorySnapshot): MilestoneEvent[] {
  return snapshot.events.flatMap((event, index): MilestoneEvent[] => {
    const id = `h-${event.dayIndex}-${index}`;

    if (event.kind === 'up' || event.kind === 'down') {
      const match = RANK_CHANGE.exec(event.title);

      if (match === null) throw new Error(`history event has no rank change: ${event.title}`);

      return [
        {
          id,
          type: event.kind === 'up' ? 'rankUp' : 'rankDown',
          localDate: event.date,
          from: match[2] as UserState['rank'],
          to: match[3] as UserState['rank'],
          seen: true,
        },
      ];
    }

    if (event.kind === 'lv') {
      const match = LEVEL_UP.exec(event.title);

      if (match === null) throw new Error(`history event has no level up: ${event.title}`);

      return [
        {
          id,
          type: 'levelUp',
          localDate: event.date,
          from: Number(match[1]),
          to: Number(match[2]),
          seen: true,
        },
      ];
    }

    if (event.kind === 'ms') {
      const match = NEW_TITLE.exec(event.title);

      if (match === null) throw new Error(`history event has no title name: ${event.title}`);

      return [
        {
          id,
          type: 'titleUnlock',
          localDate: event.date,
          name: match[1] ?? '',
          detail: event.subtitle,
          seen: true,
        },
      ];
    }

    throw new Error(`unknown history event kind: ${event.kind}`);
  });
}

/**
 * The prototype walks `MASKS` from a starting Lifetime XP and ends on today. Its
 * simulation ignores the balance gate, freezes and 2x, so these snapshots are
 * replayed verbatim rather than recomputed by the engine.
 *
 * The snapshot's last day IS today. It is stored as the open day (no end-of-day
 * snapshot), replacing the old fixture's duplicate: this fixture used to append
 * a second 2026-10-15 entry on top of the snapshot's own last day, which made the
 * chart and the log show the same date twice.
 */
function buildHistory(snapshot: HistorySnapshot, openLast: boolean): StorageSchema {
  const snapshotDays = snapshot.days;
  const last = snapshotDays[snapshotDays.length - 1];

  if (last === undefined) {
    throw new Error('history snapshot has no days');
  }

  const days: DailyQuestDay[] = snapshotDays.map((day) => {
    const open = openLast && day.index === last.index;

    return {
      date: day.date,
      selectedTaskIdPerStat: {},
      requiredCompletions: maskToRequired(day.mask),
      actualCompletions: maskToActual(day.mask),
      netPointsChange: day.netPointsChange,
      freezeUsed: day.freeze,
      closed: !open,
      lifetimeXPEnd: open ? null : day.lifetimeXPEnd,
      levelEnd: open ? null : day.levelEnd,
      rankEnd: open ? null : (day.rankEnd as DailyQuestDay['rankEnd']),
    };
  });

  const userState = baseUserState();
  userState.lifetimeXP = last.lifetimeXPEnd;
  // Wallet chip, as history.html's own header renders it: `65`. history.html
  // hardcodes that chip rather than deriving it from the simulation's running
  // Lifetime XP, so the prototype's value is the one the header shows.
  userState.wallet = 65;
  userState.statXP = { STR: 16, VIT: 12, INT: 20, DISC: 10, SOC: 7 };
  userState.rank = snapshot.chips.rank as UserState['rank'];
  /**
   * Streak chip, as history.html's own header renders it: `13`.
   *
   * The snapshot's last day IS today, and `streakEnd` on it (13) is the streak at
   * the END of today. `userState.currentStreak` is the streak entering the open
   * day and `displayStreak` adds today's completion to it (PRD 7.4), so the
   * stored value is one less than the end-of-day figure and the header reads
   * 12 + 1 = 13.
   */
  userState.currentStreak = last.streakEnd - 1;
  userState.unlockedTitles = ['first-reward', 'streak-7', 'completions-100'];
  userState.equippedTitle = 'first-reward';

  return {
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    completions: [],
    dailyQuestLog: days,
    rewards: [],
    rewardPurchases: [],
    userState,
    milestoneEvents: historyMilestones(snapshot),
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
  // Streak chip, as settings.html's own header renders it: `5`.
  userState.currentStreak = 5;
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
  /** Named `?state=` variants, used through `?fixture=today&state=<name>`. */
  readonly states?: Record<string, Fixture>;
  /** A real app condition to induce after seeding, never a visual override. */
  readonly post?: 'storage-failure' | 'recovery';
}

export type FixtureName = 'today' | 'tasks' | 'rewards' | 'history' | 'settings';

const today = buildToday();

/**
 * Today's deterministic states. `freeze2` is deliberately absent: at Rank E the
 * engine allows one freeze per week, so the prototype's two-freeze state cannot
 * be produced without changing the rank (DEVIATIONS.md Q10).
 */
const todayStates: Record<string, Fixture> = {};

for (const [name, dump] of Object.entries(TODAY_STATE_DUMPS)) {
  if (name === 'default' || name === 'freeze2') continue;

  const built = buildTodayState(name, dump);

  todayStates[name] = {
    schema: built.schema,
    extra: [{ key: 'daily-tracker:motion', value: 'on' }],
    ...(built.post === undefined ? {} : { post: built.post }),
  };
}

export const FIXTURES: Record<FixtureName, Fixture> = {
  today: {
    schema: today.schema,
    extra: [{ key: 'daily-tracker:motion', value: 'on' }],
    states: todayStates,
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
    schema: buildHistory(SNAPSHOT, false),
    extra: [{ key: 'daily-tracker:motion', value: 'on' }],
    states: {
      long: {
        schema: buildHistory(LONG_SNAPSHOT, false),
        extra: [{ key: 'daily-tracker:motion', value: 'on' }],
      },
      open: {
        schema: buildHistory(OPEN_SNAPSHOT, true),
        extra: [{ key: 'daily-tracker:motion', value: 'on' }],
      },
    },
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
