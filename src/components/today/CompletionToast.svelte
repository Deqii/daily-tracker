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
   * (−60)` for a purchase). Q9 was resolved on 2026-11-01 by removing the
   * prototype's Undo control from both sides: the engine has no way to revert a
   * completion, and adding one would be new game behaviour.
   */
</script>

<div class="toast" class:show={$toastVisible} role="status" aria-live="polite">
  <span>{$toastText}</span>
</div>
