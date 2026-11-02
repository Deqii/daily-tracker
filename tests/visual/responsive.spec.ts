import { expect, test } from './harness';
import { CONTEXT_OPTIONS, PAGES, THEMES, appUrl, open, protoUrl, settleFrames } from './harness';
import type { Page } from '@playwright/test';

/**
 * Responsive guarantees for every page (UI Revamp Issue 7).
 *
 * Widths span the phone, tablet and desktop breakpoints the prototypes use
 * (320, 360, 390, 768, 1024, 1280, 1920), in both token blocks. The app is
 * asserted; the prototype is measured at the same width so a failure can say
 * whether the reference itself overflows (which is reported, never "fixed").
 *
 * The navigation must stay visible at every width and each nav item must be at
 * least 44px tall below 1024 (Audit decision 2). Below 640, every visible control
 * must be at least 44px in both dimensions and every input must use 16px text
 * (Audit batch 2), so iOS does not zoom the field on focus.
 */

const WIDTHS = [320, 360, 390, 768, 1024, 1280, 1920] as const;
const HEIGHT = 844;

test.use(CONTEXT_OPTIONS);

interface Measures {
  readonly scrollWidth: number;
  readonly innerWidth: number;
  readonly navVisible: boolean;
  readonly navItems: readonly { text: string; height: number }[];
  readonly smallControls: readonly string[];
  readonly smallInputs: readonly string[];
}

async function measurePage(page: Page, width: number): Promise<Measures> {
  await page.setViewportSize({ width, height: HEIGHT });
  await settleFrames(page);
  // Resizing several widths in one page can land before the media queries have
  // repainted under load. Wait until scrollWidth stops changing, which still
  // catches a real overflow because it is stable.
  await page.waitForFunction(() => {
    const probe = (globalThis as unknown as { __layoutProbe?: { width: number; same: number } })
      .__layoutProbe ?? { width: -1, same: 0 };
    const current = document.documentElement.scrollWidth;
    probe.same = current === probe.width ? probe.same + 1 : 0;
    probe.width = current;
    (globalThis as unknown as { __layoutProbe?: typeof probe }).__layoutProbe = probe;

    return probe.same >= 2;
  });

  return page.evaluate(
    ({ width }) => {
      const visible = (element: Element): boolean => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          element.closest('[hidden]') === null
        );
      };

      const key = (element: Element): string => {
        const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
        const label = element.getAttribute('aria-label') ?? '';
        const title = element.getAttribute('title') ?? '';

        return `${element.tagName}|${text}|${label}|${title}`;
      };

      const nav = document.querySelector('header nav');
      const navItems = nav === null ? [] : [...nav.querySelectorAll('a')];

      const controls =
        width < 640
          ? [
              ...document.querySelectorAll<HTMLElement>(
                'button, input, select, textarea, [role="button"], [role="switch"], [role="radio"], [role="tab"]'
              ),
            ].filter(visible)
          : [];

      const smallControls = controls
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return Math.min(rect.width, rect.height) < 44 - 0.5;
        })
        .map(key);

      const inputs =
        width < 640
          ? [...document.querySelectorAll<HTMLInputElement>('input, select, textarea')].filter(
              (element) => visible(element) && element.type !== 'hidden'
            )
          : [];

      const smallInputs = inputs
        .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 16)
        .map(key);

      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        navVisible: nav !== null && visible(nav),
        navItems: navItems.map((item) => ({
          text: (item.textContent ?? '').trim(),
          height: item.getBoundingClientRect().height,
        })),
        smallControls,
        smallInputs,
      };
    },
    { width }
  );
}

for (const theme of THEMES) {
  for (const p of PAGES) {
    test.describe(`responsive ${p.name} ${theme}`, () => {
      test('fits every width and keeps controls usable', async ({ browser }) => {
        const page = await browser.newPage({ viewport: { width: 1280, height: HEIGHT } });
        const prototype = await browser.newPage({ viewport: { width: 1280, height: HEIGHT } });

        await page.addInitScript((value) => {
          try {
            localStorage.setItem('daily-tracker:theme', value);
          } catch {
            // Storage-less contexts still render.
          }
        }, theme);
        await prototype.addInitScript((value) => {
          try {
            localStorage.setItem('daily-tracker:theme', value);
          } catch {
            // Storage-less contexts still render.
          }
        }, theme);

        await open(page, appUrl(p));
        await open(prototype, protoUrl(p));

        const problems: string[] = [];

        for (const width of WIDTHS) {
          const app = await measurePage(page, width);
          const proto = await measurePage(prototype, width);

          if (app.scrollWidth > app.innerWidth + 0.5) {
            if (proto.scrollWidth > proto.innerWidth + 0.5) {
              console.log(
                `[responsive] ${p.name} ${theme} @ ${width}: prototype itself overflows ` +
                  `(${proto.scrollWidth} > ${proto.innerWidth}); app matches and this is reported, not fixed`
              );
            } else {
              problems.push(
                `${width}px: app overflows (scrollWidth ${app.scrollWidth} > innerWidth ${app.innerWidth})`
              );
            }
          }

          if (!app.navVisible) {
            problems.push(`${width}px: navigation is not visible`);
          }

          if (width < 1024) {
            for (const item of app.navItems) {
              if (item.height < 44 - 0.5) {
                problems.push(
                  `${width}px: nav item "${item.text}" is ${item.height.toFixed(1)}px tall (minimum 44)`
                );
              }
            }
          }

          const prototypeSmallControls = new Set(proto.smallControls);

          for (const control of app.smallControls) {
            if (prototypeSmallControls.has(control)) {
              console.log(
                `[responsive] ${p.name} ${theme} @ ${width}: prototype control is under 44px: ${control}`
              );
            } else {
              problems.push(`${width}px: control smaller than 44px: ${control}`);
            }
          }

          const prototypeSmallInputs = new Set(proto.smallInputs);

          for (const input of app.smallInputs) {
            if (prototypeSmallInputs.has(input)) {
              console.log(
                `[responsive] ${p.name} ${theme} @ ${width}: prototype input is under 16px: ${input}`
              );
            } else {
              problems.push(`${width}px: input font-size below 16px: ${input}`);
            }
          }
        }

        expect(problems, `${p.name} ${theme} responsive failures:\n${problems.join('\n')}`).toEqual(
          []
        );

        await page.context().close();
        await prototype.context().close();
      });
    });
  }
}
