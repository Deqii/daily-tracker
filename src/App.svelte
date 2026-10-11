<script lang="ts">
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

<main>
  <svelte:component this={routes[$currentRoute]} />
</main>
