/* HTML 화면: 시작 화면, HUD, 대화창, 퀘스트, 행사, 지도, 교환소, 미니게임 */
const $ = (id) => document.getElementById(id);

function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, v]) => {
    if (key === "class") n.className = v;
    else if (key === "on") Object.entries(v).forEach(([ev, fn]) => n.addEventListener(ev, fn));
    else if (v !== undefined && v !== null) n[key] = v;
  });
  kids.flat().forEach((c) => { if (c !== null && c !== undefined) n.append(c); });
  return n;
}
const btn = (label, fn, cls) => el("button", { class: cls || "btn", type: "button", textContent: label, on: { click: fn } });
const sourceLink = (src) => el("a", { class: "src", href: src.url, target: "_blank", rel: "noopener", textContent: src.label });

const UI = {
  modalOpen: false,
  cleanup: null,
  mini: { base: null, scale: 1.5 },
  player: { x: 0, y: 0 },
  currentBuilding: null,

  /* ---------- 시작 화면 ---------- */
  renderTitle() {
    $("title-name").textContent = T("title");
    $("title-sub").textContent = T("subtitle");
    $("start-student").querySelector("b").textContent = T("student");
    $("start-student").querySelector("span").textContent = T("studentNote");
    $("start-visitor").querySelector("b").textContent = T("visitor");
    $("start-visitor").querySelector("span").textContent = T("visitorNote");
    $("title-controls").textContent = T("controls");
    $("title-note").textContent = T("disclaimerDemo");
    $("reset").textContent = T("reset");
    delete $("reset").dataset.armed;
  },
  start(mode) {
    if (Game.phaser) return;
    Store.data.mode = mode;
    Store.save();
    $("title").hidden = true;
    $("hud").hidden = false;
    this.renderHud();
    startPhaser();
    const check = Store.checkIn();
    if (check) this.toast(`${T("checkIn")} +${check.granted} · ${check.streak}${T("streak")}`);
    Store.save();
    this.renderHud();
  },
  setLang(lang) {
    Store.data.lang = lang;
    Store.save();
    document.documentElement.lang = lang;
    this.renderTitle();
    this.renderHud();
    Game.refreshWorld();
    if (Game.scene) this.renderMinimapBase();
  },

  /* ---------- HUD ---------- */
  renderHud() {
    const d = Store.data;
    const today = todayStr();
    const earned = d.dailyDate === today ? d.dailyEarned : 0;
    $("hud-points").hidden = d.mode !== "student";
    $("hud-points").textContent = `★ ${d.points} ${T("points")} · ${T("today")} ${earned}/${GAME_CONFIG.dailyPointCap}`;
    $("btn-quests").textContent = `${T("quests")} (Q)`;
    $("btn-map").textContent = `${T("map")} (M)`;
    $("btn-events").textContent = `${T("events")} (V)`;
    $("btn-stamps").textContent = `${T("stamps")} ${d.stamps.length}/${LANGUAGES.length} (T)`;
    $("touch-act").textContent = T("interact");
    this.renderTracker();
  },
  renderTracker() {
    const box = $("tracker");
    box.replaceChildren();
    if (Game.waypoint) {
      box.append(el("b", { textContent: T("waypoint") }), el("div", { textContent: Game.buildingName(Game.waypoint) }));
      box.hidden = false;
      return;
    }
    const id = Store.data.tracked;
    const step = id && Quests.step(id);
    if (!step) { box.hidden = true; return; }
    box.hidden = false;
    box.append(el("b", { textContent: L(QUESTS[id].title) }), el("div", { textContent: L(step.hint) }));
    if (step.type === "visit") {
      const s = Quests.state(id);
      box.append(el("div", { class: "muted", textContent: `${s.visited.length}/${step.buildings.length} · ${step.buildings.filter((b) => !s.visited.includes(b)).map((b) => Game.buildingName(b)).join(", ")}` }));
    }
  },
  setPrompt(text) {
    const p = $("prompt");
    if (!text || this.modalOpen) { p.hidden = true; return; }
    p.hidden = false;
    if (p.dataset.text !== text) { p.dataset.text = text; p.textContent = `[E] ${text}`; }
  },
  setArrow(angle, dist) {
    const a = $("arrow");
    if (angle === null || dist < 40 || this.modalOpen) { a.hidden = true; return; }
    a.hidden = false;
    const r = Math.min(window.innerWidth, window.innerHeight) * 0.2;
    a.style.transform = `translate(${Math.cos(angle) * r}px, ${Math.sin(angle) * r}px) rotate(${angle}rad)`;
  },
  setInterior(id, hasNpc) {
    this.currentBuilding = id;
    const b = $("interior-banner");
    if (!id) { b.hidden = true; return; }
    const def = BUILDINGS.find((x) => x.id === id);
    b.hidden = false;
    b.replaceChildren(el("b", { textContent: L(def.name) }), el("span", { textContent: `${L(def.desc)} ${hasNpc ? "" : T("emptyInterior")}` }), el("small", { textContent: T("demoInterior") }));
  },
  toast(text) {
    const t = el("div", { class: "toast", textContent: text });
    $("toasts").append(t);
    setTimeout(() => t.remove(), 3000);
  },
  rewardToast(titleText, granted) {
    const d = Store.data;
    let msg = `${titleText}`;
    if (d.mode === "visitor") msg += ` · ${T("visitorNoPoints")}`;
    else if (granted > 0) msg += ` · +${granted} ${T("points")}`;
    else msg += ` · ${T("capReached")}`;
    this.toast(msg);
    this.renderHud();
    Game.refreshWorld();
  },

  /* ---------- 미니맵 ---------- */
  renderMinimapBase() {
    const tmj = Game.tmj;
    const base = document.createElement("canvas");
    base.width = tmj.width; base.height = tmj.height;
    const g = base.getContext("2d");
    const colors = { [TILE.path]: "#d9c9a3", [TILE.plaza]: "#b9a48c", [TILE.field]: "#4f9d52", [TILE.fieldLine]: "#4f9d52", [TILE.lawn]: "#86cc6c" };
    const ground = tmj.layers.find((l) => l.name === "ground").data;
    const solid = tmj.layers.find((l) => l.name === "solid").data;
    for (let y = 0; y < tmj.height; y++) for (let x = 0; x < tmj.width; x++) {
      const i = y * tmj.width + x;
      const s = solid[i];
      g.fillStyle = s === TILE.tree || s === TILE.hedge ? "#3e8a4c" : s ? "#2a3d63" : colors[ground[i]] || "#6fb35a";
      g.fillRect(x, y, 1, 1);
    }
    this.mini.base = base;
    this.drawMinimap();
  },
  movePlayerDot(x, y) {
    this.player = { x, y };
    if (!this.mini.frame) this.mini.frame = 0;
    if (this.mini.frame++ % 6 === 0) this.drawMinimap();
  },
  drawOnCanvas(canvas) {
    if (!this.mini.base) return;
    const g = canvas.getContext("2d");
    const sx = canvas.width / this.mini.base.width, sy = canvas.height / this.mini.base.height;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mini.base, 0, 0, canvas.width, canvas.height);
    const dot = (px, py, col, r) => {
      g.fillStyle = "#10182a"; g.fillRect((px / TILE_SIZE) * sx - r - 1, (py / TILE_SIZE) * sy - r - 1, r * 2 + 2, r * 2 + 2);
      g.fillStyle = col; g.fillRect((px / TILE_SIZE) * sx - r, (py / TILE_SIZE) * sy - r, r * 2, r * 2);
    };
    Events.list().forEach((e) => { const pl = Game.places[e.place]; if (pl) dot(pl.door.x, pl.door.y, Events.isLive(e) ? "#ff6b6b" : "#ffb3b3", 2); });
    const targetId = Game.target();
    if (targetId && Game.places[targetId]) dot(Game.places[targetId].door.x, Game.places[targetId].door.y, "#f2c94c", 3);
    if (!this.currentBuilding) dot(this.player.x, this.player.y, "#ffffff", 2);
    else { const pl = Game.places[this.currentBuilding]; if (pl) dot(pl.door.x, pl.door.y, "#ffffff", 2); }
  },
  drawMinimap() {
    this.drawOnCanvas($("minimap"));
    const big = $("bigmap");
    if (big) this.drawOnCanvas(big);
  },

  /* ---------- 모달 공통 ---------- */
  openModal(title, nodes, opts) {
    this.closeModal(true);
    this.modalOpen = true;
    Input.keys = {};
    const box = el("div", { class: "modal" + (opts && opts.wide ? " wide" : ""), role: "dialog", "aria-modal": "true", ariaLabel: title });
    const head = el("div", { class: "modal-head" }, el("h2", { textContent: title }), btn(T("close"), () => this.closeModal(), "btn ghost"));
    const body = el("div", { class: "modal-body", id: "modal-body" });
    body.append(...nodes);
    box.append(head, body);
    $("modal-root").replaceChildren(el("div", { class: "backdrop", on: { mousedown: (e) => { if (e.target.classList.contains("backdrop")) this.closeModal(); } } }, box));
    $("modal-root").hidden = false;
    const first = box.querySelector("input, .modal-body button, .modal-body a");
    if (first && first.tagName === "INPUT" && window.matchMedia("(pointer: fine)").matches) first.focus();
  },
  setBody(nodes) { $("modal-body").replaceChildren(...nodes); },
  closeModal(silent) {
    if (this.cleanup) { this.cleanup(); this.cleanup = null; }
    if (!this.modalOpen) return;
    this.modalOpen = false;
    $("modal-root").hidden = true;
    $("modal-root").replaceChildren();
    if (!silent) { Input.action = false; this.renderHud(); }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  },

  /* ---------- NPC ---------- */
  openNpc(id, def) {
    if (!def) return;
    const actions = [];
    Quests.pendingFor(id).forEach((qid) => {
      const step = Quests.step(qid);
      const label = `${L(QUESTS[qid].title)}: `;
      if (step.type === "talk") actions.push(btn(label + T("next"), () => this.showCards(qid, step), "btn primary"));
      if (step.type === "quiz") actions.push(btn(label + T("startQuiz"), () => this.runQuiz(qid, step, 0), "btn primary"));
      if (step.type === "minigame") actions.push(btn(label + T("playMini"), () => this.openMini(qid), "btn primary"));
    });
    (def.offers || []).forEach((qid) => {
      if (Quests.status(qid) === "available" && Quests.canTake(qid)) {
        actions.push(btn(`${T("accept")}: ${L(QUESTS[qid].title)}`, () => {
          Quests.accept(qid);
          this.closeModal();
          this.toast(`${T("active")}: ${L(QUESTS[qid].title)}`);
          Game.refreshWorld();
        }, "btn primary"));
      }
    });
    if (def.ai) actions.push(btn(T("ask"), () => this.openAi(def)));
    if (def.minigame && !Quests.pendingFor(id).some((q) => Quests.step(q).type === "minigame")) actions.push(btn(T("playMini"), () => this.openMini(null)));
    if (def.shop) actions.push(btn(T("openShop"), () => this.openShop()));
    this.openModal(L(def.name), [el("p", { class: "line", textContent: L(def.line) }), el("div", { class: "actions" }, actions)]);
  },
  kbCard(docId) {
    const doc = KB.find((d) => d.id === docId);
    const lang = Store.data.lang;
    return el("div", { class: "card" }, el("b", { textContent: doc.title[lang] }), el("p", { textContent: doc.text[lang] }), sourceLink({ url: doc.source.url, label: doc.source.label[lang] }));
  },
  showCards(qid, step) {
    this.setBody([...step.cards.map((c) => this.kbCard(c)), el("div", { class: "actions" }, btn(T("next"), () => this.finishStep(qid), "btn primary"))]);
  },
  runQuiz(qid, step, index) {
    const q = step.questions[index];
    const feedback = el("div", { class: "feedback", role: "status" });
    const choices = q.choices.map((c, i) => btn(L(c), () => {
      if (i === q.answer) {
        if (index + 1 < step.questions.length) this.runQuiz(qid, step, index + 1);
        else this.finishStep(qid);
      } else {
        feedback.replaceChildren(el("b", { textContent: T("wrong") }), this.kbCard(q.why));
      }
    }));
    this.setBody([el("div", { class: "muted", textContent: `${index + 1} / ${step.questions.length}` }), el("p", { class: "line", textContent: L(q.q) }), el("div", { class: "actions col" }, choices), feedback]);
  },
  finishStep(qid) {
    const result = Quests.advance(qid);
    this.closeModal();
    if (result && result.done) this.rewardToast(`${T("questDone")}: ${L(QUESTS[qid].title)}`, result.granted);
    else { this.renderHud(); Game.refreshWorld(); }
  },
  onEnterBuilding(id) {
    Quests.onVisit(id).forEach(({ id: qid, result }) => {
      if (result && result.done) this.rewardToast(`${T("questDone")}: ${L(QUESTS[qid].title)}`, result.granted);
    });
    this.renderTracker();
  },

  /* ---------- AI NPC ---------- */
  openAi(def) {
    const log = el("div", { class: "chat", "aria-live": "polite" });
    const input = el("input", { class: "input", type: "text", maxLength: 300, placeholder: T("askPlaceholder"), ariaLabel: T("askPlaceholder") });
    const send = async (text) => {
      const q = (text || input.value).trim();
      if (!q) return;
      input.value = "";
      log.append(el("div", { class: "msg me", textContent: q }));
      const wait = el("div", { class: "msg npc muted", textContent: "…" });
      log.append(wait);
      log.scrollTop = log.scrollHeight;
      const r = await askNpc(q);
      wait.remove();
      const body = el("div", { class: "msg npc" }, el("p", { class: "answer", textContent: r.answer || T("noAnswer") }));
      if (r.answer && r.sources.length) {
        body.append(el("div", { class: "evidence" }, el("b", { textContent: T("evidence") }), r.sources.map((s) => el("div", {}, s.title ? `${s.title} · ` : "", sourceLink(s)))));
      }
      log.append(body);
      log.scrollTop = log.scrollHeight;
    };
    const chips = el("div", { class: "chips" }, UI_TEXT.suggested.map((s) => btn(L(s), () => send(L(s)), "chip")));
    const form = el("form", { class: "ask", on: { submit: (e) => { e.preventDefault(); send(); } } }, input, el("button", { class: "btn primary", type: "submit", textContent: T("send") }));
    this.openModal(L(def.name), [
      el("div", { class: "muted", textContent: GAME_CONFIG.npcEndpoint ? T("llmMode") : T("localMode") }),
      log, chips, form,
      el("p", { class: "notice", textContent: T("aiNotice") }),
    ], { wide: true });
  },

  /* ---------- 퀘스트 목록 ---------- */
  openQuests() {
    const rows = Object.entries(QUESTS).map(([id, q]) => {
      const can = Quests.canTake(id);
      const status = !can ? T("locked") : T(Quests.status(id) === "available" ? "available" : Quests.status(id));
      const step = Quests.step(id);
      const row = el("div", { class: "card" + (can ? "" : " dim") },
        el("div", { class: "row" }, el("b", { textContent: L(q.title) }), el("span", { class: "tag", textContent: status })),
        el("p", { textContent: step ? L(step.hint) : L(q.summary) }),
        el("div", { class: "muted", textContent: `${T("reward")} ${q.reward} ${T("points")}` }));
      const giver = Object.entries({ ...NPCS, ...OUTDOOR_NPCS }).find(([, n]) => (n.offers || []).includes(id));
      if (Quests.status(id) === "available" && can && giver) {
        const place = giver[1].building ? Game.buildingName(giver[1].building) : Game.buildingName("gate");
        row.append(el("div", { class: "row" }, el("span", { class: "muted", textContent: `${T("whereGiver")}: ${place} · ${L(giver[1].name)}` }), giver[1].building ? btn(T("guide"), () => this.navigate(giver[1].building), "btn small") : null));
      }
      if (step && Quests.status(id) === "active") {
        row.append(btn(T("guide"), () => { Game.waypoint = null; Store.data.tracked = id; Store.save(); this.closeModal(); Game.refreshWorld(); }, "btn small"));
      }
      return row;
    });
    this.openModal(T("quests"), rows);
  },
  navigate(id) {
    Game.waypoint = id;
    this.closeModal();
    this.renderTracker();
    if (this.currentBuilding) Game.goto(this.currentBuilding);
    this.drawMinimap();
  },

  /* ---------- 행사 ---------- */
  openEvents() {
    const fmt = (t) => new Date(t).toLocaleString(Store.data.lang === "ko" ? "ko-KR" : "en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const list = Events.list().map((e) => {
      const live = Events.isLive(e);
      return el("div", { class: "card" },
        el("div", { class: "row" }, el("b", { textContent: L(e.title) }), el("span", { class: "tag" + (live ? " live" : ""), textContent: T(live ? "live" : "upcoming") })),
        el("div", { class: "muted", textContent: `${Game.buildingName(e.place)} · ${fmt(e.start)} ~ ${fmt(e.end)}` }),
        btn(T("guide"), () => this.navigate(e.place), "btn small"));
    });
    const places = BUILDINGS.concat(OPEN_SPACES);
    const name = el("input", { class: "input", type: "text", maxLength: 40, placeholder: T("eventName"), ariaLabel: T("eventName") });
    const select = el("select", { class: "input", ariaLabel: T("map") }, places.map((p) => el("option", { value: p.id, textContent: L(p.name) })));
    const form = el("form", { class: "ask", on: { submit: (e) => {
      e.preventDefault();
      if (!name.value.trim()) return;
      Events.add(name.value.trim(), select.value);
      this.openEvents();
    } } }, name, select, el("button", { class: "btn primary", type: "submit", textContent: T("add") }));
    const nodes = [...list];
    if (Store.data.mode === "student") nodes.push(el("h3", { textContent: T("addEvent") }), form);
    nodes.push(el("p", { class: "notice", textContent: T("eventsNote") }));
    this.openModal(T("events"), nodes);
  },

  /* ---------- 지도 ---------- */
  openMap() {
    const canvas = el("canvas", { id: "bigmap", width: 324, height: 366, class: "bigmap" });
    const list = el("div", { class: "place-list" });
    const all = BUILDINGS.concat(OPEN_SPACES);
    const render = (q) => {
      const needle = q.trim().toLowerCase();
      list.replaceChildren(...all.filter((p) => !needle || p.name.ko.includes(needle) || p.name.en.toLowerCase().includes(needle)).map((p) =>
        el("div", { class: "place" }, el("span", { textContent: L(p.name) }), el("span", { class: "place-btns" }, btn(T("guide"), () => this.navigate(p.id), "btn small"), btn(T("go"), () => { Game.waypoint = null; this.closeModal(); Game.goto(p.id); }, "btn small ghost")))));
    };
    const search = el("input", { class: "input", type: "search", placeholder: T("searchPlace"), ariaLabel: T("searchPlace"), on: { input: (e) => render(e.target.value) } });
    render("");
    const extras = [];
    if (new URLSearchParams(location.search).has("dev")) extras.push(btn(T("exportTiled"), exportTiled, "btn small"));
    this.openModal(T("map"), [el("div", { class: "mapwrap" }, canvas, el("div", { class: "mapside" }, search, list)), el("p", { class: "notice", textContent: T("layoutNote") }), ...extras], { wide: true });
    this.drawMinimap();
  },

  /* ---------- 스탬프 랠리 ---------- */
  openStamps() {
    const grid = el("div", { class: "stamps" }, LANGUAGES.map((l) => {
      const got = Store.data.stamps.includes(l.id);
      return el("div", { class: "stamp" + (got ? " got" : "") }, el("b", { textContent: got ? l.hello : "?" }), el("span", { textContent: L(l.name) }));
    }));
    this.openModal(T("stampTitle"), [el("p", { textContent: T("stampHelp") }), grid, btn(T("guide"), () => this.navigate("lawn"), "btn small")]);
  },
  openBooth(langId) {
    const lang = LANGUAGES.find((l) => l.id === langId);
    const others = LANGUAGES.filter((l) => l.id !== langId);
    const start = (langId.charCodeAt(0) + langId.charCodeAt(1)) % others.length;
    const options = [lang, others[start], others[(start + 2) % others.length]];
    const shift = langId.charCodeAt(1) % 3;
    const ordered = options.slice(shift).concat(options.slice(0, shift));
    const feedback = el("div", { class: "feedback", role: "status" });
    const got = Store.data.stamps.includes(langId);
    const nodes = [
      el("p", { class: "hello", dir: "auto", textContent: lang.hello }),
      el("p", { class: "muted", textContent: `${L(lang.name)} · ${lang.say}` }),
    ];
    if (got) {
      nodes.push(el("div", { class: "tag", textContent: T("stampGot") }));
    } else {
      nodes.push(el("p", { class: "line", textContent: T("stampQuiz") }), el("div", { class: "actions" }, ordered.map((o) => btn(L(o.name), () => {
        if (o.id !== langId) { feedback.textContent = T("wrong"); return; }
        Store.data.stamps.push(langId);
        Store.save();
        this.closeModal();
        this.toast(`${T("stampGot")}: ${L(lang.name)} ${Store.data.stamps.length}/${LANGUAGES.length}`);
        if (Store.data.stamps.length === LANGUAGES.length && !Store.data.stampRewarded) {
          Store.data.stampRewarded = true;
          const granted = Store.earn(30);
          Store.save();
          this.rewardToast(T("stampTitle"), granted);
        }
        this.renderHud();
        Game.refreshWorld();
      }))), feedback);
    }
    this.openModal(`${T("booth")}: ${L(lang.name)}`, nodes);
  },

  /* ---------- 교환소 ---------- */
  openShop() {
    const rows = SHOP.map((item) => {
      const owned = Store.data.redeemed.includes(item.id);
      return el("div", { class: "card row" }, el("span", { textContent: `${L(item.name)} · ${item.cost} ${T("points")}` }),
        owned ? el("span", { class: "tag", textContent: T("owned") }) : btn(T("buy"), () => {
          if (Store.data.points < item.cost) { this.toast(T("notEnough")); return; }
          Store.data.points -= item.cost;
          Store.data.redeemed.push(item.id);
          Store.save();
          this.renderHud();
          this.openShop();
        }, "btn small"));
    });
    this.openModal(T("shopTitle"), [el("div", { class: "muted", textContent: `★ ${Store.data.points} ${T("points")}` }), ...rows]);
  },

  /* ---------- 모의 수강신청 ---------- */
  openMini(questId) {
    const courses = MOCK_COURSES.map((c) => ({ ...c, left: c.seats, mine: false }));
    let timer = null, phase = "ready", count = 3;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    this.closeModal(true);

    const render = () => {
      const table = el("div", { class: "courses" }, courses.map((c) => {
        const state = c.mine ? T("miniApplied") : c.left <= 0 ? T("miniFull") : T("miniApply");
        return el("div", { class: "course" + (c.mine ? " mine" : "") + (c.left <= 0 && !c.mine ? " full" : "") },
          el("span", { class: "cname", textContent: (c.target ? "★ " : "") + L(c.name) }),
          el("span", { class: "muted", textContent: `${T("seats")} ${Math.max(0, c.left)}` }),
          el("button", { class: "btn small primary", type: "button", textContent: state, disabled: phase !== "open" || c.mine || c.left <= 0, on: { click: () => {
            if (c.left > 0) { c.mine = true; c.left--; render(); checkEnd(); }
          } } }));
      }));
      const nodes = [el("p", { textContent: T("miniHelp") })];
      if (phase === "ready") nodes.push(btn(T("miniStart"), begin, "btn primary"));
      if (phase === "count") nodes.push(el("p", { class: "count", textContent: String(count) }));
      nodes.push(table);
      if (phase === "end") nodes.push(result());
      this.setBody(nodes);
    };
    const begin = () => {
      phase = "count"; count = 3; render();
      timer = setInterval(() => {
        count--;
        if (count > 0) { render(); return; }
        stop();
        phase = "open"; render();
        timer = setInterval(tick, 450);
      }, 700);
    };
    const tick = () => {
      courses.forEach((c) => { if (!c.mine && c.left > 0 && Math.random() < (c.target ? 0.75 : 0.35)) c.left--; });
      render();
      checkEnd();
    };
    const checkEnd = () => {
      if (phase === "open" && courses.filter((c) => c.target).every((c) => c.mine || c.left <= 0)) { stop(); phase = "end"; render(); }
    };
    const result = () => {
      const got = courses.filter((c) => c.target && c.mine).length;
      const total = courses.filter((c) => c.target).length;
      const box = el("div", { class: "card" }, el("b", { textContent: `${T("miniResult")} ${got}/${total}` }));
      if (!result.paid) {
        result.paid = true;
        const today = todayStr();
        if (got > 0 && Store.data.miniRewardDate !== today) {
          Store.data.miniRewardDate = today;
          const granted = Store.earn(got * 5);
          Store.save();
          this.renderHud();
          if (Store.data.mode === "student") box.append(el("div", { textContent: granted > 0 ? `+${granted} ${T("points")}` : T("capReached") }));
        } else if (got > 0) {
          box.append(el("div", { class: "muted", textContent: T("miniOnce") }));
        }
      }
      if (questId && Quests.step(questId) && Quests.step(questId).type === "minigame" && got >= 2) {
        box.append(btn(T("next"), () => this.finishStep(questId), "btn primary"));
      } else {
        box.append(btn(T("miniAgain"), () => this.openMini(questId)));
      }
      return box;
    };
    this.openModal(T("miniTitle"), [], { wide: true });
    this.cleanup = stop;
    render();
  },

  /* ---------- 터치 조작 ---------- */
  bindTouch() {
    const bind = (id, x, y) => {
      const b = $(id);
      const on = (e) => { e.preventDefault(); Input.touch.x = x; Input.touch.y = y; };
      const off = (e) => { e.preventDefault(); Input.touch.x = 0; Input.touch.y = 0; };
      b.addEventListener("pointerdown", on);
      ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => b.addEventListener(ev, off));
    };
    bind("t-up", 0, -1); bind("t-down", 0, 1); bind("t-left", -1, 0); bind("t-right", 1, 0);
    $("touch-act").addEventListener("pointerdown", (e) => { e.preventDefault(); Input.action = true; });
  },
};

