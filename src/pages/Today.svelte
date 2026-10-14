<script lang="ts">
  import DailyQuest from '../components/DailyQuest.svelte';
  import EquippedTitleLine from '../components/EquippedTitleLine.svelte';
  import NotificationBlocks from '../components/NotificationBlocks.svelte';
  import RadarChart from '../components/RadarChart.svelte';
  import RankDownNotice from '../components/RankDownNotice.svelte';
  import RankLevelReadout from '../components/RankLevelReadout.svelte';
  import RewardsPreview from '../components/RewardsPreview.svelte';
  import TodayStatusLines from '../components/TodayStatusLines.svelte';
  import XpProgressBar from '../components/XpProgressBar.svelte';
</script>

<section class="p-4">
  <RankDownNotice />
  <RankLevelReadout />
  <EquippedTitleLine />
  <XpProgressBar />
  <TodayStatusLines />
  <RadarChart />
  <NotificationBlocks />
  <DailyQuest />
  <RewardsPreview />
</section>
