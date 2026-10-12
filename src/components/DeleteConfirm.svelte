<script lang="ts">
  interface Props {
    name: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let { name, onconfirm, oncancel }: Props = $props();
</script>

<li class="flex items-center gap-2 border-b border-surface py-2">
  <span class="text-sm text-text">Delete {name}?</span>
  <div class="ml-auto flex shrink-0 items-center gap-3">
    <button
      type="button"
      class="inline-flex min-h-11 items-center rounded-sm border border-danger px-3 text-xs font-semibold text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
      onclick={onconfirm}
    >
      Delete
    </button>
    <button
      type="button"
      class="text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      onclick={oncancel}
    >
      Cancel
    </button>
  </div>
</li>