/* ---------- 시작 ---------- */
window.addEventListener("DOMContentLoaded", async () => {
  Store.load();
  document.documentElement.lang = Store.data.lang;
  if (!window.Phaser) {
    Store.data.mode = null;
    UI.renderTitle();
    $("title-note").textContent = T("loadFailed");
    $("start-student").disabled = true;
    $("start-visitor").disabled = true;
    return;
  }
  UI.renderTitle();
  $("lang-ko").addEventListener("click", () => UI.setLang("ko"));
  $("lang-en").addEventListener("click", () => UI.setLang("en"));
  $("hud-lang").addEventListener("click", () => UI.setLang(Store.data.lang === "ko" ? "en" : "ko"));
  $("reset").addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = T("resetConfirm"); return; }
    Store.reset();
    UI.renderTitle();
    UI.toast(T("reset"));
  });
  $("btn-quests").addEventListener("click", () => UI.openQuests());
  $("btn-map").addEventListener("click", () => UI.openMap());
  $("btn-events").addEventListener("click", () => UI.openEvents());
  $("btn-stamps").addEventListener("click", () => UI.openStamps());
  UI.bindTouch();
  Events.init((ev) => {
    UI.toast(`${T("events")}: ${L(ev.title)}`);
    Game.refreshWorld();
  });
  Game.tmj = await loadCampusMap();
  try { await Promise.race([document.fonts.load("11px Galmuri11"), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 기본 글꼴로 진행합니다. */ }
  $("start-student").addEventListener("click", () => UI.start("student"));
  $("start-visitor").addEventListener("click", () => UI.start("visitor"));
});
