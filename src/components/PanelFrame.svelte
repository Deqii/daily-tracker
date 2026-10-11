<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<div class="relative rounded-sm border border-surface bg-bg {className}">
  <span aria-hidden="true" class="panel-bracket left-0 top-0 border-l-2 border-t-2"></span>
  <span aria-hidden="true" class="panel-bracket right-0 top-0 border-r-2 border-t-2"></span>
  <span aria-hidden="true" class="panel-bracket bottom-0 left-0 border-b-2 border-l-2"></span>
  <span aria-hidden="true" class="panel-bracket bottom-0 right-0 border-b-2 border-r-2"></span>
  {@render children()}
</div>

<style>
  .panel-bracket {
    position: absolute;
    height: 24px;
    width: 24px;
    border-color: var(--accent);
    pointer-events: none;
    filter: drop-shadow(
      0 0 var(--glow-px) color-mix(in srgb, var(--accent) var(--glow-alpha), transparent)
    );
  }

  @media (max-width: 639px) {
    .panel-bracket {
      height: 16px;
      width: 16px;
    }
  }
</style>
