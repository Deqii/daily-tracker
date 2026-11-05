<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import type { PenaltyNotice, PenaltyNoticeDay } from '../lib/penalty-notice';
  import { trapTab } from '../lib/focus';
  import { motionIsReduced, tween } from '../lib/tween';
  import type { Stat } from '../lib/types';
  import { app } from '../stores/app';

  const STAT_NAME: Record<Stat, string> = {
    STR: 'Strength',
    VIT: 'Vitality',
    INT: 'Intellect',
    DISC: 'Discipline',
    SOC: 'Social',
  };

  const CLOSE_MS = 180;
  const COUNT_MS = 900;

  const penaltyNotice = app.penaltyNotice;
  let shown = $state<PenaltyNotice | null>(null);
  let closing = $state(false);
  let xpShown = $state(0);
  let walletShown = $state(0);
  let continueButton = $state<HTMLButtonElement | null>(null);
  let dialog = $state<HTMLElement | null>(null);
  let returnFocus: HTMLElement | null = null;
  let open = false;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  function fmtDay(day: string): string {
    return new Date(`${day}T00:00:00`).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    });
  }

  function list(names: readonly string[]): string {
    if (names.length < 2) {
      return names[0] ?? '';
    }

    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
  }

  function isNothing(day: PenaltyNoticeDay): boolean {
    return day.xpDeducted === 0 && day.walletDeducted === 0;
  }

  function isFloored(day: PenaltyNoticeDay): boolean {
    return (
      !isNothing(day) &&
      (day.xpDeducted < day.nominalDeduction || day.walletDeducted < day.nominalDeduction)
    );
  }

  function deduction(day: PenaltyNoticeDay): string {
    if (isNothing(day)) {
      return 'Nothing deducted: balances were already 0.';
    }

    return `Penalty −${day.nominalDeduction} · deducted −${day.xpDeducted} XP · −${day.walletDeducted} coins`;
  }

  function nextLine(current: PenaltyNotice): string {
    const names = current.penaltyStats.map((stat) => STAT_NAME[stat]);

    if (names.length === 0) {
      return '';
    }

    return `Today: ${list(names)} ${names.length > 1 ? 'need' : 'needs'} 2 completions ${names.length > 1 ? 'each' : ''}. The same task can be completed twice.`.replace(
      ' .',
      '.'
    );
  }

  function startCountdown(current: PenaltyNotice): void {
    const xpFrom = current.balancesBefore.xp;
    const walletFrom = current.balancesBefore.wallet;
    const xpTo = current.balancesAfter.xp;
    const walletTo = current.balancesAfter.wallet;

    xpShown = xpFrom;
    walletShown = walletFrom;

    tween((progress) => {
      xpShown = Math.round(xpFrom + (xpTo - xpFrom) * progress);
      walletShown = Math.round(walletFrom + (walletTo - walletFrom) * progress);
    }, COUNT_MS);
  }

  function finishClose(): void {
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    app.acknowledgePenaltyNotice();
    shown = null;
    open = false;
    closing = false;

    const target = returnFocus;
    returnFocus = null;
    target?.focus();
  }

  function close(): void {
    if (closing) {
      return;
    }

    if (motionIsReduced()) {
      finishClose();
      return;
    }

    closing = true;
    closeTimer = setTimeout(finishClose, CLOSE_MS);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (shown === null) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'Tab' && dialog !== null) {
      trapTab(event, dialog);
    }
  }

  $effect(() => {
    const incoming = $penaltyNotice;

    if (incoming === null) {
      if (!closing && open) {
        shown = null;
        open = false;
      }

      return;
    }

    if (closing) {
      return;
    }

    if (!open) {
      open = true;
      shown = incoming;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      startCountdown(incoming);
      void tick().then(() => continueButton?.focus());
      return;
    }

    shown = incoming;
    xpShown = incoming.balancesAfter.xp;
    walletShown = incoming.balancesAfter.wallet;
  });

  onDestroy(() => {
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="ov" id="pen-ov" hidden={shown === null} class:closing>
  <div
    bind:this={dialog}
    class="ovp pen"
    class:closing
    role="dialog"
    aria-modal="true"
    aria-labelledby="pen-title"
    aria-describedby="pen-sub"
  >
    <h2 id="pen-title">Penalty applied</h2>
    <p class="pen-sub" id="pen-sub">Missed quests were closed and the penalty was deducted.</p>
    <div id="pen-days">
      {#if shown !== null}
        {#each shown.days as day (day.date)}
          <section class="pen-day">
            <h3>{fmtDay(day.date)} <span>Rank {day.rankAtStart}</span></h3>
            <ul class="pen-miss">
              {#each day.missed as miss (miss.stat)}
                <li>{STAT_NAME[miss.stat]} <b>{miss.actual} / {miss.required}</b></li>
              {/each}
            </ul>
            <p class="pen-ded">{deduction(day)}</p>
            {#if isFloored(day)}
              <p class="pen-note">
                Balances cannot go below 0, so less was deducted than the penalty.
              </p>
            {/if}
            {#if day.freezeUsed}
              <p class="pen-note">
                Freeze used. The streak was protected; the full penalty was still deducted.
              </p>
            {/if}
          </section>
        {/each}
      {/if}
    </div>
    <dl class="pen-totals" id="pen-totals">
      {#if shown !== null}
        <div>
          <dt>Lifetime XP</dt>
          <dd>
            <span class="pen-bal" id="pen-xp" aria-hidden="true">{xpShown}</span> → {shown
              .balancesAfter.xp}
          </dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd>
            <span class="pen-bal" id="pen-wallet" aria-hidden="true">{walletShown}</span> → {shown
              .balancesAfter.wallet}
          </dd>
        </div>
        {#if shown.levelBefore !== shown.levelAfter}
          <div>
            <dt>Level</dt>
            <dd>{shown.levelBefore} → {shown.levelAfter}</dd>
          </div>
        {/if}
        {#if shown.rankBefore !== shown.rankAfter}
          <div>
            <dt>Rank</dt>
            <dd>{shown.rankBefore} → {shown.rankAfter}</dd>
          </div>
        {/if}
      {/if}
    </dl>
    <p class="pen-next" id="pen-next">{shown === null ? '' : nextLine(shown)}</p>
    <button class="obtn" id="pen-continue" bind:this={continueButton} onclick={close} type="button">
      Continue
    </button>
  </div>
</div>
