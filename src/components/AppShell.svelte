<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { currentRoute, type Route } from '../lib/router';
  import { app } from '../stores/app';
  import { walletDisplay } from '../stores/wallet-display';
  import { motionIsReduced } from '../lib/tween';

  interface NavItem {
    readonly route: Route;
    readonly label: string;
  }

  const navItems: readonly NavItem[] = [
    { route: 'today', label: 'Today' },
    { route: 'tasks', label: 'Tasks' },
    { route: 'rewards', label: 'Rewards' },
    { route: 'history', label: 'History' },
    { route: 'settings', label: 'Settings' },
  ];

  /**
   * `document.body.dataset.page` is the route name, and it is what every page's
   * `@scope (body[data-page="<route>"])` block in `src/styles/ui/*.css` matches
   * on (UI Fidelity Contract: page rules are isolated, not rewritten).
   *
   * The first assignment runs during component initialisation, before this
   * component's markup is inserted and therefore before the first paint: a page
   * must never paint once with its rules missing and then restyle. `$effect`
   * keeps it equal to the route afterwards, on every `hashchange`.
   */
  function syncPageAttribute(route: Route): void {
    if (typeof document !== 'undefined') {
      document.body.dataset.page = route;
    }
  }

  syncPageAttribute(get(currentRoute));

  $effect(() => {
    syncPageAttribute($currentRoute);
  });

  /**
   * Every header value is read from the store, never hardcoded. `rank` is the
   * earned rank (PRD §7.5), `streak` is the display streak including today's
   * completion (PRD §7.4), and the wallet is the coin balance.
   */
  const rank = app.rank;
  const streak = app.streak;

  /**
   * Particle field for `#fx`. Constants, wrap logic and per-theme colour are the
   * prototypes' own (see `docs/prototype/today.html`, "particles" block); only
   * the wiring is Svelte's. Cheap on purpose: 36 squares, no gradients.
   */
  const PARTICLE_COUNT = 36;

  interface Particle {
    x: number;
    y: number;
    r: number;
    v: number;
    a: number;
  }

  onMount(() => {
    if (motionIsReduced()) return;

    const canvas = document.getElementById('fx');

    if (!(canvas instanceof HTMLCanvasElement)) return;

    const cx = canvas.getContext('2d');

    if (cx === null) return;

    const size = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const particles: Particle[] = [];

    let raf = 0;

    const loop = (): void => {
      cx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.y -= p.v;

        if (p.y < -5) {
          p.y = canvas.height + 5;
          p.x = Math.random() * canvas.width;
        }

        cx.fillStyle = `rgba(${
          document.documentElement.dataset.theme === 'light' ? '22,115,201' : '138,219,255'
        },${p.a})`;
        cx.fillRect(p.x, p.y, p.r, p.r);
      }

      raf = window.requestAnimationFrame(loop);
    };

    size();
    window.addEventListener('resize', size);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 2 + 1,
        v: Math.random() * 0.25 + 0.08,
        a: Math.random() * 0.4 + 0.1,
      });
    }

    loop();

    const onVisibilityChange = (): void => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
      } else {
        loop();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  });
</script>

<!--
  App shell (UI Revamp Issue 1). Element order, tags, class names, copy and ARIA
  are the prototypes' `docs/prototype/today.html` body, verbatim; only `href`
  carries the app's hash routes instead of the prototype's demo links.
-->
<canvas id="fx" aria-hidden="true"></canvas>
<div class="scan" aria-hidden="true"></div>

<header>
  <div class="logo">Daily Tracker</div>
  <nav aria-label="Primary">
    {#each navItems as item (item.route)}
      <a href={`#/${item.route}`} aria-current={$currentRoute === item.route ? 'page' : undefined}
        >{item.label}</a
      >
    {/each}
  </nav>
  <div class="chips">
    <div class="chip"><span>Rank</span><b>{$rank}</b></div>
    <div class="chip"><span>Streak</span><b>{$streak}</b></div>
    <div class="chip"><span>Wallet</span><i class="coin"></i><b>{$walletDisplay}</b></div>
  </div>
</header>
