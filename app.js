(function () {
  "use strict";
  var app = document.getElementById("app");

  /* ---------- konfiguration ---------- */
  var CONFIG = {
    decks: 6,            // antal kortspil i skoen
    dealerStandsOn: 17,  // dealer trækker under dette tal, står på det og derover (også soft 17)
    blackjackPays: 1.5,  // 3:2
    seats: 3,            // antal spillerpladser ved blackjackbordet
    quizPassPct: 75      // bestået-grænse for quizzen (%)
  };

  /* ---------- hjælpere ---------- */
  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rand(a.length)]; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = rand(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 10);
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.remove(); }, 300);
    }, 2200);
  }
  function chipCls(v) { return v >= 200 ? "c-p" : v >= 100 ? "c-k" : v >= 50 ? "c-b" : "c-g"; }

  /* ---------- kort ---------- */
  var SUITS = [["♠", 0], ["♥", 1], ["♦", 1], ["♣", 0]];
  var RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  function cardVal(r) {
    if (r === "A") return 11;
    if (r === "K" || r === "Q" || r === "J" || r === "10") return 10;
    return +r;
  }
  function makeShoe() {
    var s = [];
    for (var d = 0; d < CONFIG.decks; d++)
      for (var i = 0; i < SUITS.length; i++)
        for (var j = 0; j < RANKS.length; j++)
          s.push({ r: RANKS[j], s: SUITS[i][0], red: SUITS[i][1] === 1 });
    return shuffle(s);
  }
  function total(cards) {
    var t = 0, a = 0;
    cards.forEach(function (c) { t += cardVal(c.r); if (c.r === "A") a++; });
    while (t > 21 && a) { t -= 10; a--; }
    return t;
  }
  function isBlackjack(cards) { return cards.length === 2 && total(cards) === 21; }
  function isSoft17(cards) {
    // A + 6 (eller kombination der giver 17 med et es tællende 11)
    if (total(cards) !== 17) return false;
    var raw = 0, aces = 0;
    cards.forEach(function (c) { raw += cardVal(c.r); if (c.r === "A") aces++; });
    return aces > 0 && raw === 17; // et es tæller stadig 11
  }

  /* =========================================================
     RENE UDBETALINGSFUNKTIONER — én kilde til sandhed for logik.
     Bruges af bordet og selvtesten.
     ========================================================= */

  /* Blackjack: udfald for én hånd mod dealerens kort */
  function bjNatural(h) { return h.cards.length === 2 && total(h.cards) === 21 && !h.split && !h.doubled; }
  function bjOutcome(h, dealerCards) {
    var st = total(h.cards), dt = total(dealerCards);
    var dNat = isBlackjack(dealerCards), sNat = bjNatural(h);
    if (st > 21) return "lose";              // spiller bust → altid tab
    if (sNat && dNat) return "push";          // begge blackjack
    if (sNat) return "bj";                    // ægte blackjack slår alt andet
    if (dNat) return "lose";                  // dealer blackjack, spiller uden
    if (dt > 21) return "win";                // dealer bust
    if (st > dt) return "win";
    if (st === dt) return "push";
    return "lose";
  }
  /* Blackjack: hvad spilleren skal have — { out, stake, profit, totalReturn } */
  function bjPayout(h, dealerCards) {
    var out = bjOutcome(h, dealerCards), stake = h.bet;
    if (out === "bj") return { out: out, stake: stake, profit: stake * CONFIG.blackjackPays, totalReturn: stake + stake * CONFIG.blackjackPays };
    if (out === "win") return { out: out, stake: stake, profit: stake, totalReturn: stake * 2 };
    if (out === "push") return { out: out, stake: stake, profit: 0, totalReturn: stake };
    return { out: out, stake: stake, profit: -stake, totalReturn: 0 };
  }
  /* Dealerens træk-regel: sandt hvis dealeren skal trække endnu et kort */
  function dealerMustDraw(cards) {
    return total(cards) < CONFIG.dealerStandsOn; // står på alle 17 (også soft 17)
  }
  function cardMarkup(c, o) {
    o = o || {};
    var cls = "pc";
    if (o.back) cls += " pc--back";
    else if (c.red) cls += " pc--red";
    if (o.fresh) cls += " pc--in";
    if (o.flip) cls += " pc--flip";
    var st = o.delay ? ' style="animation-delay:' + o.delay.toFixed(2) + 's"' : "";
    return '<div class="' + cls + '"' + st + ">" + (o.back ? "" : "<i>" + c.r + "</i><b>" + c.s + "</b>") + "</div>";
  }

  /* ---------- router ---------- */
  function route() {
    var hash = location.hash.replace(/^#\/?/, "");
    window.scrollTo(0, 0);
    if (hash === "tutorial") return renderTutorial();
    if (hash === "bord") return renderTable();
    if (hash === "quiz") return renderQuiz();
    if (hash === "selvtest") return renderSelfTest();
    renderHome();
  }
  window.addEventListener("hashchange", route);

  /* ---------- forside ---------- */
  function renderHome() {
    app.innerHTML =
      '<div class="home">' +
      "<p>Øv dig i at være dealer.</p>" +
      '<div class="menu">' +
      '<a class="big" href="#/tutorial">Tutorial</a>' +
      '<a class="big" href="#/bord">Bordet</a>' +
      '<a class="big" href="#/quiz">Quiz</a>' +
      "</div></div>";
  }

  /* ---------- tutorial ---------- */
  var tutGame = "bj";
  function renderTutorial() {
    app.innerHTML =
      "<h1>Tutorial</h1>" +
      gameToggle(tutGame, function (g) { tutGame = g; renderTutorial(); }) +
      (tutGame === "bj" ? tutBJ() : tutRO());
  }
  function mc(r, s, red) { return cardMarkup({ r: r, s: s, red: red }, {}); }
  function C(r, s) { return { r: r, s: s, red: s === "♥" || s === "♦" }; } // kort-hjælper til selvtesten
  function tutBJ() {
    return '<div class="tut">' +
      "<h2>Sådan ser en runde ud</h2>" +
      '<div class="tut-demo">' +
        '<div><div class="bname">Dealer</div><div class="bhand">' + mc("K", "♠") + cardMarkup({}, { back: true }) +
          '</div><div class="tut-note">ét kort ligger skjult</div></div>' +
        '<div><div class="bname">Spiller</div><div class="bhand">' + mc("9", "♥", true) + mc("7", "♣") +
          '</div><div class="bval">16</div></div>' +
      "</div>" +
      "<h2>Sådan deler du kort ud</h2>" +
      "<p>Ét kort ad gangen. Du går <b>hele vejen rundt til spillerne først</b>, så dig selv — og så en runde til, samme vej.</p>" +
      '<div class="tut-rows">' +
        "<div><span>Kort 1</span><b>Spiller 1</b></div>" +
        "<div><span>Kort 2</span><b>Spiller 2</b></div>" +
        "<div><span>Kort 3</span><b>Spiller 3</b></div>" +
        "<div><span>Kort 4</span><b>Dig (op)</b></div>" +
        "<div><span>Kort 5</span><b>Spiller 1</b></div>" +
        "<div><span>Kort 6</span><b>Spiller 2</b></div>" +
        "<div><span>Kort 7</span><b>Spiller 3</b></div>" +
        "<div><span>Kort 8</span><b>Dig (bagsiden op)</b></div>" +
      "</div>" +
      "<p>Så har alle 2 kort, og dit ene kort ligger skjult. På bordet klikker du på den spiller (eller dig selv) der skal have kortet — ét kort ad gangen.</p>" +
      "<h2>Det gør du</h2>" +
      '<ol class="steps">' +
        "<li>Del kortene ud i rækkefølgen ovenfor — klik på den der skal have kortet.</li>" +
        "<li>Spillerne beder om kort ét ad gangen. Klik på pladsen for at give kortet. Går de over 21, har de tabt med det samme.</li>" +
        "<li>Din tur: klik på din egen plads for at vende dit skjulte kort og trække. Du tager kort til du har <b>17 eller mere</b>, så stopper du.</li>" +
        "<li>Sammenlign din hånd med hver spiller og betal ud.</li>" +
      "</ol>" +
      "<h2>Hvem vinder?</h2>" +
      '<div class="tut-rows">' +
        '<div><span>Spiller 20 · dig 18</span><b>Spilleren vandt</b></div>' +
        '<div><span>Spiller 17 · dig 20</span><b>Spilleren tabte</b></div>' +
        '<div><span>Spiller 19 · dig 19</span><b>Uafgjort</b></div>' +
        '<div><span>Spiller over 21</span><b>Spilleren tabte</b></div>' +
        '<div><span>Du er over 21</span><b>Alle tilbage vandt</b></div>' +
      "</div>" +
      "<h2>Blackjack er noget særligt</h2>" +
      "<p>En <b>blackjack</b> er <b>21 på de 2 første kort</b> fra uddelingen. Den slår alt andet — også din egen 21 på flere kort — og betaler <b>halvanden gang</b>.</p>" +
      '<div class="tut-rows">' +
        '<div><span>Spiller blackjack · dig 21 på 3 kort</span><b class="win">Spilleren vandt (halvanden gang)</b></div>' +
        '<div><span>Spiller <b>og</b> dig blackjack</span><b>Uafgjort — indsats tilbage</b></div>' +
        '<div><span>Spiller 21 på 3 kort · dig 21</span><b>Uafgjort</b></div>' +
        '<div><span>Split-hånd med A + 10 = 21</span><b>Kun 21, ikke blackjack — betales 1:1</b></div>' +
      "</div>" +
      "<h2>Så meget betaler du</h2>" +
      '<ul class="steps">' +
        "<li><b>Spilleren vandt:</b> betal det samme som indsatsen. Satsede 100 → giv 100.</li>" +
        "<li><b>Blackjack der vinder:</b> betal halvanden gang. Satsede 100 → giv 150.</li>" +
        "<li><b>Uafgjort</b> (også hvis begge har blackjack): rør ikke — spilleren beholder sin indsats.</li>" +
        "<li><b>Spilleren tabte:</b> tag chippene ind.</li>" +
      "</ul>" +
      "<h2>Double</h2>" +
      "<p>En <b>double</b> er når spilleren fordobler sin indsats midt i hånden mod kun at få ét kort mere.</p>" +
      "<p><b>Hvornår må de?</b> Kun på deres <b>2 første kort</b> — før de har taget et eneste ekstra kort. Har spilleren allerede sagt “kort” én gang, er muligheden væk.</p>" +
      "<p><b>Hvad gør du?</b> Spilleren lægger en bunke chips mere ud, lige så stor som den første. Du giver dem <b>præcis ét</b> kort — ikke flere. Hånden er slut med det samme, uanset hvor lavt de ender.</p>" +
      '<div class="tut-demo">' +
        '<div><div class="bname">Før</div><div class="bhand">' + mc("6", "♦", true) + mc("5", "♣") +
          '</div><div class="bval">11 · indsats 100</div></div>' +
        '<div class="tut-arrow">→</div>' +
        '<div><div class="bname">Double: ét kort</div><div class="bhand">' + mc("6", "♦", true) + mc("5", "♣") + mc("9", "♠") +
          '</div><div class="bval">20 · indsats 200</div></div>' +
      "</div>" +
      "<p><b>Hvorfor gør spillere det?</b> Når de starter stærkt — typisk 9, 10 eller 11 — og tror ét kort giver en god hånd. Med 9, 10 eller 11 kan de ikke gå over 21 på det ene kort, så det er en oplagt chance for at få dobbelt så meget hjem.</p>" +
      "<p><b>Sådan gør du op:</b> helt som en almindelig hånd — bare med den fordoblede indsats.</p>" +
      '<ul class="steps">' +
        "<li>Spilleren vandt → betal den fordoblede indsats (100 → 200 → betal 200).</li>" +
        "<li>Uafgjort → lad de fordoblede chips stå.</li>" +
        "<li>Spilleren tabte eller kom over 21 → tag hele den fordoblede indsats ind.</li>" +
      "</ul>" +
      "<h2>Split</h2>" +
      "<p>Et <b>split</b> er når spilleren deler sine to første kort til <b>to hænder</b> og spiller dem hver for sig.</p>" +
      "<p><b>Hvornår må de?</b> Kun når de 2 første kort er <b>to ens kort</b> (fx to 8'ere eller to konger).</p>" +
      "<p><b>Hvad gør du?</b> Del kortene til to hænder. Spilleren lægger <b>en indsats mere</b>, lige så stor som den første. Giv et nyt kort til hver hånd, og lad spilleren spille dem færdige én ad gangen.</p>" +
      '<div class="tut-demo">' +
        '<div><div class="bname">Før</div><div class="bhand">' + mc("8", "♠") + mc("8", "♥", true) +
          '</div><div class="bval">indsats 100</div></div>' +
        '<div class="tut-arrow">→</div>' +
        '<div><div class="bname">Hånd 1 · 100</div><div class="bhand">' + mc("8", "♠") + mc("K", "♦", true) +
          '</div><div class="bval">18</div></div>' +
        '<div><div class="bname">Hånd 2 · 100</div><div class="bhand">' + mc("8", "♥", true) + mc("3", "♣") +
          '</div><div class="bval">11</div></div>' +
      "</div>" +
      "<p><b>Sådan gør du op:</b> hver hånd gøres op <b>for sig</b> mod din hånd — den ene kan vinde mens den anden taber.</p>" +
      '<p class="tut-note">Slå double og split til/fra med afkrydsningsfeltet nederst på bordet. På bordet fortæller banneren hvad spilleren vil, og du klikker på pladsen for at give kortene.</p>' +
      "</div>";
  }
  function tutRO() {
    function n(x) { return '<span class="tnum ' + color(x) + '">' + x + "</span>"; }
    return '<div class="tut">' +
      "<h2>Det gør du</h2>" +
      '<ol class="steps">' +
        "<li>Spillerne lægger chips på bordet, mens hjulet kører.</li>" +
        "<li>Sig “ingen flere indsatser” og slip kuglen.</li>" +
        "<li>Læg markøren på det tal der kom.</li>" +
        "<li>Tag de tabende chips ind. Betal dem der vandt.</li>" +
      "</ol>" +
      "<h2>Hvad dækker en indsats?</h2>" +
      "<p>Hvert tal har en <b>farve</b> (rød eller sort), er <b>lige</b> eller <b>ulige</b>, og er <b>lavt</b> (1–18) eller <b>højt</b> (19–36). En indsats vinder, hvis kuglens tal passer.</p>" +
      '<div class="tut-ex">' +
        "<p>Kuglen lander på " + n(17) + " — sort, ulige, lav (1–18).</p>" +
        '<div class="tut-rows">' +
          '<div><span>Indsats på sort</span><b class="win">vandt</b></div>' +
          '<div><span>Indsats på rød</span><b class="lose">tabte</b></div>' +
          '<div><span>Indsats på ulige</span><b class="win">vandt</b></div>' +
          '<div><span>Indsats på 1–18</span><b class="win">vandt</b></div>' +
          '<div><span>Indsats på tallet 17</span><b class="win">vandt — betal 35 gange</b></div>' +
          '<div><span>Indsats på 1. dusin (1–12)</span><b class="lose">tabte</b></div>' +
          '<div><span>Indsats på 2. dusin (13–24)</span><b class="win">vandt — betal dobbelt</b></div>' +
        "</div>" +
      "</div>" +
      "<h2>Så meget betaler du</h2>" +
      '<ul class="steps">' +
        "<li>Ét tal: 35 gange indsatsen</li>" +
        "<li>Rød/sort, lige/ulige, 1–18 / 19–36: det samme som indsatsen</li>" +
        "<li>Dusin eller kolonne (12 tal): det dobbelte</li>" +
      "</ul></div>";
  }

  function gameToggle(cur, onChange) {
    var wrap = '<div class="toggle">' +
      '<button data-g="bj"' + (cur === "bj" ? ' class="on"' : "") + ">Blackjack</button>" +
      '<button data-g="ro"' + (cur === "ro" ? ' class="on"' : "") + ">Roulette</button></div>";
    setTimeout(function () {
      document.querySelectorAll(".toggle button").forEach(function (b) {
        b.onclick = function () { onChange(b.getAttribute("data-g")); };
      });
    }, 0);
    return wrap;
  }

  /* ---------- bordet ---------- */
  var tableGame = "bj";
  function renderTable() {
    app.innerHTML =
      "<h1>Bordet</h1>" +
      gameToggle(tableGame, function (g) { tableGame = g; renderTable(); }) +
      '<div id="felt"></div>';
    if (tableGame === "bj") renderBJ(); else renderRO();
  }

  /* ===== Blackjack ===== */
  var bj = null;
  var bjExtra = (function () {
    try { return localStorage.getItem("bj_extra") !== "0"; } catch (e) { return true; }
  })();

  var N_SEATS = CONFIG.seats;
  function bjThr() { return pick([15, 16, 17, 17]); } // bottens standgrænse (kun visuel spilleropførsel)
  function bjCanToggle() { return !bj || bj.phase === "settle" || (bj.phase === "dealing" && bj.step === 0); }
  function bjNew() {
    var shoe = makeShoe();
    var seats = [];
    for (var si = 1; si <= N_SEATS; si++) {
      var bet = pick([20, 50, 100, 200]);
      var c = [shoe.pop(), shoe.pop()];
      var seat = { name: "Spiller " + si, hands: [{ cards: c, bet: bet, shown: 0 }], move: null };
      if (bjExtra) {
        var t = total(c);
        if (c[0].r === c[1].r && Math.random() < 0.5) seat.move = { type: "split", pair: c[0].r, aces: c[0].r === "A" };
        else if ((t === 9 || t === 10 || t === 11) && Math.random() < 0.5) seat.move = { type: "double" };
      }
      seats.push(seat);
    }
    bj = {
      shoe: shoe, seats: seats, dealer: [shoe.pop(), shoe.pop()], dShown: 0,
      phase: "dealing", step: 0, flip: false, holeUp: false, answers: {},
      pi: 0, act: null, dact: null
    };
  }

  /* Uddelingsrækkefølge: 1. kort rundt til alle spillere, så dealer — så 2. kort samme vej */
  function bjDealTotal() { return N_SEATS * 2 + 2; }
  function bjPlayerShown(i) { return (bj.step > i ? 1 : 0) + (bj.step > i + N_SEATS + 1 ? 1 : 0); }
  function bjDealerShown() { return (bj.step > N_SEATS ? 1 : 0) + (bj.step > N_SEATS * 2 + 1 ? 1 : 0); }
  function bjDealStep(step) {
    if (step < N_SEATS) return { target: "p" + step, label: "1. kort til " + bj.seats[step].name };
    if (step === N_SEATS) return { target: "d", label: "1. kort til dig" };
    if (step < N_SEATS * 2 + 1) return { target: "p" + (step - N_SEATS - 1), label: "2. kort til " + bj.seats[step - N_SEATS - 1].name };
    return { target: "d", label: "2. kort til dig — læg det med bagsiden op" };
  }

  /* ---- spillernes tur ---- */
  function bjHandAction(hi) {
    var h = bj.seats[bj.pi].hands[hi];
    if (!h.thr) h.thr = bjThr();
    var t = total(h.cards);
    if (t > 21) return { kind: "bust", hi: hi };
    if (t < h.thr && t < 21) return { kind: "hit", hi: hi };
    return { kind: "stand", hi: hi };
  }
  function bjBeginSeat() {
    var seat = bj.seats[bj.pi];
    if (seat.move && seat.move.type === "split") bj.act = { kind: "split" };
    else if (seat.move && seat.move.type === "double") bj.act = { kind: "double" };
    else bj.act = bjHandAction(0);
  }
  function bjStartPlay() {
    bj.pi = 0;
    // dealeren kigger på sit skjulte kort når det synlige er højt — har hun blackjack, er hånden slut
    if (isBlackjack(bj.dealer)) { bj.phase = "dealerpeek"; bj.holeUp = true; }
    else { bj.phase = "players"; bjBeginSeat(); }
  }
  function bjAdvanceAfterHand(hi) {
    var seat = bj.seats[bj.pi];
    if (hi + 1 < seat.hands.length) bj.act = bjHandAction(hi + 1);
    else {
      bj.pi++;
      if (bj.pi >= bj.seats.length) { bj.phase = "dealer"; bj.dact = { kind: "reveal" }; }
      else bjBeginSeat();
    }
  }
  function bjSeatClick() {
    var seat = bj.seats[bj.pi], a = bj.act;
    if (a.kind === "split") {
      var c = seat.hands[0].cards, bet = seat.hands[0].bet;
      seat.hands = [
        { cards: [c[0]], bet: bet, shown: 0, split: true },
        { cards: [c[1]], bet: bet, shown: 0, split: true }
      ];
      bj.act = { kind: "splitdeal", hi: 0 };
    } else if (a.kind === "splitdeal") {
      seat.hands[a.hi].cards.push(bj.shoe.pop());
      if (a.hi === 0) bj.act = { kind: "splitdeal", hi: 1 };
      else if (seat.move && seat.move.aces) bj.act = { kind: "splitaces" };
      else bj.act = bjHandAction(0);
    } else if (a.kind === "splitaces") {
      bjAdvanceAfterHand(1);   // esser efter split får præcis ét kort hver — ingen flere handlinger
    } else if (a.kind === "double") {
      var h = seat.hands[0];
      h.cards.push(bj.shoe.pop());
      h.bet *= 2; h.doubled = true;
      bj.act = { kind: "doubledone", hi: 0 };
    } else if (a.kind === "hit") {
      seat.hands[a.hi].cards.push(bj.shoe.pop());
      bj.act = bjHandAction(a.hi);
    } else {
      bjAdvanceAfterHand(a.hi);
    }
    renderBJ();
  }
  function bjActMsg() {
    var seat = bj.seats[bj.pi], a = bj.act, multi = seat.hands.length > 1;
    var hand = multi && a.hi != null ? " · Hånd " + (a.hi + 1) : "";
    if (a.kind === "split") return seat.name + " har to ens kort og vil <b>splitte</b>. Klik pladsen for at dele kortene i to hænder.";
    if (a.kind === "splitdeal") return "Giv <b>Hånd " + (a.hi + 1) + "</b> sit andet kort. Klik pladsen." +
      (seat.move && seat.move.aces ? " (Split på esser: kun ét kort pr. hånd.)" : "");
    if (a.kind === "splitaces") return seat.name + " har splittet <b>esser</b> og fået ét kort på hver hånd. Der gives ikke flere kort. Klik pladsen for at gå videre.";
    if (a.kind === "double") return seat.name + " vil lave en <b>double</b> — fordoble indsatsen mod ét kort. Klik pladsen for at give kortet.";
    if (a.kind === "doubledone") return seat.name + " har " + total(seat.hands[0].cards) + " og er færdig. Klik pladsen for at gå videre.";
    if (a.kind === "hit") return seat.name + hand + " vil have <b>kort</b>. Klik pladsen.";
    if (a.kind === "bust") return seat.name + hand + " er <b>over 21</b> (" + total(seat.hands[a.hi].cards) + "). Klik pladsen for at gå videre.";
    return seat.name + hand + " <b>står</b> på " + total(seat.hands[a.hi].cards) + ". Klik pladsen for at gå videre.";
  }

  /* ---- dealerens tur ---- */
  function bjDealerClick() {
    var d = bj.dact;
    if (d.kind === "reveal") { bj.holeUp = true; bj.flip = true; bj.dact = dealerMustDraw(bj.dealer) ? { kind: "hit" } : { kind: "stand" }; }
    else if (d.kind === "hit") { bj.dealer.push(bj.shoe.pop()); bj.dact = dealerMustDraw(bj.dealer) ? { kind: "hit" } : { kind: "stand" }; }
    else bj.phase = "settle";
    renderBJ();
  }
  function bjDealerMsg() {
    var t = total(bj.dealer);
    if (bj.dact.kind === "reveal") return "Vend dit skjulte kort. Klik din plads.";
    if (bj.dact.kind === "hit") return "Du har " + t + " — du skal trække til mindst " + CONFIG.dealerStandsOn + ". Klik din plads for at give dig selv et kort.";
    var soft = isSoft17(bj.dealer) ? " (soft " + t + " — dealeren står også her)" : "";
    return "Du har " + t + (t > 21 ? " (over 21)" : soft) + " — bliv stående. Klik din plads for at gøre op.";
  }

  function bjResult(h) { return bjOutcome(h, bj.dealer); }
  function bjPick(correct) {
    return correct === "lose" ? "lost" : correct === "push" ? "tie" : "won";
  }
  /* Kort forklaring på HVORFOR udfaldet blev sådan */
  function bjWhy(h, dealerCards) {
    var st = total(h.cards), dt = total(dealerCards);
    var out = bjOutcome(h, dealerCards);
    var dNat = isBlackjack(dealerCards), sNat = bjNatural(h);
    if (out === "bj") return "Spilleren har blackjack — 21 på de 2 første kort. Det slår dealerens " + dt + ".";
    if (out === "push" && sNat && dNat) return "Både spilleren og dealeren har blackjack.";
    if (out === "push") return "Både spilleren og dealeren har " + st + ".";
    if (out === "win" && dt > 21) return "Dealeren er gået over 21 (" + dt + "). Alle spillere der ikke selv er bust, vinder.";
    if (out === "win") return "Spilleren har " + st + ", dealeren " + dt + ". Spilleren er tættest på 21.";
    if (st > 21) return "Spilleren er gået over 21 (" + st + ") — hånden har tabt, uanset dealerens hånd.";
    if (dNat) return "Dealeren har blackjack (21 på 2 kort). Alle uden blackjack taber.";
    return "Spilleren har " + st + ", dealeren " + dt + ". Dealeren er tættest på 21.";
  }
  /* Struktureret udbetalingstekst — tydelig for en ny dealer */
  function bjPayoutHTML(h, dealerCards) {
    var p = bjPayout(h, dealerCards), s = p.stake;
    if (p.out === "bj") return '<b>BLACKJACK – GEVINST: ' + fmt(p.profit) + "</b><br>Spillerens indsats: " + s +
      "<br>SAMLET RETUR: " + fmt(p.totalReturn);
    if (p.out === "win") return "<b>GEVINST: " + s + "</b><br>Spillerens indsats: " + s +
      "<br>SAMLET RETUR: " + p.totalReturn;
    if (p.out === "push") return "<b>PUSH</b> – spilleren får sin indsats på " + s + " tilbage. Ingen gevinst, intet tab.";
    return "<b>TABT</b> – inddrag spillerens indsats på " + s + ".";
  }
  function fmt(n) { return Number.isInteger(n) ? "" + n : n.toFixed(1); }

  function renderBJ() {
    if (!bj) bjNew();
    var felt = document.getElementById("felt");
    var ph = bj.phase;
    var dealing = ph === "dealing", playing = ph === "players", dturn = ph === "dealer",
      peek = ph === "dealerpeek", settle = ph === "settle";
    var stepInfo = dealing ? bjDealStep(bj.step) : null;
    var holeShown = bj.holeUp || settle;
    var dt = total(bj.dealer);

    var dCount = dealing ? bjDealerShown() : bj.dealer.length;
    var dealerCards = bj.dealer.slice(0, dCount).map(function (c, i) {
      var hole = i === 1;
      return cardMarkup(c, {
        back: !holeShown && hole,
        fresh: i >= bj.dShown && !( !holeShown && hole),
        flip: hole && bj.flip
      });
    }).join("");
    var dealerTargeted = (dealing && stepInfo.target === "d") || dturn || peek;

    var totalHands = 0, doneHands = 0;
    var seatsHTML = bj.seats.map(function (s, idx) {
      var multi = s.hands.length > 1;
      var isCurrent = playing && idx === bj.pi;
      var handsHTML = s.hands.map(function (h, hi) {
        totalHands++;
        var key = idx + "-" + hi;
        var a = bj.answers[key] || {};
        if (a.done) doneHands++;
        var settled = settle && a.done;
        var correct = settle ? bjResult(h) : null;
        var shownCount = dealing ? bjPlayerShown(idx) : h.cards.length;
        var vis = h.cards.slice(0, shownCount);
        var st = total(vis);
        var cards = vis.map(function (c, i) {
          return cardMarkup(c, { fresh: i >= h.shown, delay: 0 });
        }).join("");

        var loseCls = (settled && correct === "lose") ? " chip--gone" : "";
        function chipEl(v, ex) { return '<span class="chip ' + chipCls(v) + (ex || "") + '">' + v + "</span>"; }
        var spot = '<div class="bspot">';
        if (h.doubled) spot += chipEl(h.bet / 2, loseCls) + chipEl(h.bet / 2, loseCls);
        else spot += chipEl(h.bet, loseCls);
        if (settled && correct === "win") spot += '<span class="bpay">+</span>' + chipEl(h.bet, " chip--won");
        else if (settled && correct === "bj") spot += '<span class="bpay">+</span>' + chipEl(h.bet * 1.5, " chip--won");
        else if (settled && correct === "push") spot += '<span class="bpay">uafgjort</span>';
        else if (settled && correct === "lose") spot += '<span class="bpay">inddrages</span>';
        spot += "</div>";

        var tag = h.doubled ? '<span class="btag">DOUBLE</span>' : (h.split ? '<span class="btag">SPLIT</span>' : "");
        var extra = "";
        if (settle) {
          if (a.done) extra = '<div class="rowmsg ' + (a.ok ? "ok" : "bad") + '">' + a.text + "</div>";
          else extra = '<div class="btns3">' +
            '<button data-key="' + key + '" data-pick="won">Vandt</button>' +
            '<button data-key="' + key + '" data-pick="tie">Lige</button>' +
            '<button data-key="' + key + '" data-pick="lost">Tabte</button></div>';
        }
        var valLine = (dealing && shownCount === 0)
          ? '<div class="bval bval--wait">venter</div>'
          : (shownCount > 0 ? '<div class="bval">' + st + (st > 21 ? " · over" : "") + (tag ? " " + tag : "") + "</div>" : "");
        return '<div class="bhandbox">' +
          (multi ? '<div class="bsub">Hånd ' + (hi + 1) + "</div>" : "") +
          '<div class="bhand">' + cards + "</div>" +
          valLine + spot + extra + "</div>";
      }).join("");

      var targeted = (dealing && stepInfo.target === "p" + idx) || isCurrent;
      return '<div class="bseat' + (targeted ? " is-target" : "") + (targeted ? " is-click" : "") +
        '" data-seatidx="' + idx + '"><div class="bname">' + s.name + "</div>" +
        '<div class="bhands' + (multi ? " split" : "") + '">' + handsHTML + "</div></div>";
    }).join("");

    var ctrl = "";
    if (settle && doneHands === totalHands)
      ctrl = '<button class="primary" id="bjNext">Ny hånd</button>';

    var bar = "";
    if (dealing) {
      bar = '<div class="bdealbar"><span class="bdealbar__step">Uddeling · kort ' + (bj.step + 1) + " af " + bjDealTotal() +
        '</span><span class="bdealbar__what">Giv ' + stepInfo.label + "</span>" +
        '<span class="bdealbar__hint">Ét kort ad gangen: hele vejen rundt til spillerne, så dig — og så en runde til.</span></div>';
    } else if (playing) {
      bar = '<div class="bdealbar"><span class="bdealbar__step">Spillernes tur</span>' +
        '<span class="bdealbar__what">' + bjActMsg() + "</span></div>";
    } else if (dturn) {
      bar = '<div class="bdealbar"><span class="bdealbar__step">Din tur</span>' +
        '<span class="bdealbar__what">' + bjDealerMsg() + "</span></div>";
    } else if (peek) {
      bar = '<div class="bdealbar"><span class="bdealbar__step">Dealeren kigger</span>' +
        '<span class="bdealbar__what">Dit synlige kort er højt, så du kigger på det skjulte — og du <b>har blackjack</b> (' + dt + '). Hånden er slut. Klik din plads for at gøre op.</span></div>';
    }

    felt.innerHTML =
      '<div class="bjfelt">' +
      '<div class="brandmark">MARTEC CASINO</div>' +
      '<div class="shoe"></div>' +
      bar +
      '<div class="bdealer' + (dealerTargeted ? " is-target is-click" : "") + '" data-dealer="1"><div class="bname">Dealer</div>' +
      '<div class="bhand">' + dealerCards + "</div>" +
      (holeShown ? '<div class="bval">' + dt + (dt > 21 ? " · over" : "") + "</div>" : "") +
      "</div>" +
      '<div class="bseats">' + seatsHTML + "</div>" +
      (ctrl ? '<div class="controls">' + ctrl + "</div>" : "") +
      '<label class="bjopt"><input type="checkbox" id="bjExtra"' + (bjExtra ? " checked" : "") +
      (bjCanToggle() ? "" : " disabled") + "> Spil med split og double" +
      (bjCanToggle() ? "" : ' <span class="bjopt__lock">— kan skiftes før uddeling eller efter opgør</span>') +
      "</label>" +
      "</div>";

    bj.dShown = dCount;
    bj.seats.forEach(function (s, si) {
      s.hands.forEach(function (h) { h.shown = dealing ? bjPlayerShown(si) : h.cards.length; });
    });
    bj.flip = false;

    var ex = document.getElementById("bjExtra");
    if (ex) ex.onchange = function () {
      bjExtra = ex.checked;
      try { localStorage.setItem("bj_extra", bjExtra ? "1" : "0"); } catch (e) {}
      bj = null; renderBJ();
      toast(bjExtra ? "Ny hånd — med split og double" : "Ny hånd — uden split og double");
    };
    var nx = document.getElementById("bjNext");
    if (nx) nx.onclick = function () { bj = null; renderBJ(); };

    function dealAdvance() {
      bj.step++;
      if (bj.step >= bjDealTotal()) bjStartPlay();
      renderBJ();
    }
    felt.querySelectorAll("[data-seatidx]").forEach(function (el) {
      el.onclick = function () {
        var idx = +el.getAttribute("data-seatidx");
        if (dealing) {
          if (stepInfo.target === "p" + idx) dealAdvance();
          else toast("Følg rækkefølgen: giv " + stepInfo.label + ".");
        } else if (playing) {
          if (idx === bj.pi) bjSeatClick();
          else toast("Det er " + bj.seats[bj.pi].name + "s tur.");
        }
      };
    });
    var dEl = felt.querySelector("[data-dealer]");
    if (dEl) dEl.onclick = function () {
      if (dealing) {
        if (stepInfo.target === "d") dealAdvance();
        else toast("Følg rækkefølgen: giv " + stepInfo.label + ".");
      } else if (dturn) bjDealerClick();
      else if (peek) { bj.phase = "settle"; renderBJ(); }
    };

    felt.querySelectorAll("[data-pick]").forEach(function (b) {
      b.onclick = function () {
        var key = b.getAttribute("data-key");
        var parts = key.split("-");
        var h = bj.seats[+parts[0]].hands[+parts[1]];
        var correct = bjResult(h);
        var ok = b.getAttribute("data-pick") === bjPick(correct);
        var lead = ok ? "Rigtigt. " : "Forkert — hånden " +
          (correct === "lose" ? "har tabt. " : correct === "push" ? "er uafgjort. " : "har vundet. ");
        bj.answers[key] = {
          done: true, ok: ok,
          text: lead + bjWhy(h, bj.dealer) + "<br>" + bjPayoutHTML(h, bj.dealer)
        };
        renderBJ();
      };
    });
  }

  /* ===== Roulette ===== */
  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var SECT = 360 / 37;
  function color(n) { return n === 0 ? "green" : (RED.indexOf(n) >= 0 ? "red" : "black"); }

  function wheelGradient() {
    return "conic-gradient(from " + (-SECT / 2) + "deg," + WHEEL.map(function (n, i) {
      var c = n === 0 ? "#1b7a3d" : (color(n) === "red" ? "#c1121f" : "#141414");
      return c + " " + (i * SECT) + "deg " + ((i + 1) * SECT) + "deg";
    }).join(",") + ")";
  }
  function wheelNumbers() {
    return WHEEL.map(function (n, i) {
      return '<div class="wn" style="transform:rotate(' + (i * SECT) + 'deg)"><span>' + n + "</span></div>";
    }).join("");
  }

  var ro = null, roW = 0, roB = 0;
  var PCOL = ["#2f6fed", "#e07a1f", "#8e44ad", "#159c8a"]; // spiller 1-4 chipfarver
  function roBet(p) {
    var t = pick(["straight", "red", "black", "even", "odd", "low", "high", "dozen", "column"]);
    var b = { p: p, who: "Spiller " + p, type: t, amount: pick([10, 20, 50, 100, 150, 200]) };
    if (t === "straight") b.value = rand(37);
    if (t === "dozen" || t === "column") b.value = pick([1, 2, 3]);
    return b;
  }
  function roNew() {
    var np = 2 + rand(2);           // 2-3 spillere ved bordet
    var k = np + rand(3);           // et par indsatser ekstra
    var bets = [];
    for (var i = 0; i < k; i++) bets.push(roBet(1 + (i % np)));
    ro = { phase: "bets", bets: bets, result: null, answers: {} };
  }
  function roCovers(b, n) {
    switch (b.type) {
      case "straight": return b.value === n;
      case "red": return color(n) === "red";
      case "black": return color(n) === "black";
      case "even": return n !== 0 && n % 2 === 0;
      case "odd": return n % 2 === 1;
      case "low": return n >= 1 && n <= 18;
      case "high": return n >= 19 && n <= 36;
      case "dozen": return n !== 0 && n >= (b.value - 1) * 12 + 1 && n <= b.value * 12;
      case "column": return n !== 0 && (b.value === 3 ? n % 3 === 0 : n % 3 === b.value);
    }
    return false;
  }
  function roMult(t) { return t === "straight" ? 35 : (t === "dozen" || t === "column") ? 2 : 1; }
  /* Kort forklaring på hvad tallet dækker */
  function roWhy(n) {
    if (n === 0) return "Tallet var 0. Nul er hverken rødt/sort, lige/ulige eller i 1–18 / 19–36 — alle de udvendige indsatser taber. Kun en indsats direkte på 0 vinder.";
    var c = color(n) === "red" ? "rødt" : "sort";
    var dz = Math.ceil(n / 12);
    return "Tallet var " + n + " — " + c + ", " + (n % 2 === 0 ? "lige" : "ulige") + ", " +
      (n <= 18 ? "1–18" : "19–36") + ", " + dz + ". dusin.";
  }
  /* Struktureret udbetaling for én vindende roulette-indsats */
  function roPayoutText(b) {
    var profit = b.amount * roMult(b.type);
    return "GEVINST: " + profit + " · indsatsen på " + b.amount + " beholdes · SPILLER FÅR I ALT: " + (profit + b.amount);
  }
  function roDesc(b) {
    var m = { red: "rød", black: "sort", even: "lige", odd: "ulige", low: "1–18", high: "19–36" };
    if (b.type === "straight") return "tallet " + b.value;
    if (b.type === "dozen") return b.value + ". dusin";
    if (b.type === "column") return b.value + ". kolonne";
    return m[b.type];
  }

  function cellBet(c) {
    if (c[0] === "n") return { type: "straight", value: +c.slice(1) };
    if (c.slice(0, 3) === "col") return { type: "column", value: +c.slice(3) };
    if (c.slice(0, 3) === "doz") return { type: "dozen", value: +c.slice(3) };
    return { type: c };
  }
  function betCellId(b) {
    if (b.type === "straight") return "n" + b.value;
    if (b.type === "dozen") return "doz" + b.value;
    if (b.type === "column") return "col" + b.value;
    return b.type;
  }
  function roTable(hit) {
    var parts = [];
    function push(cls, c, label, gc, gr) {
      var on = hit != null && roCovers(cellBet(c), hit);
      parts.push('<div class="rc ' + cls + (on ? " hit" : "") + '" data-c="' + c +
        '" style="grid-column:' + gc + ";grid-row:" + gr + '">' + label + "</div>");
    }
    push("green", "n0", "0", "1", "1/4");
    for (var n = 1; n <= 36; n++) {
      var gcol = 1 + Math.ceil(n / 3);
      var grow = n % 3 === 0 ? 1 : (n % 3 === 2 ? 2 : 3);
      push(color(n), "n" + n, n, gcol, grow);
    }
    push("kol", "col3", "kolonne", "14", "1");
    push("kol", "col2", "kolonne", "14", "2");
    push("kol", "col1", "kolonne", "14", "3");
    push("out", "doz1", "1–12", "2/6", "4");
    push("out", "doz2", "13–24", "6/10", "4");
    push("out", "doz3", "25–36", "10/14", "4");
    push("out", "low", "1–18", "2/4", "5");
    push("out", "even", "LIGE", "4/6", "5");
    push("red", "red", "RØD", "6/8", "5");
    push("black", "black", "SORT", "8/10", "5");
    push("out", "odd", "ULIGE", "10/12", "5");
    push("out", "high", "19–36", "12/14", "5");
    return '<div class="rtable-scroll"><div class="rtable">' + parts.join("") + "</div></div>";
  }
  function placeChips() {
    var host = document.getElementById("roRest");
    if (!host) return;
    ro.bets.forEach(function (b, i) {
      var cell = host.querySelector('.rtable [data-c="' + betCellId(b) + '"]');
      if (!cell) return;
      var stackPos = cell.querySelectorAll(".tchip").length;
      var chip = document.createElement("span");
      chip.className = "tchip";
      chip.style.setProperty("--cc", PCOL[b.p - 1]);
      chip.style.setProperty("--k", stackPos);
      chip.textContent = b.amount;
      cell.appendChild(chip);
    });
  }
  function roRestHTML() {
    var h = "";
    if (ro.phase === "spinning") h += '<p class="muted">Kuglen ruller…</p>';
    if (ro.result !== null) {
      var col = color(ro.result);
      var w = col === "green" ? "grøn" : (col === "red" ? "rød" : "sort");
      if (ro.result !== 0) w += " · " + (ro.result % 2 === 0 ? "lige" : "ulige") + " · " + (ro.result >= 19 ? "høj" : "lav");
      h += '<div class="rresult"><span class="rbig ' + col + '">' + ro.result + '</span><span class="rwords">' + w + "</span></div>";
    }
    h += roTable(ro.result);
    h += '<div class="bets">' + ro.bets.map(function (b, i) {
      var row = '<div class="bet"><span class="chip chip-sm" style="--cc:' + PCOL[b.p - 1] + '">' + b.amount +
        '</span><span class="bettxt">' + b.who + " · " + b.amount + " på " + roDesc(b) + "</span>";
      if (ro.phase === "settle") {
        var a = ro.answers[i];
        row += a
          ? '<div class="rowmsg ' + (a.ok ? "ok" : "bad") + '">' + a.text + "</div>"
          : '<div class="btns2"><button data-bet="' + i + '" data-win="1">Vinder</button>' +
            '<button data-bet="' + i + '" data-win="0">Taber</button></div>';
      }
      return row + "</div>";
    }).join("") + "</div>";
    h += '<div class="controls">';
    if (ro.phase === "bets") h += '<button class="primary" id="roSpin">Ingen flere indsatser</button>';
    else if (ro.phase === "settle" && Object.keys(ro.answers).length === ro.bets.length)
      h += '<button class="primary" id="roNext">Nyt spin</button>';
    h += "</div>";
    return h;
  }

  function renderRO() {
    if (!ro) roNew();
    var felt = document.getElementById("felt");
    if (!document.getElementById("roWheel")) {
      felt.innerHTML =
        '<div class="roulette">' +
        '<div class="rpointer"></div>' +
        '<div class="wheel" id="roWheel" style="background:' + wheelGradient() + '">' +
        wheelNumbers() + '<div class="rhub"></div><div class="rcone"></div></div>' +
        '<div class="btrack" id="roTrack"><div class="rball" id="roBall"></div></div>' +
        "</div>" +
        '<div id="roRest"></div>';
      document.getElementById("roWheel").style.transform = "rotate(" + roW + "deg)";
      document.getElementById("roTrack").style.transform = "rotate(" + roB + "deg)";
    }
    document.getElementById("roRest").innerHTML = roRestHTML();
    placeChips();

    var sp = document.getElementById("roSpin");
    if (sp) sp.onclick = spinRO;
    var nx = document.getElementById("roNext");
    if (nx) nx.onclick = function () { ro = null; renderRO(); };

    document.getElementById("roRest").querySelectorAll("[data-bet]").forEach(function (btn) {
      btn.onclick = function () {
        var i = +btn.getAttribute("data-bet");
        var saysWin = btn.getAttribute("data-win") === "1";
        var b = ro.bets[i];
        var win = roCovers(b, ro.result);
        var ok = saysWin === win;
        var lead = ok ? "Rigtigt. " : "Forkert — den " + (win ? "vinder. " : "taber. ");
        ro.answers[i] = {
          ok: ok,
          text: lead + roWhy(ro.result) + "<br>" + (win
            ? roPayoutText(b)
            : "Inddrag indsatsen på " + b.amount + ".")
        };
        renderRO();
      };
    });
  }

  function spinRO() {
    if (ro.phase !== "bets") return;
    ro.phase = "spinning";
    var result = rand(37);
    var idx = WHEEL.indexOf(result);
    var wheel = document.getElementById("roWheel");
    var track = document.getElementById("roTrack");
    var ball = document.getElementById("roBall");

    var curMod = ((roW % 360) + 360) % 360;
    var want = (((-idx * SECT) % 360) + 360) % 360;
    var delta = want - curMod; if (delta < 0) delta += 360;
    roW = roW + 5 * 360 + delta;

    var curB = ((roB % 360) + 360) % 360;
    var dB = curB; if (dB <= 0) dB += 360;
    roB = roB - 6 * 360 - dB;

    wheel.style.transition = "transform 4.4s cubic-bezier(.16,.62,.14,1)";
    wheel.style.transform = "rotate(" + roW + "deg)";
    track.style.transition = "transform 4.4s cubic-bezier(.12,.6,.12,1)";
    track.style.transform = "rotate(" + roB + "deg)";
    ball.classList.remove("in");
    setTimeout(function () { ball.classList.add("in"); }, 2500);

    document.getElementById("roRest").innerHTML = roRestHTML();
    placeChips();

    setTimeout(function () {
      ro.result = result;
      ro.phase = "settle";
      renderRO();
    }, 4600);
  }

  /* ---------- quiz ---------- */
  var BANK = [
    { q: "Hvor mange kort får hver spiller til start i blackjack?", a: ["2", "1", "3"], c: 0 },
    { q: "I hvilken rækkefølge deler du kort ud til start?", a: ["Ét kort rundt til alle spillere, så dig — og så en runde til", "Begge kort til spiller 1, så begge til spiller 2 osv.", "Dig selv først, så spillerne"], c: 0 },
    { q: "Hvornår får du (dealeren) dit første kort ved uddelingen?", a: ["Efter alle spillere har fået deres første kort", "Før alle spillere", "Sammen med spiller 1"], c: 0 },
    { q: "Dine 2 kort som dealer — hvordan ligger de?", a: ["Det ene synligt, det andet med bagsiden op", "Begge synligt", "Begge med bagsiden op"], c: 0 },
    { q: "Hvornår stopper du med at trække kort som blackjack-dealer?", a: ["Når du har 17 eller mere", "Når du har 15 eller mere", "Når du selv vil"], c: 0 },
    { q: "En spiller har 22. Hvad gør du?", a: ["Tager spillerens chips — de har tabt", "Giver et kort mere", "Venter og ser hvad du selv får"], c: 0 },
    { q: "En spiller får blackjack og vinder. Hvad betaler du?", a: ["Halvanden gang indsatsen", "Det samme som indsatsen", "Det dobbelte"], c: 0 },
    { q: "Spilleren har blackjack, du har 21 på 3 kort. Hvem vinder?", a: ["Spilleren — blackjack slår en 21 på flere kort", "Uafgjort, begge har 21", "Du vinder"], c: 0 },
    { q: "Både du og en spiller har blackjack. Hvad sker der?", a: ["Uafgjort — spilleren får kun sin indsats tilbage", "Spilleren får halvanden gang", "Du vinder"], c: 0 },
    { q: "En spiller har splittet og får A + 10 = 21 på den ene hånd. Er det en blackjack?", a: ["Nej — det er bare 21 (blackjack er kun 21 på de 2 første kort fra uddelingen)", "Ja, det er en blackjack", "Kun hvis dealeren ikke har 21"], c: 0 },
    { q: "En spiller har 19, du har 20. Hvem vinder?", a: ["Dig", "Spilleren", "Uafgjort"], c: 0 },
    { q: "En spiller har 18, du har 18. Hvad sker der?", a: ["Uafgjort — spilleren beholder sin indsats", "Du vinder", "Spilleren vinder"], c: 0 },
    { q: "Hvornår må en spiller lave en double?", a: ["Kun på deres 2 første kort", "Når som helst i hånden", "Kun hvis de har præcis 11"], c: 0 },
    { q: "En spiller har allerede taget et ekstra kort. Må de nu lave en double?", a: ["Nej — kun på de 2 første kort", "Ja", "Kun hvis de er under 12"], c: 0 },
    { q: "En spiller laver en double. Hvor mange kort får de?", a: ["Præcis ét", "Så mange de vil", "To"], c: 0 },
    { q: "En spiller laver en double, så indsatsen nu er 200. De vinder. Hvad betaler du?", a: ["200", "100", "300"], c: 0 },
    { q: "Hvornår må en spiller lave en split?", a: ["Når de 2 første kort er to ens kort", "Når som helst", "Kun med to esser"], c: 0 },
    { q: "En spiller splitter to 8'ere. Hvad sker der?", a: ["De får to hænder og lægger en indsats mere", "De får ét kort og stopper", "De taber automatisk"], c: 0 },
    { q: "En spiller har splittet. Hvordan gør du hænderne op?", a: ["Hver hånd for sig mod din hånd", "Kun den bedste hånd tæller", "Begge hænder skal vinde"], c: 0 },
    { q: "Roulette: en spiller vinder på ét tal. Hvad får spilleren?", a: ["35 gange indsatsen", "Det dobbelte", "10 gange indsatsen"], c: 0 },
    { q: "Roulette: en spiller vinder på rød. Hvad får spilleren?", a: ["Det samme som indsatsen", "Det dobbelte", "35 gange indsatsen"], c: 0 },
    { q: "Roulette: kuglen lander på 17 (sort). Vinder en indsats på rød?", a: ["Nej", "Ja"], c: 0 },
    { q: "Roulette: en spiller vinder på en dusin (12 tal). Hvad får spilleren?", a: ["Det dobbelte", "Det samme som indsatsen", "Tre gange indsatsen"], c: 0 },
    { q: "Roulette: hvornår må spillerne ikke ændre deres indsats mere?", a: ["Når du siger “ingen flere indsatser”", "Når kuglen er landet", "Når du betaler ud"], c: 0 },
    { q: "Roulette: kuglen lander på 0. Vinder en indsats på lige?", a: ["Nej", "Ja"], c: 0 },
    { q: "Du har A + 6 (soft 17) som dealer. Hvad gør du?", a: ["Bliver stående — dealeren står på alle 17, også soft 17", "Trækker et kort mere", "Spørger spilleren"], c: 0 },
    { q: "En spiller vinder på rød med 100. Hvad sker der med indsatsen?", a: ["Spilleren beholder de 100 og får 100 i gevinst — 200 i alt", "De 100 inddrages, og spilleren får 100", "De 100 inddrages, og spilleren får 200"], c: 0 },
    { q: "En spiller splitter to esser. Hvor mange kort får hver hånd?", a: ["Præcis ét kort — så står hånden", "Så mange spilleren vil", "To kort mere"], c: 0 },
    { q: "En spiller får A + 10 = 21 på en splittet es-hånd. Hvordan betales den hvis den vinder?", a: ["1:1 — det er en almindelig 21, ikke en blackjack", "3:2 — som en blackjack", "2:1"], c: 0 },
    { q: "Dealeren går over 21. Hvad sker der med spillere der stadig er med?", a: ["De vinder alle sammen (1:1)", "Kun dem med 20 eller 21 vinder", "Hånden er uafgjort"], c: 0 },
    { q: "En spiller vil splitte K + Q (begge værdi 10). Må de det ved dette bord?", a: ["Nej — der skal være to kort af samme rang", "Ja, alle 10-kort kan splittes", "Kun hvis dealeren har et lavt kort"], c: 0 }
  ];
  var quiz = null;
  function quizStart() {
    var qs = shuffle(BANK.slice()).slice(0, 8).map(function (item) {
      return { q: item.q, opts: shuffle(item.a.slice()), correct: item.a[item.c] };
    });
    quiz = { qs: qs, i: 0, score: 0, picked: null };
  }
  function renderQuiz() {
    if (!quiz) quizStart();
    if (quiz.i >= quiz.qs.length) {
      var pass = quiz.score >= Math.ceil(quiz.qs.length * CONFIG.quizPassPct / 100);
      app.innerHTML = '<h1>Quiz</h1><div class="quizend">' +
        '<p class="score">' + quiz.score + " / " + quiz.qs.length + " rigtige</p>" +
        "<p>" + (pass ? "Bestået." : "Ikke bestået. Læs tutorialen igennem og prøv igen.") + "</p>" +
        '<div class="controls"><button class="primary" id="qAgain">Prøv igen</button>' +
        '<a class="btn" href="#/">Forsiden</a></div></div>';
      document.getElementById("qAgain").onclick = function () { quiz = null; renderQuiz(); };
      return;
    }
    var cur = quiz.qs[quiz.i];
    app.innerHTML = '<h1>Quiz</h1><div class="quiz">' +
      '<p class="qnum">' + (quiz.i + 1) + " / " + quiz.qs.length + "</p>" +
      '<p class="qtext">' + cur.q + "</p>" +
      '<div class="qopts">' + cur.opts.map(function (o, idx) {
        var cls = "";
        if (quiz.picked !== null) {
          if (o === cur.correct) cls = " ok";
          else if (o === quiz.picked) cls = " bad";
        }
        return '<button class="qopt' + cls + '"' + (quiz.picked !== null ? " disabled" : "") +
          ' data-o="' + idx + '">' + o + "</button>";
      }).join("") + "</div>" +
      (quiz.picked !== null
        ? '<div class="controls"><button class="primary" id="qNext">' +
          (quiz.i === quiz.qs.length - 1 ? "Se resultat" : "Næste") + "</button></div>"
        : "") +
      "</div>";

    if (quiz.picked === null) {
      app.querySelectorAll(".qopt").forEach(function (b) {
        b.onclick = function () {
          quiz.picked = cur.opts[+b.getAttribute("data-o")];
          if (quiz.picked === cur.correct) quiz.score++;
          renderQuiz();
        };
      });
    } else {
      document.getElementById("qNext").onclick = function () {
        quiz.i++; quiz.picked = null; renderQuiz();
      };
    }
  }

  /* ---------- selvtest af spil-logik ---------- */
  function runTests() {
    var T = [], A = function (name, cond, msg) { T.push({ name: name, ok: !!cond, msg: msg || "gav forkert resultat" }); };
    function h(cards, ex) { ex = ex || {}; return { cards: cards, bet: ex.bet || 100, split: !!ex.split, doubled: !!ex.doubled }; }

    A("A+6 = 17 (blødt)", total([C("A", "♠"), C("6", "♥")]) === 17);
    A("A+6+10 = 17 (esset bliver 1)", total([C("A", "♠"), C("6", "♥"), C("10", "♣")]) === 17);
    A("A+A = 12", total([C("A", "♠"), C("A", "♥")]) === 12);
    A("K+Q = 20", total([C("K", "♠"), C("Q", "♥")]) === 20);
    A("isSoft17: A+6 er soft 17", isSoft17([C("A", "♠"), C("6", "♥")]));
    A("isSoft17: 10+7 er ikke soft 17", !isSoft17([C("10", "♠"), C("7", "♥")]));
    A("isBlackjack: A+K", isBlackjack([C("A", "♠"), C("K", "♥")]));
    A("bjNatural: A+K fra uddeling", bjNatural(h([C("A", "♠"), C("K", "♥")])));
    A("bjNatural: A+10 efter split er ikke blackjack", !bjNatural(h([C("A", "♠"), C("10", "♥")], { split: true })));
    A("bjNatural: 21 på 3 kort er ikke blackjack", !bjNatural(h([C("7", "♠"), C("7", "♥"), C("7", "♦")])));
    A("bjNatural: doblet 21 er ikke blackjack", !bjNatural(h([C("A", "♠"), C("K", "♥")], { doubled: true })));

    A("Dealer trækker på 16", dealerMustDraw([C("10", "♠"), C("6", "♥")]));
    A("Dealer står på hård 17", !dealerMustDraw([C("10", "♠"), C("7", "♥")]));
    A("Dealer står på soft 17 (A+6)", !dealerMustDraw([C("A", "♠"), C("6", "♥")]));

    A("20 vs 18 → win", bjOutcome(h([C("10", "♠"), C("10", "♥")]), [C("10", "♦"), C("8", "♣")]) === "win");
    A("16 vs 19 → lose", bjOutcome(h([C("10", "♠"), C("6", "♥")]), [C("10", "♦"), C("9", "♣")]) === "lose");
    A("18 vs 18 → push", bjOutcome(h([C("10", "♠"), C("8", "♥")]), [C("10", "♦"), C("8", "♣")]) === "push");
    A("Spiller bust taber selv når dealer buster", bjOutcome(h([C("10", "♠"), C("8", "♥"), C("5", "♦")]), [C("10", "♦"), C("6", "♣"), C("9", "♠")]) === "lose");
    A("Dealer bust vs spiller 17 → win", bjOutcome(h([C("10", "♠"), C("7", "♥")]), [C("10", "♦"), C("5", "♣"), C("9", "♠")]) === "win");
    A("Spiller blackjack vs dealer 20 → bj", bjOutcome(h([C("A", "♠"), C("K", "♥")]), [C("10", "♦"), C("10", "♣")]) === "bj");
    A("Dealer blackjack vs spiller 20 → lose", bjOutcome(h([C("10", "♠"), C("10", "♥")]), [C("A", "♦"), C("K", "♣")]) === "lose");
    A("Begge blackjack → push", bjOutcome(h([C("A", "♠"), C("K", "♥")]), [C("A", "♦"), C("K", "♣")]) === "push");
    A("Dealer blackjack slår spiller-21 på 3 kort", bjOutcome(h([C("7", "♠"), C("7", "♥"), C("7", "♦")]), [C("A", "♦"), C("K", "♣")]) === "lose");
    A("A+10 efter split vs dealer 20 → win (ikke bj)", bjOutcome(h([C("A", "♠"), C("10", "♥")], { split: true }), [C("10", "♦"), C("10", "♣")]) === "win");

    var p;
    p = bjPayout(h([C("A", "♠"), C("K", "♥")], { bet: 100 }), [C("10", "♦"), C("9", "♣")]);
    A("Blackjack på 100 → gevinst 150, retur 250", p.profit === 150 && p.totalReturn === 250);
    p = bjPayout(h([C("A", "♠"), C("K", "♥")], { bet: 200 }), [C("10", "♦"), C("9", "♣")]);
    A("Blackjack på 200 → gevinst 300, retur 500", p.profit === 300 && p.totalReturn === 500);
    p = bjPayout(h([C("10", "♠"), C("9", "♥")], { bet: 100 }), [C("10", "♦"), C("8", "♣")]);
    A("Normal gevinst på 100 → gevinst 100, retur 200", p.profit === 100 && p.totalReturn === 200);
    p = bjPayout(h([C("10", "♠"), C("9", "♥")], { bet: 100 }), [C("10", "♦"), C("9", "♣")]);
    A("Push på 100 → gevinst 0, retur 100", p.profit === 0 && p.totalReturn === 100);
    p = bjPayout(h([C("10", "♠"), C("6", "♥")], { bet: 100 }), [C("10", "♦"), C("9", "♣")]);
    A("Tab på 100 → gevinst -100, retur 0", p.profit === -100 && p.totalReturn === 0);
    p = bjPayout(h([C("5", "♠"), C("6", "♥"), C("9", "♦")], { bet: 200, doubled: true }), [C("10", "♦"), C("8", "♣")]);
    A("Doblet hånd (200) der vinder → gevinst 200, retur 400", p.profit === 200 && p.totalReturn === 400);

    A("0 er ikke rød", !roCovers({ type: "red" }, 0));
    A("0 er ikke sort", !roCovers({ type: "black" }, 0));
    A("0 er ikke lige", !roCovers({ type: "even" }, 0));
    A("0 er ikke ulige", !roCovers({ type: "odd" }, 0));
    A("0 er ikke i 1–18", !roCovers({ type: "low" }, 0));
    A("0 er ikke i 19–36", !roCovers({ type: "high" }, 0));
    A("0 er ikke i nogen dusin", !roCovers({ type: "dozen", value: 1 }, 0) && !roCovers({ type: "dozen", value: 2 }, 0) && !roCovers({ type: "dozen", value: 3 }, 0));
    A("0 er ikke i nogen kolonne", !roCovers({ type: "column", value: 1 }, 0) && !roCovers({ type: "column", value: 2 }, 0) && !roCovers({ type: "column", value: 3 }, 0));
    A("Straight 17 dækker kun 17", roCovers({ type: "straight", value: 17 }, 17) && !roCovers({ type: "straight", value: 17 }, 18));
    A("Rød dækker 1, ikke 2", roCovers({ type: "red" }, 1) && !roCovers({ type: "red" }, 2));
    A("Lige dækker 2, ikke 3", roCovers({ type: "even" }, 2) && !roCovers({ type: "even" }, 3));
    A("1–18 dækker 18, ikke 19", roCovers({ type: "low" }, 18) && !roCovers({ type: "low" }, 19));
    A("2. dusin dækker 13–24", roCovers({ type: "dozen", value: 2 }, 13) && roCovers({ type: "dozen", value: 2 }, 24) && !roCovers({ type: "dozen", value: 2 }, 12) && !roCovers({ type: "dozen", value: 2 }, 25));
    A("1. kolonne = 1,4,…,34", roCovers({ type: "column", value: 1 }, 1) && roCovers({ type: "column", value: 1 }, 34) && !roCovers({ type: "column", value: 1 }, 2));
    A("3. kolonne = 3,6,…,36", roCovers({ type: "column", value: 3 }, 3) && roCovers({ type: "column", value: 3 }, 36) && !roCovers({ type: "column", value: 3 }, 35));
    A("Hvert tal 1–36 i præcis én dusin", (function () { for (var n = 1; n <= 36; n++) { var c = 0; for (var d = 1; d <= 3; d++) if (roCovers({ type: "dozen", value: d }, n)) c++; if (c !== 1) return false; } return true; })());
    A("Hvert tal 1–36 i præcis én kolonne", (function () { for (var n = 1; n <= 36; n++) { var c = 0; for (var d = 1; d <= 3; d++) if (roCovers({ type: "column", value: d }, n)) c++; if (c !== 1) return false; } return true; })());
    A("Rød og sort deler 1–36 uden overlap", (function () { for (var n = 1; n <= 36; n++) if (roCovers({ type: "red" }, n) === roCovers({ type: "black" }, n)) return false; return true; })());
    A("Lige og ulige deler 1–36 uden overlap", (function () { for (var n = 1; n <= 36; n++) if (roCovers({ type: "even" }, n) === roCovers({ type: "odd" }, n)) return false; return true; })());

    A("Straight betaler 35:1", roMult("straight") === 35);
    A("Dusin betaler 2:1", roMult("dozen") === 2);
    A("Kolonne betaler 2:1", roMult("column") === 2);
    A("Rød/sort/lige/ulige/lav/høj betaler 1:1", roMult("red") === 1 && roMult("black") === 1 && roMult("even") === 1 && roMult("odd") === 1 && roMult("low") === 1 && roMult("high") === 1);

    A("Hjulet har 37 felter", WHEEL.length === 37);
    A("Hjulet har alle tal 0–36", (function () { for (var n = 0; n <= 36; n++) if (WHEEL.indexOf(n) < 0) return false; return true; })());
    A("18 røde tal", RED.length === 18);

    return T;
  }
  function renderSelfTest() {
    var r = runTests();
    var passed = r.filter(function (x) { return x.ok; }).length;
    var allOk = passed === r.length;
    app.innerHTML = "<h1>Selvtest</h1>" +
      '<p class="muted">Automatiske tjek af spil-logikken — udbetalinger og grænsetilfælde.</p>' +
      '<p class="score">' + passed + " / " + r.length + "</p>" +
      '<p class="dt-verdict ' + (allOk ? "ok" : "bad") + '">' + (allOk ? "ALLE TESTS OK" : (r.length - passed) + " FEJLEDE") + "</p>" +
      '<div class="selftest">' + r.map(function (x) {
        return '<div class="st-row ' + (x.ok ? "ok" : "bad") + '"><span>' + x.name + "</span><b>" + (x.ok ? "OK" : "FEJL") + "</b></div>";
      }).join("") + "</div>" +
      '<div class="controls"><a class="btn" href="#/">Forsiden</a></div>';
  }

  route();
})();
