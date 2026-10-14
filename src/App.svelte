<script lang="ts">
  import StorageNotices from './components/StorageNotices.svelte';
  import LevelUpReveal from './components/LevelUpReveal.svelte';
  import RankUpReveal from './components/RankUpReveal.svelte';
  import TopBar from './components/TopBar.svelte';
  import Today from './pages/Today.svelte';
  import Tasks from './pages/Tasks.svelte';
  import Rewards from './pages/Rewards.svelte';
  import History from './pages/History.svelte';
  import Settings from './pages/Settings.svelte';
  import { currentRoute, type Route } from './lib/router';
  import type { Component } from 'svelte';

  const routes: Record<Route, Component> = {
    today: Today,
    tasks: Tasks,
    rewards: Rewards,
    history: History,
    settings: Settings,
  };
</script>

<TopBar />
<StorageNotices />
<LevelUpReveal />
<RankUpReveal />

<main>
  <svelte:component this={routes[$currentRoute]} />
</main>
