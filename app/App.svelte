<script>
  import { onMount } from 'svelte';
  import { startApp } from './lib/app.js';
  import ModePicker from './ModePicker.svelte';
  import ChatBuilder from './ChatBuilder.svelte';
  import StartHelper from './StartHelper.svelte';
  import CoreToggle from './CoreToggle.svelte';
  /* The page markup renders once; app.js wires up the behavior after it mounts. */
  onMount(() => { startApp(); });
</script>

<div class="wrap">
  <header>
    <span class="chip">Nothing is saved</span>
    <h1>Speak to Prompt</h1>
    <svg class="wave" viewBox="0 0 340 30" aria-hidden="true" focusable="false">
      <g class="v">
        <rect style="--i:0" x="0" y="11" width="4" height="8" rx="2"/><rect style="--i:1" x="8" y="6" width="4" height="18" rx="2"/>
        <rect style="--i:2" x="16" y="2" width="4" height="26" rx="2"/><rect style="--i:3" x="24" y="8" width="4" height="14" rx="2"/>
        <rect style="--i:4" x="32" y="4" width="4" height="22" rx="2"/><rect style="--i:5" x="40" y="10" width="4" height="10" rx="2"/>
        <rect style="--i:6" x="48" y="5" width="4" height="20" rx="2"/><rect style="--i:7" x="56" y="1" width="4" height="28" rx="2"/>
        <rect style="--i:8" x="64" y="7" width="4" height="16" rx="2"/><rect style="--i:9" x="72" y="11" width="4" height="8" rx="2"/>
        <rect style="--i:10" x="80" y="9" width="4" height="12" rx="2"/><rect style="--i:11" x="88" y="12" width="4" height="6" rx="2"/>
        <rect style="--i:12" x="96" y="13" width="4" height="4" rx="2"/>
      </g>
      <g class="t">
        <rect style="--i:0" x="112" y="4" width="200" height="4" rx="2"/>
        <rect style="--i:1" x="112" y="13" width="228" height="4" rx="2"/>
        <rect style="--i:2" x="112" y="22" width="140" height="4" rx="2"/>
      </g>
    </svg>
    <p class="lede">Say what's on your mind, messy is fine. Get back a prompt you can paste into any AI to get a great answer.</p>
  </header>

  <form id="form" class="field" novalidate>
    <label for="thoughts">What's on your mind?</label>
    <div class="voice" id="voiceRow">
      <a class="btnlink" id="talkLink" href="shortcuts://run-shortcut?name=Speak%20to%20Prompt">Talk it out</a>
      <a class="filelink" id="fileLink" href="shortcuts://run-shortcut?name=File%20Voice%20Note" hidden>🗂️ File voice note</a>
      <a class="getlink" href="https://www.icloud.com/shortcuts/391f35e4646d443e92a73e098e0e559b" target="_blank" rel="noopener">First time? Get the shortcut</a>
    </div>
    <div id="pasteWrap" class="pastewrap" hidden>
      <button type="button" class="pastebtn" id="bannerPaste">Paste my transcript</button>
      <p id="pasteHelp" hidden>Safari will show a small Paste button. Tap it to bring the full transcript in.</p>
    </div>
    <div class="ideabox">
      <textarea id="thoughts" autocomplete="off" placeholder="Type or paste your thoughts. Messy is fine."></textarea>
      <div class="ideas gone" id="ideas">
        <i class="blob b1"></i><i class="blob b2"></i>
        <div class="panel" id="ideasPanel">
          <div class="ideas-top"><span>Swipe for ideas, or tap to type</span><button type="button" class="ideas-pause" id="ideasPause" aria-pressed="false">Pause</button></div>
          <div class="ideas-track" id="ideasTrack" aria-hidden="true"></div>
          <div class="ideas-bottom"><span id="ideasCat"></span><button type="button" class="ideas-try" id="ideasTry">Try this one</button></div>
        </div>
      </div>
      <button type="button" class="ideas-show" id="ideasShow" hidden>💡 Show ideas</button>
    </div>
    <p id="handoff" class="handoff" hidden>Your transcript came in from the shortcut. Check it, then tap Build my prompt.</p>
    <p id="err" class="error" hidden>Type or paste something first.</p>
    <div class="row buildrow">
      <button type="submit" class="primary" id="build">Build my prompt</button>
      <ModePicker />
      <CoreToggle />
      <div class="starterwrap"><StartHelper /></div>
    </div>
    <div class="tracker" id="buildTrack" hidden>
      <ol aria-label="Progress"><li data-step="read">Read</li><li data-step="ask">Ask</li><li data-step="write">Write</li><li data-step="ready">Ready</li></ol>
      <div class="progress" id="buildProg"><div class="bar"></div></div>
      <div class="nums" aria-live="off"><div><b class="el">0:00</b><small>elapsed</small></div><div class="right"><b class="left">0:00</b><small class="leftlbl">estimated left</small></div></div>
      <p class="detail"></p>
    </div>
    <p id="buildStatus" class="buildstatus" role="status"></p>
  </form>

  <section class="card" id="qa" hidden>
    <ChatBuilder />
    <p id="qaStatus" class="buildstatus" role="status"></p>
  </section>

  <section class="card" id="result" hidden aria-live="polite">
    <h2 id="resultHead">Your prompt is ready</h2>
    <div class="tracker" id="resultTrack" hidden>
      <ol aria-label="Progress"><li data-step="read">Read</li><li data-step="ask">Ask</li><li data-step="write">Write</li><li data-step="ready">Ready</li></ol>
      <div class="progress" id="resultProg"><div class="bar"></div></div>
      <div class="nums" aria-live="off"><div><b class="el">0:00</b><small>elapsed</small></div><div class="right"><b class="left">0:00</b><small class="leftlbl">estimated left</small></div></div>
      <p class="detail"></p>
    </div>
    <p id="madeBy" class="madeby"></p>
    <p id="numWarn" class="numwarn" role="status" hidden></p>
    <p id="chatName" class="chatname" hidden></p>
    <p id="categoryLine" class="chatname" hidden>Category: <b id="categoryName"></b></p>
    <textarea id="output" readonly aria-label="Your prompt"></textarea>
    <div class="row">
      <button type="button" class="primary" id="copy">Copy prompt</button>
      <button type="button" id="reset">Start over</button>
    </div>
    <div class="openrow">
      <span>Copy and open in:</span>
      <a class="openai" href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
      <a class="openai" href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>
      <a class="openai" id="geminiLink" href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a>
    </div>
    <p id="status" class="status"></p>
    <div class="keep">
      <p class="keephead">Want a record of this?</p>
      <div class="row">
        <button type="button" id="saveNote">Save to Notes</button>
        <button type="button" id="saveShare" class="linkish" hidden>Share instead</button>
        <a id="shortcutLink" href="shortcuts://" hidden aria-hidden="true" tabindex="-1">Run shortcut</a>
      </div>
      <p id="keepStatus" class="status"></p>
    </div>
  </section>

  <details class="key" id="keyPanel">
    <summary>Unlock smarter prompts (free, 1 minute)</summary>
    <div class="keybody">
      <p>A key lets Gemini ask you follow-up questions first, so your prompt starts with the full picture. It's free and takes about a minute:</p>
      <ol class="keysteps">
        <li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a> and sign in with any Google account.</li>
        <li>Tap <b>Create API key</b>. Accept the terms if it asks.</li>
        <li>Copy the key it shows you.</li>
        <li>Come back, paste it below, tick <b>Remember my key</b>, and tap <b>Check key</b>.</li>
      </ol>
      <label for="gkey" class="hint">Gemini API key</label>
      <input id="gkey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste your key">
      <label class="check"><input type="checkbox" id="remember"> Remember my key on this phone</label>
      <div class="row">
        <button type="button" class="primary" id="checkKey">Check key</button>
        <button type="button" id="removeKey">Remove key</button>
      </div>
      <p id="keyStatus" role="status"></p>
      <details class="lock">
        <summary>Optional: lock your key to this site</summary>
        <p>If your key ever leaked, it would only work here. In <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Credentials</a>, open your key. Under <b>Application restrictions</b> choose <b>Websites</b> and add <code>https://kmagno94.github.io/*</code>. Under <b>API restrictions</b> choose <b>Generative Language API</b>. Save.</p>
      </details>
      <p>Your key goes only to Google, never to this site. Remembering saves the key only, never your words. On Google's free tier, Google may use what you send to improve its products.</p>
    </div>
  </details>

  <details class="key" id="moreOpts">
    <summary>More options</summary>
    <div class="morebody">
      <div class="how">
        <p class="sub">How it works</p>
        <ol>
          <li><b>Dump it.</b> Type or talk. No need to be clear.</li>
          <li><b>Answer a few taps.</b> With a key, Gemini asks what's missing.</li>
          <li><b>Paste it.</b> Copy your prompt into ChatGPT, Claude, Gemini, or any AI.</li>
        </ol>
        <p class="hint">Talk it out runs the Speak to Prompt shortcut: record in Voice Memos, copy the transcript, and it brings you back here to paste. Afterward it takes you back to Voice Memos to move or delete the recording.</p>
      </div>
      <details class="memo" id="memoGuide">
      <summary>No shortcut? Use Voice Memos by hand</summary>
      <ol>
        <li>Open <b>Voice Memos</b> and tap the red button. Ramble as long as you want, then tap it again to stop.</li>
        <li>Tap the <b>three dots</b> on your recording (or press and hold it), then <b>Copy Transcript</b>. If it isn't there yet, wait a few seconds for the transcript to finish.</li>
        <li>Come back here, press and hold the text box, and tap <b>Paste</b>.</li>
      </ol>
      <p>Needs iOS 18 or later on an iPhone 12 or newer. The transcript is made on your phone.</p>
    </details>
      <div class="stats" id="myShortcutsRow" hidden>
        <label class="check"><input type="checkbox" id="myShortcuts"> Use my Notes shortcuts</label>
        <p class="hint">Save to Notes runs <b>Save Voice Note</b>, and a <b>File voice note</b> button shows up top to send a saved note to Claude. Turn on only if both shortcuts are on this phone.</p>
      </div>
      <div class="stats">
        <label class="check"><input type="checkbox" id="statsToggle"> Show run stats and daily usage</label>
        <p class="hint">For testing. Saves timings and counts on this device, never your words. Turning it off deletes them.</p>
      </div>
    </div>
  </details>

  <details class="key" id="testLog" hidden>
    <summary id="testLogHead">Run stats</summary>
    <div class="statsbody">
    <h3 class="sub">Today's usage <span class="hint" id="usageReset"></span></h3>
    <div id="usage" class="usage"></div>
    <p class="hint" id="usageSource">Counted from runs on this device while stats were on. If a model says it's out for the day, it's marked used up.</p>
    <h3 class="sub">Runs</h3>
    <pre class="runs" id="testRuns"></pre>
    <div class="row">
      <button type="button" class="primary" id="testCopy">Copy log</button>
      <button type="button" id="testClear">Clear log</button>
    </div>
    <p id="testStatus" class="status" role="status"></p>
    </div>
  </details>

  <footer id="footer"><span id="footerLead">This site saves nothing. Close or refresh the tab and everything is gone.</span> If you add a Gemini key, your words go to Google to build your prompt, and nowhere else.</footer>
</div>
