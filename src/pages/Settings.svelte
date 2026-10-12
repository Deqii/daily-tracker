<script lang="ts">
  import RankReference from '../components/RankReference.svelte';
  import ThemeToggle from '../components/ThemeToggle.svelte';
</script>

<section class="p-4">
  <h2 class="text-xl font-semibold">Settings</h2>

  <ul class="mt-4 border-t border-surface">
    <li class="flex items-center justify-between gap-4 border-b border-surface py-2">
      <span class="text-sm text-text">Theme</span>
      <ThemeToggle />
    </li>
    <RankReference />
  </ul>
</section>
