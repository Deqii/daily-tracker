<script lang="ts">
  import { onMount } from 'svelte';
  import { level as levelOf } from '../engine/level';
  import type { TitleId } from '../engine/titles';
  import { buildExport } from '../lib/export';
  import type { ExportState } from '../lib/export';
  import { parseImport, type ImportError } from '../lib/import';
  import {
    LAST_EXPORT_AT_KEY,
    SCHEMA_VERSION,
    readBackupRecord,
    readPreference,
    writePreference,
  } from '../lib/storage';
  import { toTimestamp } from '../lib/date';
  import {
    backupStatus,
    balanceGateView,
    nextRankProgress,
    settingsRankRows,
    settingsTitleCards,
    type SettingsTitleCard,
  } from '../lib/settings-page';
  import { app } from '../stores/app';
  import { motionPreference, soundPreference } from '../stores/preferences';
  import { theme } from '../stores/theme';

  const streak = app.streak;
  const rank = $derived($app.userState.rank);
  const level = $derived(levelOf($app.userState.lifetimeXP));
  const accent = $derived(`--rk-${rank.toLowerCase()}`);
  const rankRows = $derived(settingsRankRows(rank));
  const progress = $derived(nextRankProgress($app.userState));
  const gate = $derived(balanceGateView($app.userState.statXP));
  const titleCards = $derived(settingsTitleCards($app.userState, $streak));
  const preview = $derived(titleCards.find((card) => card.equipped)?.name ?? 'No title');

  let barsReady = $state(false);
  let flashing = $state<TitleId | null>(null);
  let lastExportAt = $state<string | null>(readPreference(LAST_EXPORT_AT_KEY));
  const backup = $derived(backupStatus(Date.now(), lastExportAt));

  const IMPORT_REASON: Record<ImportError, string> = {
    INVALID_JSON: 'The file is not valid JSON',
    NEWER_VERSION: 'The file is from a newer version',
    INVALID_DATA: 'Some data is missing or invalid',
  };

  type ImportMessage =
    | { readonly kind: 'bad'; readonly text: string }
    | {
        readonly kind: 'confirm';
        readonly name: string;
        readonly rank: string;
        readonly xp: string;
        readonly state: ExportState;
      };

  let importMessage = $state<ImportMessage | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let previewPop = $state(false);
  let toastText = $state('');
  let toastVisible = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function portal(node: HTMLElement): { destroy: () => void } {
    document.body.appendChild(node);

    return {
      destroy() {
        node.remove();
      },
    };
  }

  function showToast(text: string): void {
    toastText = text;
    toastVisible = true;

    if (toastTimer !== null) clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toastVisible = false;
      toastTimer = null;
    }, 3200);
  }

  function popPreview(): void {
    previewPop = false;
    requestAnimationFrame(() => {
      previewPop = true;
    });
  }

  function blip(): void {
    if ($soundPreference !== 'on') return;

    try {
      const Ctx = window.AudioContext;

      if (Ctx === undefined) return;

      const context = new Ctx();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(990, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.26);
    } catch {
      // Audio is an optional preference; a blocked AudioContext is not an error.
    }
  }

  function toggleSound(): void {
    const next = $soundPreference === 'on' ? 'off' : 'on';

    soundPreference.setPreference(next);

    if (next === 'on') blip();
  }

  function equip(card: SettingsTitleCard): void {
    if (card.equipped) {
      app.equipTitle(null);
      flashing = null;
      showToast('Title unequipped');
    } else {
      app.equipTitle(card.id);
      showToast(`Title equipped: ${card.name}`);
      blip();
      flashing = card.id;
    }

    popPreview();
  }

  function exportData(): void {
    const now = new Date();
    const { filename, contents } = buildExport($app, SCHEMA_VERSION, readBackupRecord(), now);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    const stamp = toTimestamp(now);

    writePreference(LAST_EXPORT_AT_KEY, stamp);
    lastExportAt = stamp;
    showToast('Data exported');
  }

  function openPicker(): void {
    importMessage = null;
    fileInput?.click();
  }

  async function handleFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    input.value = '';

    if (file === null) return;

    const result = parseImport(await file.text(), SCHEMA_VERSION);

    if (!result.ok) {
      importMessage = { kind: 'bad', text: IMPORT_REASON[result.error] };
      return;
    }

    importMessage = {
      kind: 'confirm',
      name: file.name,
      rank: result.state.userState.rank,
      xp: String(result.state.userState.lifetimeXP),
      state: result.state,
    };
  }

  function replaceData(): void {
    if (importMessage?.kind !== 'confirm') return;

    app.importState(importMessage.state);
    importMessage = null;
    showToast('Import complete');
  }

  onMount(() => {
    let first = 0;
    let second = 0;

    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        barsReady = true;
      });
    });

    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);

      if (toastTimer !== null) clearTimeout(toastTimer);
    };
  });
