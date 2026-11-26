/* Late-night sleep nudge.
   If a student is on the site between 12:00 am and 1:59 am (by the clock on their own device),
   a small card slides up with how much sleep they need, wake-up times that line up with the end
   of a sleep cycle (to avoid sleep inertia, the groggy feeling), and a short wind-down routine.

   - It shows once per night. "Okay, I'll wrap up" or the close button hides it until tomorrow night.
     "Remind me in 20 min" brings it back once the time is up, if it is still within the window.
   - It never interrupts an exam-style activity or a formative: it waits until that is finished.
   - It does not take over the screen and does not move the keyboard focus.
   - The choice is saved in the browser, so it is shared by every page on the same web address.

   To change the window, edit START_HOUR and END_HOUR below (24-hour clock, END_HOUR is not included).
   To switch it off on one page, add data-off to its script tag: <script src="sleep-nudge.js" data-off></script>

   Teacher preview (ignores the real time and the once-per-night rule):
     add ?sleepnudge=show to any page address, or ?sleepnudge=0030 to pretend it is 12:30 am. */
(function () {
  var me = document.currentScript;
  if (me && me.hasAttribute("data-off")) return;
  try { if (window.top !== window) return; } catch (e) { return; }   // pages shown inside the Focus Room frames stay quiet

  var START_HOUR = 0, END_HOUR = 2;        // 12:00 am up to 1:59 am
  var SNOOZE_MIN = 20;                     // "Remind me" delay
  var FALL_ASLEEP_MIN = 15;                // time it usually takes to drift off
  var CYCLE_MIN = 90;                      // average length of one sleep cycle
  var CYCLES = [4, 5, 6];                  // 6 h, 7.5 h and 9 h of sleep
  var KEY = "p4e:sleepNudge";

  /* ---------- preview mode ---------- */
  var forced = false, fake = null;
  var q = (location.search.match(/[?&]sleepnudge=([^&]*)/) || [])[1];
  if (q) {
    q = decodeURIComponent(q);
    if (q === "show") forced = true;
    else {
      var m = q.match(/^(\d{1,2}):?(\d{2})$/);
      if (m) { forced = true; fake = { h: +m[1], m: +m[2] }; }
    }
  }
  function now() { var d = new Date(); if (fake) d.setHours(fake.h, fake.m, 0, 0); return d; }

  /* ---------- saved state (one record per night) ---------- */
  function today(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === "object" ? s : {}; } catch (e) { return {}; }
  }
  function save(o) { if (forced) return; try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  /* ---------- helpers ---------- */
  function fmt(d) {
    var h = d.getHours(), mi = d.getMinutes(), ap = h < 12 ? "am" : "pm";
    h = h % 12 || 12;
    return h + ":" + (mi < 10 ? "0" : "") + mi + " " + ap;
  }
  function plus(d, min) { return new Date(d.getTime() + min * 60000); }
  function inWindow(d) { return d.getHours() >= START_HOUR && d.getHours() < END_HOUR; }
  function busy() {
    var b = document.body;
    return b.classList.contains("test-running") || b.classList.contains("testing") || !!document.getElementById("bbShell");
  }

  /* ---------- styles ---------- */
  var css =
    "#snCard{position:fixed;left:50%;bottom:16px;z-index:880;width:min(468px,calc(100vw - 20px));max-height:calc(100vh - 32px);overflow:auto;" +
      "transform:translate(-50%,24px);opacity:0;transition:transform .28s ease,opacity .28s ease;" +
      "background:#fff;color:#1a2744;border-radius:16px;border-left:6px solid #C55A11;box-shadow:0 16px 48px rgba(26,39,68,.36);" +
      "font-family:Outfit,Arial,sans-serif;font-size:15px;line-height:1.5}" +
    "#snCard.in{transform:translate(-50%,0);opacity:1}" +
    "#snCard .hd{background:#1F3864;color:#fff;padding:14px 46px 12px 18px;border-radius:10px 10px 0 0;position:sticky;top:0}" +
    "#snCard .hd .eb{font-size:11.5px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;color:#a8c4e0}" +
    "#snCard .hd h2{margin:2px 0 0;font-size:20px;line-height:1.25;font-weight:700}" +
    "#snCard .x{position:absolute;top:10px;right:10px;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:#cfe0f2;font-size:22px;line-height:1;cursor:pointer;padding:0}" +
    "#snCard .x:hover{background:rgba(255,255,255,.16);color:#fff}" +
    "#snCard .bd{padding:14px 18px 6px}" +
    "#snCard p{margin:0 0 10px}" +
    "#snCard h3{margin:12px 0 4px;font-size:12.5px;letter-spacing:1px;text-transform:uppercase;color:#4a6080;font-weight:700}" +
    "#snCard .chips{display:flex;gap:8px;margin:8px 0 6px}" +
    "#snCard .chip{flex:1;border:1.5px solid #b9c9de;background:#DEEAF1;border-radius:10px;padding:8px 4px 7px;text-align:center}" +
    "#snCard .chip b{display:block;font-size:18px;line-height:1.2;color:#1F3864}" +
    "#snCard .chip span{display:block;font-size:13px;color:#33496b}" +
    "#snCard .chip.best{background:#1F3864;border-color:#1F3864}" +
    "#snCard .chip.best b,#snCard .chip.best span{color:#fff}" +
    "#snCard ul{margin:4px 0 8px;padding-left:20px}#snCard li{margin:3px 0}" +
    "#snCard .note{font-size:13px;color:#4a6080}" +
    "#snCard details{margin:6px 0 8px;border-top:1px solid #dbe3ee;padding-top:8px}" +
    "#snCard summary{cursor:pointer;font-weight:700;color:#1F3864}" +
    "#snCard details p{margin:6px 0 0}" +
    "#snCard .src{font-size:12.5px;color:#5d6b82;margin:8px 0 0}" +
    "#snCard .ft{display:flex;gap:10px;flex-wrap:wrap;padding:10px 18px 16px;position:sticky;bottom:0;background:#fff;border-top:1px solid #dbe3ee;border-radius:0 0 12px 12px}" +
    "#snCard .ft button{font:700 15px Outfit,Arial,sans-serif;border-radius:10px;padding:10px 16px;cursor:pointer}" +
    "#snCard .go{border:2px solid #C55A11;background:#C55A11;color:#fff;flex:1 1 auto}#snCard .go:hover{background:#a84a0d;border-color:#a84a0d}" +
    "#snCard .later{border:2px solid #1F3864;background:#fff;color:#1F3864}#snCard .later:hover{background:#DEEAF1}" +
    "#snCard button:focus-visible{outline:3px solid #2E75B6;outline-offset:2px}" +
    "html[data-theme=dark] #snCard{background:#1d2128;color:#e7e9ec;box-shadow:0 16px 48px rgba(0,0,0,.6)}" +
    "html[data-theme=dark] #snCard .ft{background:#1d2128;border-color:#465061}" +
    "html[data-theme=dark] #snCard h3,html[data-theme=dark] #snCard .note,html[data-theme=dark] #snCard .src{color:#aeb5bf}" +
    "html[data-theme=dark] #snCard .chip{background:#26304a;border-color:#465061}" +
    "html[data-theme=dark] #snCard .chip b{color:#e7e9ec}html[data-theme=dark] #snCard .chip span{color:#b9c8ec}" +
    "html[data-theme=dark] #snCard .chip.best{background:#3d63e0;border-color:#5a7dee}" +
    "html[data-theme=dark] #snCard summary{color:#9fb6ff}html[data-theme=dark] #snCard details{border-color:#465061}" +
    "html[data-theme=dark] #snCard .later{background:transparent;color:#9fb6ff;border-color:#6d87e6}html[data-theme=dark] #snCard .later:hover{background:#26304a}" +
    "@media (max-width:600px){#snCard{left:10px;right:10px;bottom:10px;width:auto;transform:translateY(24px)}#snCard.in{transform:translateY(0)}" +
      "#snCard .chip b{font-size:16px}#snCard .ft button{flex:1 1 100%}}" +
    /* The text-size setting zooms the page, which also scales vh units, so shrink the limit to match */
    "html[data-ts=\"1\"] #snCard{max-height:calc((100vh - 32px) / 1.12)}" +
    "html[data-ts=\"2\"] #snCard{max-height:calc((100vh - 32px) / 1.25)}" +
    "html[data-ts=\"3\"] #snCard{max-height:calc((100vh - 32px) / 1.4)}" +
    "@media (prefers-reduced-motion:reduce){#snCard{transition:none}}" +
    "@media print{#snCard{display:none}}";

  /* ---------- the card ---------- */
  var card = null, timer = null;

  function build(d) {
    var asleep = plus(d, FALL_ASLEEP_MIN);
    var chips = CYCLES.map(function (n) {
      var wake = plus(asleep, n * CYCLE_MIN), hrs = n * CYCLE_MIN / 60;
      var tag = n === 6 ? "9 h, in the 8 to 10 h range" : n === 5 ? "7.5 h, just under" : "6 h, a short night";
      return '<div class="chip' + (n === 6 ? " best" : "") + '"><b>' + fmt(wake) + "</b><span>" + tag + "</span></div>";
    }).join("");

    var el = document.createElement("div");
    el.id = "snCard";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Time to wrap up and sleep");
    el.innerHTML =
      '<div class="hd"><div class="eb">Sleep check</div><h2>&#127769; It&rsquo;s ' + fmt(d) + ". Time to wrap up.</h2>" +
      '<button class="x" type="button" aria-label="Close until tomorrow night" title="Close">&times;</button></div>' +
      '<div class="bd">' +
      "<p>Your brain stores what you studied today while you sleep. Stopping now is part of your revision plan.</p>" +
      "<h3>Wake-up times that avoid the fog</h3>" +
      "<p>Students your age need <b>8 to 10 hours</b>. If you are asleep by about <b>" + fmt(asleep) + "</b>, " +
      "these times line up with the end of a sleep cycle, which may help you wake up less groggy:</p>" +
      '<div class="chips">' + chips + "</div>" +
      '<p class="note">Six hours is short for your age. If a short night is all you can manage, still sleep now and keep the same wake-up time every day.</p>' +
      "<h3>Tonight, in five minutes</h3>" +
      "<ul>" +
      "<li>Save your place and close this tab.</li>" +
      "<li>Write tomorrow&rsquo;s to-do list on paper. In one sleep-lab study, people who did this fell asleep about 9 minutes faster.</li>" +
      "<li>Phone across the room, lights low, room cool and quiet.</li>" +
      "</ul>" +
      "<details><summary>Why these times, and waking up without the fog</summary>" +
      "<p>Sleep runs in cycles of about 90 minutes, and being woken in the middle of deep sleep causes grogginess (sleep inertia). " +
      "Cycles vary from about 70 to 110 minutes between people, so treat the times as a guide. " +
      "Getting enough sleep and keeping a regular schedule matter more than hitting an exact cycle.</p>" +
      "<p>When the alarm goes off, get bright light and move around as soon as you can. Grogginess usually fades within about 30 minutes, but it lasts longer when you are short on sleep. " +
      "Waking at about the same time every day also helps your body clock, so keep weekend lie-ins short.</p>" +
      '<p class="src">Sources: American Academy of Sleep Medicine (teen sleep recommendation); Sleep Medicine Reviews (sleep inertia); Scullin et al., 2018 (bedtime writing).</p>' +
      "</details>" +
      "</div>" +
      '<div class="ft"><button class="go" type="button">Okay, I&rsquo;ll wrap up</button>' +
      '<button class="later" type="button">Remind me in ' + SNOOZE_MIN + " min</button></div>";
    return el;
  }

  function close() {
    if (!card) return;
    var c = card; card = null;
    c.classList.remove("in");
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 300);
  }
  function finishTonight() { save({ d: today(now()), s: "done" }); close(); }
  function snooze() {
    var until = Date.now() + SNOOZE_MIN * 60000;
    save({ d: today(now()), s: "snooze", t: until });
    close();
    schedule();
  }

  function show() {
    if (card) return;
    var d = now();
    card = build(d);
    document.body.appendChild(card);
    card.querySelector(".x").onclick = finishTonight;
    card.querySelector(".go").onclick = finishTonight;
    card.querySelector(".later").onclick = snooze;
    card.addEventListener("keydown", function (e) { if (e.key === "Escape") finishTonight(); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (card) card.classList.add("in"); }); });
  }

  /* ---------- when to show ---------- */
  function check() {
    if (card) return;
    var d = now();
    if (!inWindow(d) && !forced) return;
    if (busy()) return;                                   // wait until the exam-style activity or test is finished
    if (!forced) {
      var s = load();
      if (s.d === today(d)) {
        if (s.s === "done") return;
        if (s.s === "snooze" && Date.now() < s.t) return;
      }
    }
    show();
  }
  function schedule() {
    if (timer) clearInterval(timer);
    timer = setInterval(check, 30000);                    // also catches a student who is still here when midnight arrives
  }

  function start() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    check();
    schedule();
    document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
