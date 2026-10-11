<script lang="ts">
  import { theme } from '../stores/theme';

  const isLight = $derived($theme === 'light');
  const trackClass = $derived(
    `block h-5 w-9 rounded-sm transition-colors motion-reduce:transition-none ${isLight ? 'bg-action' : 'bg-surface'}`
  );
  const thumbClass = $derived(
    `block h-4 w-4 rounded-[1px] bg-text transition-transform motion-reduce:transition-none ${isLight ? 'translate-x-[18px]' : 'translate-x-0.5'}`
  );
</script>

<button
  type="button"
  role="switch"
  aria-label="Toggle theme"
  aria-checked={$theme === 'light'}
  class="inline-flex rounded-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  onclick={() => theme.toggle()}
>
  <span class={trackClass}>
    <span class={thumbClass}></span>
  </span>
</button>
