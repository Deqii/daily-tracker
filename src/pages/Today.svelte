<script lang="ts">
  import EquippedTitleLine from '../components/EquippedTitleLine.svelte';
  import NotificationBlocks from '../components/NotificationBlocks.svelte';
  import RadarChart from '../components/RadarChart.svelte';
  import RankLevelReadout from '../components/RankLevelReadout.svelte';
  import TodayStatusLines from '../components/TodayStatusLines.svelte';
  import XpProgressBar from '../components/XpProgressBar.svelte';
</script>

<section class="p-4">
  <RankLevelReadout />
  <EquippedTitleLine />
  <XpProgressBar />
  <TodayStatusLines />
  <RadarChart />
  <NotificationBlocks />
</section>
