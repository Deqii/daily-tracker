<script lang="ts">
  import EquippedTitleLine from '../components/EquippedTitleLine.svelte';
  import RankLevelReadout from '../components/RankLevelReadout.svelte';
  import TodayStatusLines from '../components/TodayStatusLines.svelte';
  import XpProgressBar from '../components/XpProgressBar.svelte';
</script>

<section class="p-4">
  <RankLevelReadout />
  <EquippedTitleLine />
  <XpProgressBar />
  <TodayStatusLines />
</section>
