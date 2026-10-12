<script lang="ts">
  import {
    emptyRewardFormDraft,
    rewardToFormDraft,
    validateRewardForm,
    type RewardFormDraft,
  } from '../lib/reward-form';
  import type { Reward } from '../lib/types';
  import { app } from '../stores/app';
  import CoinIcon from './CoinIcon.svelte';
  import PanelFrame from './PanelFrame.svelte';

  interface Props {
    reward?: Reward | null;
    onsave: () => void;
    oncancel: () => void;
  }

  let { reward = null, onsave, oncancel }: Props = $props();

  const FIELD_CLASS =
    'mt-1 block w-full rounded-sm border border-surface bg-bg px-2 py-1.5 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-sm';

  // svelte-ignore state_referenced_locally
  let draft = $state<RewardFormDraft>(
    reward === null ? emptyRewardFormDraft() : rewardToFormDraft(reward)
  );
  let submitted = $state(false);
  const errors = $derived(validateRewardForm(draft));

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    submitted = true;

    if (!errors.valid) {
      return;
    }

    app.saveReward(draft, reward?.id ?? null);
    onsave();
  }
</script>

<PanelFrame class="p-4">
  <h2 class="text-sm font-semibold text-text">{reward === null ? 'Add reward' : 'Edit reward'}</h2>
  <form class="mt-3" onsubmit={submit} novalidate>
    <label class="block">
      <span class="text-xs text-muted">Reward name</span>
      <input type="text" bind:value={draft.title} class={FIELD_CLASS} />
    </label>
    {#if submitted && errors.title}
      <p class="mt-1 text-xs text-danger">Reward name is required.</p>
    {/if}

    <label class="mt-3 block">
      <span class="text-xs text-muted">Cost</span>
      <span class="relative block">
        <CoinIcon class="absolute left-2 top-1/2 -translate-y-1/2" />
        <input type="text" inputmode="numeric" bind:value={draft.cost} class="{FIELD_CLASS} pl-7" />
      </span>
    </label>
    {#if submitted && errors.cost}
      <p class="mt-1 text-xs text-danger">Enter a whole number of 1 or more.</p>
    {/if}

    <div class="mt-4 flex items-center gap-4">
      <button
        type="submit"
        class="inline-flex min-h-11 items-center rounded-sm bg-action px-3 text-xs font-semibold text-action-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-9"
      >
        Save reward
      </button>
      <button
        type="button"
        class="text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onclick={oncancel}
      >
        Cancel
      </button>
    </div>
  </form>
</PanelFrame>
