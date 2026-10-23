<script lang="ts">
  import BottomStrip from '../components/today/BottomStrip.svelte';
  import QuestColumn from '../components/today/QuestColumn.svelte';
  import RadarPanel from '../components/today/RadarPanel.svelte';
  import RankDownNotice from '../components/today/RankDownNotice.svelte';
  import StatusWindow from '../components/today/StatusWindow.svelte';
</script>

<!--
  Today (UI Revamp Issue 2). Element order, tags, class names, copy and ARIA are
  `docs/prototype/today.html`'s `<main>`, verbatim: status window, stat panel,
  quest column, then the bottom strip. Component boundaries are free; the
  rendered DOM is not. The page rules are in `src/styles/ui/today.css`, scoped to
  `body[data-page="today"]`.
-->
<RankDownNotice />
<StatusWindow />
<RadarPanel />
<QuestColumn />
<BottomStrip />
