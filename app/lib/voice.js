/* Does this browser have its own speech-to-text (Web Speech API)? Safari on iPhone and Mac, Chrome: yes.
   Firefox and others: no. When it does, Talk it out is the mic (MicButton.svelte) and the
   Voice Memos shortcut tucks away behind Show my dev tools (v2.1.27). */
export const hasSpeech = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
