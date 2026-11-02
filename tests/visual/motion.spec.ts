import { expect, test } from './harness';
import { PAGES, THEMES, appUrl, newIsolatedContext, open, settle, type PageSpec } from './harness';
import type { Browser, Page } from '@playwright/test';

/**
 * Reduced motion and the Settings motion switch (UI Revamp Issue 7).
 *
 * Every page is opened twice: once with `prefers-reduced-motion: reduce` and
 * once with `data-motion="off"` seeded before the app mounts. In both cases no
 * animation may still be running after the settle time, the particle canvas must
 * not paint, and the level-up/rank-up overlay must fade on opacity alone (its
 * scale entrance is replaced by `ov-fade`).
 *
 * The fixture normally writes `daily-tracker:motion = "on"`. The init script
 * below rewrites that one key to `"off"` while the fixture seeds storage, so the
 * app boots with the switch already off, exactly as a returning user would.
 */

type Mode = 'reduced-motion' | 'data-motion-off';

async function openWithMode(
  browser: Browser,
  p: PageSpec,
  mode: Mode,
  state?: string
): Promise<Page> {
  const context = await newIsolatedContext(browser, { width: 1280, height: 800 }, 'dark');

  if (mode === 'data-motion-off') {
    await context.addInitScript(() => {
      const original = Storage.prototype.setItem;

      Storage.prototype.setItem = function setItem(key: string, value: string): void {
        original.call(this, key, key === 'daily-tracker:motion' ? JSON.stringify('off') : value);
      };

      try {
        localStorage.setItem('daily-tracker:motion', JSON.stringify('off'));
      } catch {
        // Storage-less contexts still render.
      }
    });
  }

  const page = await context.newPage();

  await open(page, appUrl(p, state ?? null));

  return page;
}

async function animationState(page: Page): Promise<{
  total: number;
  running: { name: string; state: string }[];
  particleDisplay: string;
}> {
  return page.evaluate(() => ({
    total: document.getAnimations().length,
    running: document
      .getAnimations()
      .filter((animation) => animation.playState === 'running' || animation.playState === 'pending')
      .map((animation) => ({
        name:
          animation instanceof CSSAnimation ? animation.animationName : animation.constructor.name,
        state: animation.playState,
      })),
    particleDisplay: (() => {
      const canvas = document.getElementById('fx');
      return canvas === null ? 'missing' : getComputedStyle(canvas).display;
    })(),
  }));
}

for (const mode of ['reduced-motion', 'data-motion-off'] as const) {
  for (const p of PAGES) {
    test.describe(`motion ${p.name} ${mode}`, () => {
      test('settles with no running animation and no particles', async ({ browser }) => {
        const page = await openWithMode(browser, p, mode);

        try {
          const state = await animationState(page);

          expect(
            state.running,
            `${p.name} still has running animations under ${mode}: ${JSON.stringify(state.running)}`
          ).toEqual([]);
          expect(state.particleDisplay, `${p.name} must not paint particles under ${mode}`).toBe(
            'none'
          );
        } finally {
          await page.context().close();
        }
      });
    });
  }

  for (const theme of THEMES) {
    test.describe(`motion overlay ${theme} ${mode}`, () => {
      test('uses opacity only and stops every animation', async ({ browser }) => {
        const page = await openWithMode(browser, PAGES[0], mode, 'levelup');

        try {
          const overlay = page.locator('.ov');

          await expect(overlay).toHaveCount(1);
          await settle(page, 'motion overlay');

          const styles = await page.evaluate(() => {
            const ov = document.querySelector('.ov');
            const panel = document.querySelector('.ovp');
            const big = document.querySelector('.ovp .big');

            if (ov === null || panel === null || big === null) {
              return null;
            }

            const ovStyle = getComputedStyle(ov);
            const panelStyle = getComputedStyle(panel);
            const bigStyle = getComputedStyle(big);
            const animations = document.getAnimations();

            return {
              ovAnimation: ovStyle.animationName,
              panelAnimation: panelStyle.animationName,
              bigAnimation: bigStyle.animationName,
              panelTransform: panelStyle.transform,
              running: animations
                .filter(
                  (animation) =>
                    animation.playState === 'running' || animation.playState === 'pending'
                )
                .map((animation) =>
                  animation instanceof CSSAnimation ? animation.animationName : 'unknown'
                ),
            };
          });

          expect(
            styles,
            'the level-up overlay did not render its expected elements'
          ).not.toBeNull();

          if (styles === null) return;

          expect(styles.ovAnimation, 'the backdrop may only fade on opacity').toContain('ov-fade');
          expect(styles.panelAnimation, 'the panel may only fade on opacity').toContain('ov-fade');
          expect(styles.panelAnimation, 'the panel must not use the scale entrance').not.toContain(
            'ov-in'
          );
          expect(styles.bigAnimation, 'the number must not pulse').toBe('none');
          expect(styles.panelTransform, 'the panel must not translate or scale').toBe('none');
          expect(styles.running, 'the overlay must be fully settled').toEqual([]);
        } finally {
          await page.context().close();
        }
      });
    });
  }
}
