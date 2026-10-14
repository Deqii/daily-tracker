<script lang="ts">
  import type { ExportState } from '../lib/export';
  import { parseImport, type ImportError } from '../lib/import';
  import { SCHEMA_VERSION } from '../lib/storage';
  import { app } from '../stores/app';

  const REASON: Record<ImportError, string> = {
    INVALID_JSON: 'The file is not valid JSON',
    NEWER_VERSION: 'The file is from a newer version',
    INVALID_DATA: 'Some data is missing or invalid',
  };

  let fileInput: HTMLInputElement | null = $state(null);
  let error = $state<ImportError | null>(null);
  let pending = $state<ExportState | null>(null);

  function openPicker(): void {
    error = null;
    pending = null;
    fileInput?.click();
  }

  async function handleFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    input.value = '';

    if (file === null) {
      return;
    }

    const result = parseImport(await file.text(), SCHEMA_VERSION);

    if (result.ok) {
      pending = result.state;
    } else {
      error = result.error;
    }
  }

  function replace(): void {
    if (pending !== null) {
      app.importState(pending);
    }

    pending = null;
  }
</script>

<button
  type="button"
  class="inline-flex min-h-11 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
  onclick={openPicker}
>
  Import data
</button>
<input
  class="hidden"
  type="file"
  accept="application/json,.json"
  aria-label="Import data"
  tabindex="-1"
  bind:this={fileInput}
  onchange={handleFile}
/>

{#if error !== null}
  <div
    class="w-full rounded-sm border border-danger bg-surface p-3 text-sm text-text"
    role="alert"
  >
    <p>Import failed. {REASON[error]}. Your data was not changed.</p>
    <button
      type="button"
      class="mt-2 text-xs text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      onclick={() => (error = null)}
    >
      Dismiss
    </button>
  </div>
{/if}

{#if pending !== null}
  <div class="w-full rounded-sm border border-surface bg-surface p-3 text-sm text-text">
    <p>Replace all current data with this file?</p>
    <div class="mt-2 flex gap-3">
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
        onclick={replace}
      >
        Replace data
      </button>
      <button
        type="button"
        class="text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onclick={() => (pending = null)}
      >
        Cancel
      </button>
    </div>
  </div>
{/if}
