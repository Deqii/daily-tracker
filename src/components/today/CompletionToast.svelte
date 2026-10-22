<script lang="ts">
  import { toastText, toastVisible } from '../../stores/toast';

  /**
   * The completion toast (UI Revamp Issue 2).
   *
   * `today.html` puts this element after `</main>`, as a child of `<body>`, so it
   * is rendered by `App.svelte` rather than inside the Today page:
   * `position: fixed` would look the same nested, but the DOM walk the fidelity
   * test compares would not.
   *
   * The toast names what just happened (`<task> completed`, or `<reward> bought
   * (−60)` for a purchase). The "Undo" button is the prototype's and
   * is rendered verbatim; whether it can act on anything is open question Q9 in
   * `docs/prototype/DEVIATIONS.md`, because the engine has no way to revert a
   * completion and adding one would be new game behaviour. The button is
   * therefore inert, which is the smallest difference from the prototype.
   */
</script>

<div class="toast" class:show={$toastVisible} role="status" aria-live="polite">
  <span>{$toastText}</span>
  <button>Undo</button>
</div>
