/*
 * 진행 상황 저장, 포인트, 퀘스트, 행사 로직
 * 시연판은 브라우저 localStorage에 저장합니다. 사용자가 값을 조작할 수 있으므로 실제 상품 교환 전에는
 * 포인트 지급과 일일 상한 검사를 반드시 서버(Supabase)로 옮겨야 합니다.
 */
// ?profile=이름 을 붙이면 저장 공간이 분리됩니다(테스트용).
const SAVE_KEY = "campus-quest-v1" + (new URLSearchParams(location.search).get("profile") || "");
const todayStr = () => new Date().toLocaleDateString("sv");

const Store = {
  data: null,
  defaults() {
    return { lang: "ko", mode: null, points: 0, dailyDate: "", dailyEarned: 0, lastCheckIn: "", streak: 0, quests: {}, tracked: null, stamps: [], stampRewarded: false, redeemed: [], miniRewardDate: "", customEvents: [] };
  },
  load() {
    this.data = this.defaults();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.data = Object.assign(this.defaults(), JSON.parse(raw));
    } catch (e) { /* 저장소를 쓸 수 없어도 게임은 이어서 동작합니다. */ }
  },
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* 위와 같음 */ }
  },
  reset() {
    const lang = this.data.lang;
    this.data = this.defaults();
    this.data.lang = lang;
    this.save();
  },
  /* 포인트 지급. 실제 지급된 값을 돌려줍니다. */
  earn(amount) {
    const d = this.data;
    if (d.mode !== "student") return 0;
    const today = todayStr();
    if (d.dailyDate !== today) { d.dailyDate = today; d.dailyEarned = 0; }
    const granted = Math.max(0, Math.min(amount, GAME_CONFIG.dailyPointCap - d.dailyEarned));
    d.points += granted;
    d.dailyEarned += granted;
    this.save();
    return granted;
  },
  /* 하루 한 번 출석 처리. 새로 출석하면 { granted, streak }를 돌려줍니다. */
  checkIn() {
    const d = this.data;
    const today = todayStr();
    if (d.mode !== "student" || d.lastCheckIn === today) return null;
    const y = new Date(); y.setDate(y.getDate() - 1);
    d.streak = d.lastCheckIn === y.toLocaleDateString("sv") ? d.streak + 1 : 1;
    d.lastCheckIn = today;
    return { granted: this.earn(10), streak: d.streak };
  },
};

const L = (o) => (o && o[Store.data.lang]) || (o && o.ko) || "";
const T = (key) => L(UI_TEXT[key]);

const Quests = {
  state(id) { return Store.data.quests[id] || null; },
  status(id) {
    const s = this.state(id);
    if (!s) return "available";
    return s.done ? "done" : "active";
  },
  canTake(id) { return Store.data.mode === "student" || QUESTS[id].public; },
  accept(id) {
    if (!this.canTake(id) || this.state(id)) return;
    Store.data.quests[id] = { step: 0, visited: [], done: false };
    Store.data.tracked = id;
    Store.save();
  },
  step(id) {
    const s = this.state(id);
    return s && !s.done ? QUESTS[id].steps[s.step] : null;
  },
  /* 단계를 넘기고, 모두 끝나면 지급된 포인트를 돌려줍니다. 아직 남았으면 null입니다. */
  advance(id) {
    const s = this.state(id);
    s.step++;
    if (s.step >= QUESTS[id].steps.length) {
      s.done = true;
      const granted = Store.earn(QUESTS[id].reward);
      if (Store.data.tracked === id) {
        Store.data.tracked = Object.keys(Store.data.quests).find((q) => !Store.data.quests[q].done) || null;
      }
      Store.save();
      return { granted, done: true };
    }
    Store.save();
    return null;
  },
  /* 건물 입장 시 방문형 퀘스트를 갱신합니다. 끝나면 완료된 퀘스트 id를 돌려줍니다. */
  onVisit(buildingId) {
    const finished = [];
    Object.keys(Store.data.quests).forEach((id) => {
      const step = this.step(id);
      if (!step || step.type !== "visit" || !step.buildings.includes(buildingId)) return;
      const s = this.state(id);
      if (!s.visited.includes(buildingId)) s.visited.push(buildingId);
      if (step.buildings.every((b) => s.visited.includes(b))) finished.push({ id, result: this.advance(id) });
    });
    Store.save();
    return finished;
  },
  /* 추적 중인 퀘스트의 다음 목적지 건물 id */
  targetBuilding() {
    const id = Store.data.tracked;
    const step = id && this.step(id);
    if (!step) return null;
    if (step.type === "visit") return step.buildings.find((b) => !this.state(id).visited.includes(b)) || null;
    return NPCS[step.npc] ? NPCS[step.npc].building : null;
  },
  /* 이 NPC에게 지금 할 일이 있는 퀘스트 */
  pendingFor(npcId) {
    return Object.keys(Store.data.quests).filter((id) => {
      const step = this.step(id);
      return step && step.npc === npcId;
    });
  },
};

const Events = {
  channel: null,
  samples: [],
  init(onChange) {
    const now = Date.now();
    const H = 3600000;
    this.samples = SAMPLE_EVENTS.map((e) => ({ id: e.id, title: e.title, place: e.place, audience: e.audience, start: now + e.startH * H, end: now + e.endH * H }));
    this.onChange = onChange;
    // Supabase 연동 시 이 부분을 Realtime 구독으로 바꾸면 됩니다.
    if ("BroadcastChannel" in window) {
      try {
        this.channel = new BroadcastChannel("campus-events-" + SAVE_KEY);
        this.channel.onmessage = (m) => {
          Store.data.customEvents.push(m.data);
          Store.save();
          this.onChange(m.data);
        };
      } catch (e) { this.channel = null; }
    }
  },
  list() {
    const now = Date.now();
    const isVisitor = Store.data.mode === "visitor";
    return this.samples.concat(Store.data.customEvents)
      .filter((e) => e.end > now && !(isVisitor && e.audience !== "public"))
      .sort((a, b) => a.start - b.start);
  },
  isLive(e) { return e.start <= Date.now() && Date.now() < e.end; },
  add(titleText, place) {
    const now = Date.now();
    const ev = { id: "c" + now, title: { ko: titleText, en: titleText }, place, audience: "public", start: now, end: now + 2 * 3600000 };
    Store.data.customEvents.push(ev);
    Store.save();
    if (this.channel) this.channel.postMessage(ev);
    this.onChange(ev);
  },
};

/* AI NPC: 서버가 있으면 HyperCLOVA X를, 없거나 실패하면 브라우저 검색 결과를 사용합니다. */
async function askNpc(question) {
  const lang = Store.data.lang;
  const local = Retrieval.retrieve(question, KB, lang, 2);
  const endpoint = GAME_CONFIG.npcEndpoint;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, lang }) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const body = await res.json();
      return { answer: body.answer, sources: body.sources || [], mode: "llm" };
    } catch (e) {
      console.warn("AI 서버 호출 실패, 로컬 검색으로 전환합니다:", e);
    }
  }
  return {
    answer: local.length ? local.map((d) => d.text[lang]).join("\n\n") : null,
    sources: local.map((d) => ({ title: d.title[lang], label: d.source.label[lang], url: d.source.url })),
    mode: "local",
  };
}
