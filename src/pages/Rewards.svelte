<script lang="ts">
  import { onMount } from 'svelte';
  import {
    RING_CIRCUMFERENCE,
    affordabilityHint,
    affordableCount,
    affordableLine,
    averageDailyIncome,
    averageIncomeLine,
    purchaseHistory,
    rewardCards,
    rewardsSummary,
    sortRewardCards,
    totalSpent,
    type RewardCard,
    type RewardsSort,
  } from '../lib/rewards-page';
  import {
    emptyRewardFormDraft,
    rewardToFormDraft,
    validateRewardForm,
    type RewardFormDraft,
  } from '../lib/reward-form';
  import { motionIsReduced, tween } from '../lib/tween';
  import type { Reward } from '../lib/types';
  import { app } from '../stores/app';

  /**
   * Rewards page (UI Revamp Issue 4).
   *
   * The markup, class names and attributes are `docs/prototype/rewards.html`'s.
   * The drawer, scrim and toast are the prototype's direct children of `<body>`,
   * so they are moved there by `portal` after mount; the rest renders inside the
   * shared `<main>`.
   *
   * Every value the page prints comes from the store or the engine: rewards and
   * purchase counts from `rewardCards`, the wallet and affordability from the
   * store, and the average income from `averageDailyIncome` over the engine's
   * daily records. The prototype's `R`, `L`, `AVG`, `wallet` and `SORTS` demo
   * state are not copied.
   */

  const SORTS: readonly { key: RewardsSort; label: string }[] = [
    { key: 'afford', label: 'Affordable first' },
    { key: 'cheap', label: 'Cheapest' },
    { key: 'most', label: 'Most bought' },
  ];

  let sort = $state<RewardsSort>('afford');
  let only = $state(false);
  let shownWallet = $state($app.userState.wallet);

  let drawerOpen = $state(false);
  let editingId = $state<string | null>(null);
  let draft = $state<RewardFormDraft>(emptyRewardFormDraft());
  let submitted = $state(false);
  let opener: HTMLElement | null = null;

  let confirmId = $state<string | null>(null);
  let outId = $state<string | null>(null);
  let gridVersion = $state(0);
  let flashId = $state<string | null>(null);
  let newId = $state<string | null>(null);
  let popId = $state<string | null>(null);
  let freshPurchaseId = $state<string | null>(null);

  let toastText = $state('');
  let toastVisible = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const today = $derived($app.userState.lastRolloverDate);
  const average = $derived(averageDailyIncome($app.dailyQuestLog, today));
  const cards = $derived(
    rewardCards($app.rewards, $app.rewardPurchases, $app.userState.wallet, average)
  );
  const affordable = $derived(affordableCount(cards));
  const summary = $derived(rewardsSummary(cards.length, affordable));
  const history = $derived(purchaseHistory($app.rewardPurchases, today));
  const spent = $derived(totalSpent($app.rewardPurchases));
  const errors = $derived(validateRewardForm(draft));
  const hint = $derived(affordabilityHint(draft.cost, $app.userState.wallet, average));

  const visible = $derived(
    sortRewardCards(
      only ? cards.filter((card) => !card.locked) : cards,
      $app.userState.wallet,
      sort
    )
  );

  /** Starts the ring at empty and settles it to its fill after two frames, as `rewards.html` does. */
  function ringOffset(node: SVGCircleElement, progress: number) {
    const offset = (value: number): string => String(RING_CIRCUMFERENCE * (1 - value));

    node.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        node.style.strokeDashoffset = offset(progress);
      })
    );

    return {
      update(next: number) {
        node.style.strokeDashoffset = offset(next);
      },
    };
  }

  /** Moves a prototype-overlay node to `<body>`, where the prototype keeps it. */
  function portal(node: HTMLElement): { destroy: () => void } {
    document.body.appendChild(node);

    return {
      destroy() {
        node.remove();
      },
    };
  }

  function animateWallet(to: number): void {
    const from = shownWallet;

    tween((progress) => {
      shownWallet = Math.round(from + (to - from) * progress);
    }, 600);
  }

  function burst(button: HTMLElement): void {
    if (motionIsReduced()) return;

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    for (let index = 0; index < 12; index++) {
      const coin = document.createElement('i');

      coin.className = 'cn';
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 70;

      coin.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(angle) * distance}px;--dy:${Math.sin(angle) * distance - 30}px;animation-delay:${index * 12}ms`;
      document.body.append(coin);
      setTimeout(() => coin.remove(), 1100);
    }
  }

  function floatCost(button: HTMLElement, cost: number): void {
    if (motionIsReduced()) return;

    const rect = button.getBoundingClientRect();
    const float = document.createElement('div');

    float.className = 'float';
    float.textContent = `−${cost}`;
    float.style.cssText = `left:${rect.left + rect.width / 2 - 14}px;top:${rect.top - 6}px`;
    document.body.append(float);
    setTimeout(() => float.remove(), 1200);
  }

  function buy(card: RewardCard, event: MouseEvent): void {
    const button = event.currentTarget;

    if (!(button instanceof HTMLElement) || card.locked) return;

    burst(button);
    floatCost(button, card.reward.cost);

    flashId = card.reward.id;
    popId = card.reward.id;

    const result = app.purchaseReward(card.reward.id);

    if (!result.ok) return;

    freshPurchaseId = result.value.purchase.id;
    animateWallet($app.userState.wallet);
    showToast(`${card.reward.title} bought (−${card.reward.cost})`);
  }

  function openDrawer(reward: Reward | null): void {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editingId = reward?.id ?? null;
    draft = reward === null ? emptyRewardFormDraft() : rewardToFormDraft(reward);
    submitted = false;
    drawerOpen = true;

    setTimeout(() => document.querySelector<HTMLInputElement>('#fT')?.focus(), 400);
  }

  function closeDrawer(): void {
    drawerOpen = false;
    submitted = false;
    opener?.focus?.();
  }

  function saveReward(): void {
    submitted = true;

    if (!validateRewardForm(draft).valid) return;

    const wasEdit = editingId !== null;
    const id = app.saveReward(draft, editingId);

    closeDrawer();
    only = false;

    if (wasEdit) {
      flashId = id;
      newId = null;
    } else {
      flashId = null;
      newId = id;
    }

    showToast(wasEdit ? 'Reward updated' : 'Reward added');

    setTimeout(() => {
      document
        .querySelector(`[data-id="${id}"]`)
        ?.scrollIntoView({ block: 'center', behavior: motionIsReduced() ? 'auto' : 'smooth' });
    }, 60);
  }

  function askDelete(card: RewardCard): void {
    confirmId = card.reward.id;

    setTimeout(() => {
      const cancel = document.querySelector('[data-cc]');

      if (cancel instanceof HTMLElement) cancel.focus();
    }, 0);
  }

  function cancelDelete(): void {
    confirmId = null;
  }

  function deleteCard(card: RewardCard): void {
    const id = card.reward.id;
    const title = card.reward.title;

    confirmId = null;
    outId = id;

    setTimeout(
      () => {
        app.deleteReward(id);
        outId = null;
        gridVersion += 1;
        showToast(`"${title}" deleted. Purchase history is kept.`);
      },
      motionIsReduced() ? 0 : 280
    );
  }

  function showToast(text: string): void {
    toastText = text;
    toastVisible = true;

    if (toastTimer !== null) clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toastVisible = false;
      toastTimer = null;
    }, 7000);
  }

  onMount(() => {
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;

      closeDrawer();

      if (confirmId !== null) confirmId = null;
    };

    window.addEventListener('keydown', onKeydown);

    return () => window.removeEventListener('keydown', onKeydown);
  });
</script>

<div class="head boot" style="--i:0">
  <div>
    <h1>Rewards</h1>
    <p class="sub" id="summary">{summary}</p>
  </div>
  <button class="btn" id="add" onclick={() => openDrawer(null)}>
    <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="2.4"
      ><path d="M7 1v12M1 7h12" /></svg
    >Add reward
  </button>
</div>
<div class="layout">
  <div>
    <div class="tools boot" style="--i:1">
      <button class="f" id="onlyCan" aria-pressed={only} onclick={() => (only = !only)}
        >Affordable now</button
      ><div class="sep"></div>
      <div style="display:flex;gap:6px" role="group" aria-label="Urutkan" id="sorts">
        {#each SORTS as option (option.key)}
          <button
            class="f"
            data-so={option.key}
            aria-pressed={sort === option.key}
            onclick={() => (sort = option.key)}>{option.label}</button
          >
        {/each}
      </div>
    </div>
    <div class="grid" id="grid">
      {#each visible as card, index (`${card.reward.id}:${gridVersion}`)}
        <article
          class={`panel card ${card.locked ? 'lock' : 'can'}${flashId === card.reward.id
            ? ' flash'
            : ''}${newId === card.reward.id ? ' new' : ''}`}
          class:out={outId === card.reward.id}
          data-id={card.reward.id}
          style={`--i:${index + 2}`}
        >
          <div class="row" style="align-items:flex-start">
            <div class="ttl">{card.reward.title}</div>
            <div class="acts">
              <button
                class="ib"
                data-e={card.reward.id}
                aria-label={`Edit ${card.reward.title}`}
                onclick={() => openDrawer(card.reward)}
              >
                <svg viewBox="0 0 16 16"><path d="M11 2l3 3-8 8H3v-3z" /></svg>
              </button>
              <button
                class="ib del"
                data-d={card.reward.id}
                aria-label={`Delete ${card.reward.title}`}
                onclick={() => askDelete(card)}
              >
                <svg viewBox="0 0 16 16"><path d="M3 4h10M6 4V2h4v2M5 4l.6 9h4.800L11 4" /></svg>
              </button>
            </div>
          </div>
          <div class="row">
            <span class="cost"
              >{card.reward.cost.toLocaleString('en-US')}<i class="coin l"></i></span
            >
            <span class="bought"
              >Bought <b class:pop={popId === card.reward.id}>{card.purchaseCount}</b>
              {card.purchaseCount === 1 ? 'time' : 'times'}</span
            >
          </div>
          <div class="foot">
            {#if !card.locked}
              <button
                class="btn gold"
                data-b={card.reward.id}
                style="flex:1"
                onclick={(event) => buy(card, event)}
              >
                Buy
              </button>
            {:else}
              <div
                class="ring"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax={card.reward.cost}
                aria-valuenow={$app.userState.wallet}
              >
                <svg viewBox="0 0 62 62"
                  ><circle class="bg" cx="31" cy="31" r="26" /><circle
                    class="fg"
                    cx="31"
                    cy="31"
                    r="26"
                    stroke-dasharray={RING_CIRCUMFERENCE}
                    stroke-dashoffset={RING_CIRCUMFERENCE}
                    data-off={RING_CIRCUMFERENCE * (1 - card.progress)}
                    use:ringOffset={card.progress}
                  /></svg
                >
                <span>{Math.floor(card.progress * 100)}%</span>
              </div>
              <div class="need">
                <span class="lk"
                  ><svg
                    width="13"
                    height="14"
                    viewBox="0 0 13 14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    ><rect x="1.500" y="6" width="10" height="7" rx="1" /><path
                      d="M4 6V4a2.500 2.500 0 015 0v2"
                    /></svg
                  >Locked</span
                ><br /><b
                  >{(card.reward.cost - $app.userState.wallet).toLocaleString('en-US')}</b
                >
                more coins<br />≈ {card.daysToGo} days to go
              </div>
            {/if}
          </div>
          {#if confirmId === card.reward.id}
            <div class="confirm" role="alertdialog" aria-label={`Delete ${card.reward.title}?`}>
              <span>Delete {card.reward.title}?</span>
              <span>
                <button class="btn dng" data-cd={card.reward.id} onclick={() => deleteCard(card)}
                  >Delete</button
                >
                <button class="btn ghost" data-cc="1" onclick={cancelDelete}>Cancel</button>
              </span>
            </div>
          {/if}
        </article>
      {:else}
        {#if $app.rewards.length > 0}
          <div class="empty">Nothing affordable yet. Complete quests to earn coins.</div>
        {:else}
          <div class="empty">
            <h2>No rewards yet</h2>
            <p>Add a reward to spend your wallet on.</p>
            <button class="btn" data-add="1" onclick={() => openDrawer(null)}>Add reward</button>
          </div>
        {/if}
      {/each}
    </div>
  </div>
  <aside class="side">
    <section class="panel wallet boot" style="--i:2" aria-label="Wallet">
      <span class="sub">Wallet</span>
      <div class="big"><span id="bigW">{shownWallet}</span><i class="coin xl"></i></div>
      <div class="kv"><span>Affordable now</span><b id="kvCan">{affordableLine(affordable, cards.length)}</b></div>
      <div class="kv"><span>Average income</span><b>{averageIncomeLine(average)}</b></div>
      <div class="kv"><span>Total spent</span><b id="kvSpent">{spent.toLocaleString('en-US')}</b></div>
    </section>
    <section class="panel hist boot" style="--i:3" aria-label="Purchase history"
      ><h2>Purchase history</h2>
      <ul class="log" id="log">
        {#if history.length === 0}
          <li class="sub">No purchases yet.</li>
        {:else}
          {#each history as row (row.purchase.id)}
            <li class:fresh={row.purchase.id === freshPurchaseId}
              ><span>{row.purchase.rewardTitle}<small>{row.label}</small></span><b
                >−{row.purchase.costAtPurchase.toLocaleString('en-US')}</b
              ></li
            >
          {/each}
        {/if}
      </ul></section
    >
  </aside>
</div>

<!-- svelte-ignore a11y_click_events_have_key_events (rewards.html scrim; Escape closes) -->
<!-- svelte-ignore a11y_no_static_element_interactions (rewards.html scrim; Escape closes) -->
<div class="scrim" class:on={drawerOpen} id="scrim" use:portal onclick={closeDrawer}></div>
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role (rewards.html uses aside role=dialog) -->
<aside
  class="drawer"
  class:on={drawerOpen}
  id="drawer"
  role="dialog"
  aria-modal="true"
  aria-labelledby="dt"
  use:portal
>
  <div class="row">
    <h2 id="dt">{editingId === null ? 'Add reward' : 'Edit reward'}</h2>
    <button class="ib" id="x" aria-label="Close" onclick={closeDrawer}>
      <svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" /></svg>
    </button>
  </div>
  <label class="lab" for="fT">Reward name</label><input
    class="in"
    class:bad={submitted && errors.title}
    id="fT"
    maxlength="40"
    placeholder="Example: Main game 2 jam"
    bind:value={draft.title}
  /><div class="err" id="eT">{submitted && errors.title ? 'Reward name is required.' : ''}</div>
  <label class="lab" for="fC">Cost</label><input
    class="in"
    class:bad={submitted && errors.cost}
    id="fC"
    type="number"
    min="1"
    step="1"
    placeholder="60"
    value={draft.cost}
    oninput={(event) => (draft.cost = event.currentTarget.value)}
  /><div class="hint" id="hC">{hint}</div>
  <div class="err" id="eC">
    {submitted && errors.cost ? 'Enter a whole number of 1 or more.' : ''}
  </div>
  <p class="hint" style="margin-top:16px"
    >Rewards can be bought repeatedly. Buying only lowers your Wallet, not XP or stats.</p
  >
  <div class="dfoot">
    <button class="btn" id="save" onclick={saveReward}>Save reward</button>
    <button class="btn ghost" id="cancel" onclick={closeDrawer}>Cancel</button>
  </div>
</aside>
<div class="toast" class:show={toastVisible} id="toast" role="status" aria-live="polite" use:portal>
  <span id="toastTxt">{toastText}</span><button id="undo" hidden>Undo</button>
</div>
