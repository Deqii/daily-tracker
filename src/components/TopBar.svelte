<script lang="ts">
  import { currentRoute, type Route } from '../lib/router';
  import { app } from '../stores/app';
  import CoinIcon from './CoinIcon.svelte';

  interface NavItem {
    readonly route: Route;
    readonly label: string;
  }

  const navItems: readonly NavItem[] = [
    { route: 'today', label: 'Today' },
    { route: 'tasks', label: 'Tasks' },
    { route: 'rewards', label: 'Rewards' },
    { route: 'history', label: 'History' },
    { route: 'settings', label: 'Settings' },
  ];

  const rank = app.rank;
  const streak = app.streak;
</script>

<header class="border-b border-surface bg-bg">
  <div class="flex flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center lg:gap-6">
    <div class="flex flex-wrap items-center justify-between gap-4 lg:contents">
      <span class="text-sm font-semibold text-text lg:order-1">Daily Tracker</span>
      <div class="flex flex-wrap items-center gap-2 lg:order-3 lg:ml-auto">
        <span
          class="inline-flex items-center gap-1 rounded-sm border border-surface px-2 py-0.5 text-xs"
        >
          <span class="text-muted">Rank</span>
          <span class="glow-text font-mono text-accent">{$rank}</span>
        </span>
        <span
          class="inline-flex items-center gap-1 rounded-sm border border-surface px-2 py-0.5 text-xs"
        >
          <span class="text-muted">Streak</span>
          <span class="font-mono text-muted">{$streak}</span>
        </span>
        <span class="inline-flex items-center gap-1 rounded-sm border border-surface px-2 py-0.5">
          <CoinIcon />
          <span class="font-mono text-xs text-muted">{$app.userState.wallet}</span>
        </span>
      </div>
    </div>
    <nav aria-label="Primary" class="flex items-stretch gap-1 lg:order-2 lg:flex-none">
      {#each navItems as item (item.route)}
        <a
          href={`#/${item.route}`}
          aria-current={$currentRoute === item.route ? 'page' : undefined}
          class="flex min-h-11 flex-1 items-center justify-center whitespace-nowrap border-b-2 px-3 text-sm sm:min-h-0 lg:flex-none {$currentRoute ===
          item.route
            ? 'border-action-ink text-text'
            : 'border-transparent text-muted hover:text-text'}"
        >
          {item.label}
        </a>
      {/each}
    </nav>
  </div>
</header>
