<script lang="ts">
  import { onMount } from 'svelte';
  import { getStorageNotices } from '../lib/storage-notices';
  import { buildExport } from '../lib/export';
  import { readBackupRecord, SCHEMA_VERSION } from '../lib/storage';
  import { app } from '../stores/app';

  /**
   * Storage-failure and recovery banners (UI Revamp Issue 2). `today.html` inserts
   * them directly above `header` on every page; `AppShell` renders this component
   * between the scan sweep and the header for that reason.
   *
   * Both conditions are the app's own: `saveError` for a failed write and the
   * load report for discarded data. `getStorageNotices` owns the copy and the
   * role choice.
   */

  const saveError = app.saveError;
  const loadReport = app.loadReport;

  let dismissedRecovery = $state(false);
  let clientMounted = $state(false);

  onMount(() => {
    clientMounted = true;
  });

  const notices = $derived(
    getStorageNotices({
      report: $loadReport,
      saveError: $saveError,
      dismissedRecovery,
    })
  );

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
</script>

{#if clientMounted}
  {#each notices as notice (notice.type)}
    {#if notice.type === 'write-failure'}
      <div class="banner" role="alert">
        <span>{notice.message}</span>
        {#if notice.hasExport}
          <button class="obtn" onclick={handleExport}>Export data</button>
        {/if}
      </div>
    {:else}
      <div class="banner recovery" role="status">
        <span>{notice.message}</span>
        <span>
          {#if notice.hasExport}
            <button class="obtn" onclick={handleExport}>Export data</button>
          {/if}
          {#if notice.hasDismiss}
            <button class="lnk" onclick={() => (dismissedRecovery = true)}>Dismiss</button>
          {/if}
        </span>
      </div>
    {/if}
  {/each}
{/if}
