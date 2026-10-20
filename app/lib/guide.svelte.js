/* The first-run guide: started from First time? Start here after the practice
   note is copied. Guide.svelte watches the page and moves through the steps. */
class GuideState {
  active = $state(false);
  copied = $state(false);   // the practice note made it to the clipboard
  note = '';

  start(note, copied) { this.note = note; this.copied = copied; this.active = true; }
  stop() { this.active = false; }
}

export const guide = new GuideState();