</script>

<div class="boot" style="--i:0">
  <h1>Settings</h1>
  <p class="sub">Appearance, rank rules, titles and data backup.</p>
</div>

<div class="g2">
  <section class="panel boot" style="--i:1" aria-labelledby="h-look">
    <h2 id="h-look">Appearance</h2>
    <div class="set">
      <div><b>Theme</b><span class="sub">Interface display mode</span></div>
      <div class="seg" role="radiogroup" aria-label="Theme" id="theme">
        <button
          role="radio"
          data-v="light"
          aria-checked={$theme === 'light'}
          onclick={() => theme.setTheme('light')}>Light</button
        ><button
          role="radio"
          data-v="dark"
          aria-checked={$theme === 'dark'}
          onclick={() => theme.setTheme('dark')}>Dark</button
        >
      </div>
    </div>
    <div class="set">
      <div><b>Animation</b><span class="sub">Particles, corner effects and transitions</span></div>
      <button
        class="tg"
        id="motion"
        role="switch"
        aria-checked={$motionPreference === 'on'}
        aria-label="Animation"
        onclick={() => motionPreference.toggle()}
      ></button>
    </div>
    <div class="set">
      <div><b>Sound effects</b><span class="sub">A short sound when equipping a title</span></div>
      <button
        class="tg"
        id="sound"
        role="switch"
        aria-checked={$soundPreference === 'on'}
        aria-label="Sound effects"
        onclick={toggleSound}
      ></button>
    </div>
  </section>

  <section class="panel boot" style="--i:2" aria-labelledby="h-data">
    <h2 id="h-data">Data</h2>
    <p class="sub" style="margin-top:4px">
      All data is stored in this browser only. Clearing site data deletes all progress, and there is
      no sync. Export is the only backup.
    </p>
    <div class="bk" class:ok={backup.ok} id="bk" role="status">
      <span class="dot"></span>
      <div><b id="bkT">{backup.title}</b><span class="sub" id="bkS">{backup.detail}</span></div>
    </div>
    <div class="btns">
      <button class="btn" id="exp" onclick={exportData}>Export data</button><button
        class="btn line"
        id="imp"
        onclick={openPicker}>Import data</button
      ><input
        type="file"
        id="file"
        accept="application/json,.json"
        hidden
        bind:this={fileInput}
        onchange={handleFile}
      />
    </div>
    <div id="impMsg" aria-live="polite">
      {#if importMessage?.kind === 'bad'}
        <div class="msg bad" role="alert">
          Import failed. {importMessage.text}. Your data was not changed.
        </div>
      {:else if importMessage?.kind === 'confirm'}
        <div class="msg">
          <b>Replace all current data with this file?</b><br />{importMessage.name}: Rank {importMessage.rank},
          {importMessage.xp} XP.
          <div class="btns">
            <button class="btn danger" id="ok" onclick={replaceData}>Replace data</button><button
              class="btn ghost"
              id="no"
              onclick={() => (importMessage = null)}>Cancel</button
            >
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>

<section class="panel boot" style="--i:3" aria-labelledby="h-rank">
  <div class="row">
    <div>
      <h2 id="h-rank">Rank reference</h2>
      <p class="sub">
        Every value below applies before it affects you. There are no hidden mechanics.
      </p>
    </div>
    <span class="chip" style="border-color:var({accent});color:var({accent})"
      >Current: Rank {rank} · Level {level}</span
    >
  </div>
  <div class="go">
    <div class="box">
      <h3>
        <span>{progress.nextRank === null ? 'Top rank' : `Toward Rank ${progress.nextRank}`}</span
        ><span class="sub"
          >{progress.targetLevel === null
            ? `Level ${level}`
            : `Level ${progress.targetLevel}`}</span
        >
      </h3>
      <div class="bar">
        <i id="lvBar" style="width:{barsReady ? progress.ratio * 100 : 0}%"></i>
      </div>
      {#if progress.nextRank === null}
        <p class="sub" style="margin-top:8px">
          <b style="color:var(--text)">{progress.currentXP}</b> XP · highest rank reached
        </p>
      {:else}
        <p class="sub" style="margin-top:8px">
          <b style="color:var(--text)">{progress.currentXP}</b> / {progress.requiredXP} XP ·
          <b style="color:var(--text)">{progress.remainingXP} XP</b> to go
        </p>
      {/if}
    </div>
    <div class="box">
      <h3>
        <span>Balance gate</span><span id="gateS" class={gate.passes ? 'ok' : 'bad'}
          >{gate.passes ? 'Passed' : 'Not passed'}</span
        >
      </h3>
      <div class="gate" id="gate">
        {#each gate.rows as row (row.stat)}
          <div class="gr" class:weak={gate.weakest === row.stat} style="--c:var({row.color})">
            <span>{row.label}</span>
            <div class="bar">
              <i data-w={row.ratio * 100} style="width:{barsReady ? row.ratio * 100 : 0}%"></i>
            </div>
            <b>{row.value}</b>
          </div>
        {/each}
        <div
          class="thr"
          id="thr"
          style="left:calc(44px + 10px + (100% - 44px - 34px - 20px) * {gate.thresholdRatio})"
        ></div>
      </div>
      <p class="sub" style="margin-top:10px" id="gateT">
        {#if gate.weakestLabel === null}The balance gate opens once at least two stats have XP.{:else}Weakest
          stat <b style="color:var(--text)">{gate.weakestLabel} {gate.weakestValue}</b>
          {gate.passes ? '≥' : '<'} threshold <b style="color:var(--text)">{gate.threshold}</b> (50%
          of the average).
          {gate.passes
            ? `Thin margin: raise ${gate.weakestLabel} to be safe.`
            : 'Raise the weakest stat before ranking up.'}{/if}
      </p>
    </div>
  </div>
  <div class="ranks" id="ranks">
    {#each rankRows as row, index (row.rank)}
      <article
        class="rk {row.current ? 'cur' : ''} {row.next ? 'nxt' : ''}"
        style="--c:var({row.accent});--i:{index + 5}"
      >
        {#if row.current}<span class="tag">Current</span>{:else if row.next}<span class="tag"
            >Next</span
          >{/if}
        <div class="L">{row.rank}</div>
        <div class="rg">Level {row.levelRange}</div>
        <dl>
          <dt>Freezes per week</dt>
          <dd>{row.freezesPerWeek}</dd>
          <dt>Max points per task</dt>
          <dd>{row.maxPointsPerTask}</dd>
          <dt>Point multiplier</dt>
          <dd>{row.multiplier}</dd>
          <dt>Penalty per missed stat</dt>
          <dd>−{row.penalty}</dd>
        </dl>
      </article>
    {/each}
  </div>
</section>

<section class="panel boot" style="--i:4" aria-labelledby="h-title">
  <div class="row">
    <div>
      <h2 id="h-title">Titles</h2>
      <p class="sub">
        Murni kosmetik. Satu title bisa dipasang pada satu waktu dan tampil di halaman Today.
      </p>
    </div>
  </div>
  <div class="pv">
    <span class="sub">Preview on Today</span><span class="tchip" class:pop={previewPop} id="pv"
      >{preview}</span
    >
  </div>
  <div class="tg3" id="titles">
    {#each titleCards as card (card.id)}
      <article
        class="t {card.unlocked ? 'un' : 'lk'} {card.equipped ? 'eq' : ''} {flashing === card.id
          ? 'flash'
          : ''}"
      >
        <b>{card.name}</b><span class="c">{card.condition}</span>
        <div class="ft">
          {#if card.unlocked}<span class="sub">{card.equipped ? 'Equipped' : 'Unlocked'}</span
            ><button
              class="btn {card.equipped ? 'line' : ''}"
              data-t={card.id}
              aria-pressed={card.equipped}
              style="padding:5px 14px"
              onclick={() => equip(card)}>{card.equipped ? 'Unequip' : 'Equip'}</button
            >{:else}<span class="ic"
              ><svg
                width="13"
                height="14"
                viewBox="0 0 13 14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                aria-hidden="true"
                ><rect x="1.500" y="6" width="10" height="7" rx="1" /><path
                  d="M4 6V4a2.500 2.500 0 015 0v2"
                /></svg
              >Locked</span
            >
            <div
              class="bar"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax={card.progress.max}
              aria-valuenow={card.progress.current}
            >
              <i style="width:{card.progress.ratio * 100}%"></i>
            </div>
            <span class="pp">{card.progress.current}/{card.progress.max}</span>{/if}
        </div>
      </article>
    {/each}
  </div>
</section>

<div class="toast" class:show={toastVisible} id="toast" role="status" aria-live="polite" use:portal>
  {toastText}
</div>
