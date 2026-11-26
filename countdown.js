/* AP Psychology exam countdown.
   A small floating pill in the bottom-left corner that opens into a card (open by default on very wide screens). Students can open or shrink it;
   the choice is remembered in this browser. It hides itself after exam day.
   To change the date, edit EXAM below (year, month, day). */
(function () {
  var EXAM = { y: 2027, m: 5, d: 14 };            // Friday 14 May 2027, Session 2 (afternoon)
  var KEY = "examCountdown:collapsed";

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var exam = new Date(EXAM.y, EXAM.m - 1, EXAM.d);
  var days = Math.round((exam - today) / 86400000);
  if (days < 0) return;                            // exam is over: show nothing

  var dateText = exam.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  var weeks = Math.floor(days / 7), rest = days % 7;
  var weekText = days >= 14 ? weeks + " weeks" + (rest ? " and " + rest + (rest === 1 ? " day" : " days") : "") : "";

  var css =
    "#examCd{position:fixed;left:16px;bottom:16px;z-index:40;font-family:Outfit,Arial,sans-serif;color:#fff}" +
    "#examCd .card{background:#1F3864;border-radius:14px;box-shadow:0 8px 24px rgba(26,39,68,.28);padding:12px 34px 12px 16px;min-width:178px;border-left:5px solid #C55A11;position:relative}" +
    "#examCd .lab{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#a8c4e0;font-weight:700}" +
    "#examCd .num{font-size:38px;font-weight:800;line-height:1.05;margin-top:2px}" +
    "#examCd .num small{font-size:15px;font-weight:600;margin-left:6px;color:#DEEAF1}" +
    "#examCd .wk{font-size:13px;color:#DEEAF1;margin-top:2px}" +
    "#examCd .dt{font-size:12.5px;color:#a8c4e0;margin-top:6px}" +
    "#examCd .x{position:absolute;top:6px;right:6px;width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:#a8c4e0;font-size:16px;line-height:1;cursor:pointer}" +
    "#examCd .x:hover{background:rgba(255,255,255,.12);color:#fff}" +
    "#examCd .pill{display:none;border:0;cursor:pointer;background:#1F3864;color:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-size:14px;font-weight:700;box-shadow:0 6px 18px rgba(26,39,68,.28);border-left:4px solid #C55A11}" +
    "#examCd.mini .card{display:none}#examCd.mini .pill{display:inline-block}" +
    "#examCd .today{font-size:20px;font-weight:800;margin:4px 0 2px}" +
    "@media print{#examCd{display:none}}" +
    "@media (max-width:600px){#examCd{left:10px;bottom:10px}}";

  function build() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var box = document.createElement("div"); box.id = "examCd";
    box.setAttribute("role", "status");
    box.title = "AP Psychology exam: " + dateText + ", afternoon session. Your AP coordinator will confirm the start time.";

    var body;
    if (days === 0) {
      body = '<div class="lab">AP Psychology exam</div><div class="today">It’s exam day!</div><div class="wk">You’ve prepared for this. Good luck.</div>';
    } else {
      body = '<div class="lab">AP Psychology exam</div>' +
             '<div class="num">' + days + '<small>' + (days === 1 ? "day to go" : "days to go") + '</small></div>' +
             (weekText ? '<div class="wk">That’s ' + weekText + '</div>' : "") +
             '<div class="dt">' + dateText + '</div>';
    }
    box.innerHTML = '<div class="card">' + body +
      '<button class="x" type="button" aria-label="Shrink the countdown" title="Shrink">&#8722;</button></div>' +
      '<button class="pill" type="button" aria-label="Show the exam countdown">&#9203; ' +
      (days === 0 ? "Exam day" : days + (days === 1 ? " day" : " days")) + '</button>';
    document.body.appendChild(box);

    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    var mini = saved === null ? window.innerWidth < 1600 : saved === "1";   // full card only on very wide screens
    box.classList.toggle("mini", mini);

    function set(v) { box.classList.toggle("mini", v); try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} }
    box.querySelector(".x").onclick = function () { set(true); };
    box.querySelector(".pill").onclick = function () { set(false); };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
