<script lang="ts">
  import ThemeToggle from './components/ThemeToggle.svelte';

  let title = 'Daily Tracker';
</script>

<main class="flex items-center justify-between p-4">
  <h1>{title}</h1>
  <ThemeToggle />
</main>
