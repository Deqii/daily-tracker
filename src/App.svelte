<script lang="ts">
  import MilestoneOverlays from './components/MilestoneOverlays.svelte';
  import PenaltyOverlay from './components/PenaltyOverlay.svelte';
  import AppShell from './components/AppShell.svelte';
  import CompletionToast from './components/today/CompletionToast.svelte';
  import Today from './pages/Today.svelte';
  import Tasks from './pages/Tasks.svelte';
  import Rewards from './pages/Rewards.svelte';
  import History from './pages/History.svelte';
  import Settings from './pages/Settings.svelte';
  import { currentRoute, type Route } from './lib/router';
  import { app } from './stores/app';

  const penaltyNotice = app.penaltyNotice;
  import type { Component } from 'svelte';

  const routes: Record<Route, Component> = {
    today: Today,
    tasks: Tasks,
    rewards: Rewards,
    history: History,
    settings: Settings,
  };
</script>

<!--
  `#fx`, `.scan` and `header` come first, in the prototypes' body order, and the
  toast last, as in `docs/prototype/today.html`.
-->
<AppShell />

<main>
  {#key $currentRoute}
    <svelte:component this={routes[$currentRoute]} />
  {/key}
  {#if $currentRoute === 'today'}
    <PenaltyOverlay />
  {/if}
</main>

{#if $currentRoute === 'today'}
  <CompletionToast />
{/if}

{#if $penaltyNotice === null}
  <MilestoneOverlays />
{/if}
