<script lang="ts">
  import { app } from '../stores/app';

  const equippedTitle = app.equippedTitle;
</script>

{#if $equippedTitle !== null}
  <p class="mt-2 text-sm text-muted">{$equippedTitle}</p>
{/if}
