<script lang="ts">
  import { buildExport } from '../lib/export';
  import { readBackupRecord, SCHEMA_VERSION } from '../lib/storage';
  import { app } from '../stores/app';

  function handleExport(): void {
    const { filename, contents } = buildExport($app, SCHEMA_VERSION, readBackupRecord(), new Date());
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

<button
  type="button"
  class="inline-flex min-h-11 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
  onclick={handleExport}
>
  Export data
</button>
