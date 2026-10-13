<script lang="ts">
  import { app } from '../stores/app';
  import { getStorageNotices } from '../lib/storage-notices';
  import { buildExport } from '../lib/export';
  import { readBackupRecord, SCHEMA_VERSION } from '../lib/storage';
  import { onMount } from 'svelte';

  const saveError = app.saveError;
  const loadReport = app.loadReport;

  let dismissedRecovery = false;

  function handleExport(): void {
    const { filename, contents } = buildExport(
      $app,
      SCHEMA_VERSION,
      readBackupRecord(),
      new Date()
    );
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const notices = $derived(
    getStorageNotices({
      report: $loadReport,
      saveError: $saveError,
      dismissedRecovery,
    })
  );

  let clientMounted = $state(false);
  onMount(() => {
    clientMounted = true;
  });
</script>

{#if clientMounted && notices.length > 0}
  <div class="flex flex-col gap-2 p-4">
    {#each notices as notice (notice.type)}
      <div
        class="rounded-sm border border-danger bg-surface p-3 text-sm text-text"
        role={notice.type === 'write-failure' ? 'alert' : undefined}
      >
        <p>{notice.message}</p>
        <div class="mt-2 flex gap-3">
          {#if notice.hasExport}
            <button
              type="button"
              class="inline-flex min-h-11 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
              onclick={handleExport}
            >
              Export data
            </button>
          {/if}
          {#if notice.hasDismiss}
            <button
              type="button"
              class="text-xs text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onclick={() => {
                dismissedRecovery = true;
              }}
            >
              Dismiss
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}
