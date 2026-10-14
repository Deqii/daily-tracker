<script lang="ts">
  import ExportButton from '../components/ExportButton.svelte';
  import ImportData from '../components/ImportData.svelte';
  import RankReference from '../components/RankReference.svelte';
  import ThemeToggle from '../components/ThemeToggle.svelte';
  import TitlePicker from '../components/TitlePicker.svelte';
</script>

<section class="p-4">
  <h2 class="text-xl font-semibold">Settings</h2>

  <ul class="mt-4 border-t border-surface">
    <li class="flex items-center justify-between gap-4 border-b border-surface py-2">
      <span class="text-sm text-text">Theme</span>
      <ThemeToggle />
    </li>
    <TitlePicker />
    <RankReference />
    <li class="flex flex-wrap items-center gap-3 border-b border-surface py-2">
      <span class="mr-auto text-sm text-text">Data</span>
      <ExportButton />
      <ImportData />
    </li>
  </ul>
</section>
