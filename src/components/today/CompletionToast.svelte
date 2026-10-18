<script lang="ts">
  /**
   * The completion toast (UI Revamp Issue 2).
   *
   * `today.html` puts this element after `</main>`, as a child of `<body>`, so it
   * is rendered here rather than inside the Today page: `position: fixed` would
   * look the same nested, but the DOM walk the fidelity test compares would not.
   *
   * The toast shows `<task> selesai` for a few seconds after a completion. The
   * "Batalkan" (undo) button is the prototype's; whether it can act on it is
   * open question Q9 in `docs/prototype/DEVIATIONS.md`, because the engine has
   * no way to revert a completion and adding one would be new game behaviour.
   */

  interface ToastProps {
    readonly text?: string;
  }

  let { text = '' }: ToastProps = $props();
</script>

<div class="toast" class:show={text !== ''} role="status" aria-live="polite">
  <span>{text}</span>
  <button type="button">Batalkan</button>
</div>
