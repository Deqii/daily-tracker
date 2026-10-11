<script lang="ts">
  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();
</script>

<svg
  class="shrink-0 {className}"
  viewBox="0 0 16 16"
  width="16"
  height="16"
  aria-hidden="true"
  focusable="false"
>
  <circle class="coin-body" cx="8" cy="8" r="7" />
  <circle class="coin-highlight" cx="5.5" cy="5.5" r="1.5" />
</svg>

<style>
  .coin-body {
    fill: var(--coin);
    stroke: var(--coin-rim);
  }

  .coin-highlight {
    fill: color-mix(in srgb, var(--coin) 60%, white);
  }
</style>
