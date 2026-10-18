<script lang="ts">
  import { heatCells, rewardProgressPercent, rewardShortfall } from '../../lib/today-page';
  import { app } from '../../stores/app';
  import type { Reward } from '../../lib/types';

  /**
   * The bottom strip (UI Revamp Issue 2): the fourteen-day heat strip and the
   * rewards teaser.
   *
   * Every cell comes from the engine's own `dailyQuestLog`; every reward from the
   * stored reward list, in stored order. See DEVIATIONS.md open question Q8: the
   * prototype lists every reward, where `selectRewardPreview` (design §5,
   * decisions D20) would list at most two.
   */

  let cells = $derived(heatCells($app.dailyQuestLog, $app.userState.lastRolloverDate));

  let wallet = $derived($app.userState.wallet);

  function buy(reward: Reward): void {
    if (wallet < reward.cost) return;

    app.purchaseReward(reward.id);
  }
</script>

<div class="bottom">
  <section class="panel boot" style="--i:3">
    <h2>14 hari terakhir</h2>
    <div class="heat">
      {#each cells as cell (cell.date)}
        <i data-l={cell.level} title={cell.title}></i>
      {/each}
    </div>
    <p class="sub" style="margin-top:10px">Merah = hari dengan stat terlewat.</p>
  </section>
  <section class="panel boot" style="--i:4">
    <div class="row">
      <h2>Rewards</h2>
      <span class="sub price"
        >Wallet <span style="color:var(--text)">{wallet}</span><i class="coin"></i></span
      >
    </div>
    <div class="rewards">
      {#each $app.rewards as reward, index (reward.id)}
        {@const canAfford = wallet >= reward.cost}
        <div class="rw">
          <div class="row">
            <b>{reward.title}</b>
            <span class="pts price">{reward.cost}<i class="coin"></i></span>
          </div>
          {#if canAfford}
            <button type="button" class="btn" data-r={index} onclick={() => buy(reward)}
              >Beli</button
            >
          {:else}
            <div
              class="prog"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax={reward.cost}
              aria-valuenow={wallet}
            >
              <i style={`width: ${rewardProgressPercent(wallet, reward.cost)}%`}></i>
            </div>
            <span class="sub">Kurang {rewardShortfall(wallet, reward.cost)} koin</span>
          {/if}
        </div>
      {/each}
    </div>
  </section>
</div>
