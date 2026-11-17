import { isTouchDevice } from "../device.js";
import { AUTH_MODE, AuthError, sendCode, verifyCode } from "../data/auth.js";
import {
  CODE_LENGTH,
  EMAIL_DOMAINS,
  MAIL_ID_MAX_LENGTH,
  isValidCode,
  mailIdProblem,
  normalizeMailId,
  onlyDigits,
  resendWaitSeconds,
  splitMailInput,
} from "../data/authRules.js";
import { getLang, onLangChange, t } from "../state.js";

const BASE = { width: 960, height: 540 };
const BOX = { width: 600, top: 28 }; // 게임 좌표. 휴대폰 키보드가 올라와도 가리지 않게 화면 위쪽에 붙입니다.
const BASE_FONT = 15;
const MIN_TOUCH_FONT = 16; // 16px보다 작으면 일부 휴대폰이 입력할 때 화면을 확대합니다.
const COMPACT_HEIGHT = 480; // 화면 높이가 이보다 낮으면(휴대폰 가로) 창을 촘촘하게 보여 줍니다.

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// AuthError → 화면 문구
function errorText(error) {
  const code = error instanceof AuthError ? error.code : "unknown";
  if (code === "wrong") return t("loginWrongCode");
  if (code === "expired") return t("loginExpiredCode");
  if (code === "rate_limited") return t("loginRateLimited", { s: error.retryAfter || 60 });
  if (code === "forbidden") return t("loginForbidden");
  if (code === "not_configured") return t("loginNotConfigured");
  if (code === "network") return t("loginNetwork");
  if (code === "no_code") return t("loginNoCode");
  return t("loginFailed");
}

/*
 * 학교 이메일 6자리 인증 코드 로그인 창입니다. 한글·숫자 입력과 휴대폰 키보드 때문에 HTML로 게임 위에 띄웁니다.
 * 1단계: [학교 메일 아이디] + [도메인 목록] → "인증 코드 받기"
 *   아이디는 구글 아이디 규칙(영문 소문자 · 숫자 · . _ -, 최대 64자). 대문자는 소문자로 바꾸고 다른 글자는 바로 지웁니다.
 * 2단계: [코드 6자리] (붙여넣기 가능, 6자리면 자동 확인) · "아이디 다시 입력" · "코드 다시 받기"(60초 뒤)
 * 아이디는 이 창 안에서만 잠깐 들고 있고, 창을 닫으면 지웁니다. 콘솔 · 오류 메시지에도 남기지 않습니다.
 */
export function createLoginOverlay(game, { onSuccess, onClose }) {
  const backdrop = el("div", "login-overlay");
  backdrop.hidden = true;
  const box = el("div", "login-box");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");

  const header = el("div", "login-header");
  const title = el("h2");
  const close = el("button", "login-close");
  close.type = "button";
  header.append(title, close);

  // 1단계: 학교 메일 아이디 + 도메인
  const idForm = el("form", "login-step");
  idForm.noValidate = true;
  const idIntro = el("p", "login-intro");
  const idLabel = el("label", "login-label");
  idLabel.htmlFor = "login-mail-id";
  const idRow = el("div", "login-row");
  const idInput = el("input", "login-id");
  // 영문 키보드(email)를 띄우고, 자동 대문자 · 자동 고침 · 맞춤법 검사를 끕니다.
  Object.assign(idInput, {
    id: "login-mail-id",
    type: "text",
    inputMode: "email",
    autocomplete: "username",
    spellcheck: false,
    maxLength: MAIL_ID_MAX_LENGTH,
    enterKeyHint: "send",
  });
  idInput.setAttribute("autocapitalize", "off");
  idInput.setAttribute("autocorrect", "off");
  const domainSelect = el("select", "login-domain");
  EMAIL_DOMAINS.forEach((domain) => {
    const option = el("option", "", `@${domain}`);
    option.value = domain;
    domainSelect.append(option);
  });
  idRow.append(idInput, domainSelect);
  const idHint = el("p", "login-hint");
  const idError = el("p", "login-error");
  idError.setAttribute("role", "alert");
  const idActions = el("div", "login-actions");
  const sendButton = el("button", "login-primary");
  sendButton.type = "submit";
  idActions.append(sendButton);
  idForm.append(idIntro, idLabel, idRow, idHint, idError, idActions);

  // 2단계: 인증 코드
  const codeForm = el("form", "login-step");
  codeForm.noValidate = true;
  const codeIntro = el("p", "login-intro");
  const codeNote = el("p", "login-note");
  const codeInput = el("input", "login-code");
  Object.assign(codeInput, { type: "text", inputMode: "numeric", autocomplete: "one-time-code", spellcheck: false, enterKeyHint: "done" });
  codeInput.setAttribute("pattern", "[0-9]*");
  const codeStatus = el("p", "login-error");
  codeStatus.setAttribute("role", "alert");
  const codeActions = el("div", "login-actions");
  const backButton = el("button", "login-secondary");
  backButton.type = "button";
  const resendButton = el("button", "login-secondary");
  resendButton.type = "button";
  codeActions.append(backButton, resendButton);
  codeForm.append(codeIntro, codeNote, codeInput, codeStatus, codeActions);

  box.append(header, idForm, codeForm);
  backdrop.append(box);

  // 가짜 로그인일 때만 화면 왼쪽 아래에 개발용 코드를 보여 줍니다.
  const devTag = el("div", "login-devcode");
  devTag.hidden = true;
  document.body.append(backdrop, devTag);

  let open = false;
  let step = "id";
  let busy = false;
  let sentAt = null;
  let devCode = null;
  let timer = null;
  let message = null; // { key, vars, ok } 2단계 아래에 보여 줄 문구
  let idStripped = false; // 방금 입력에서 허용되지 않는 글자를 지웠는지 (안내 문구용)
  let idForeign = false; // 목록에 없는 도메인 주소를 붙여 넣었는지

  const mailId = () => idInput.value;
  const domain = () => domainSelect.value;

  const applyText = () => {
    box.lang = getLang();
    title.textContent = step === "id" ? t("loginTitle") : t("loginCodeTitle");
    box.setAttribute("aria-label", title.textContent);
    close.textContent = t("loginClose");
    idIntro.textContent = t("loginIntro");
    idInput.placeholder = t("loginIdPlaceholder");
    idLabel.textContent = t("loginIdLabel");
    domainSelect.setAttribute("aria-label", t("loginDomainLabel"));
    sendButton.textContent = busy && step === "id" ? t("loginSending") : t("loginSend");
    codeIntro.textContent = t("loginCodeIntro");
    codeNote.textContent = t("loginCodeNote");
    codeInput.setAttribute("aria-label", t("loginCodeLabel"));
    backButton.textContent = t("loginBack");
    devTag.textContent = devCode ? `${t("loginDevCode")}: ${devCode}` : "";
    updateId();
    updateResend();
    updateMessage();
  };

  // 아이디가 규칙에 맞고 학교 도메인일 때만 "인증 코드 받기"를 누를 수 있고, 아니면 이유를 안내합니다.
  const updateId = () => {
    const problem = mailIdProblem(mailId());
    let hint = null;
    if (idForeign) hint = t("loginForeignDomain", { domains: EMAIL_DOMAINS.map((d) => `@${d}`).join(", ") });
    else if (problem === "dots") hint = t("loginIdDots");
    else if (problem || idStripped) hint = t("loginIdRule");
    idHint.textContent = hint ?? "";
    idHint.hidden = !hint;
    sendButton.disabled = Boolean(problem) || idForeign || busy;
    idInput.disabled = busy;
    domainSelect.disabled = busy;
  };

  const updateResend = () => {
    const wait = resendWaitSeconds(sentAt, Date.now());
    resendButton.textContent = wait > 0 ? t("loginResendIn", { s: wait }) : t("loginResend");
    resendButton.disabled = wait > 0 || busy;
    backButton.disabled = busy;
    codeInput.disabled = busy;
  };

  const updateMessage = () => {
    if (busy && step === "code") {
      codeStatus.textContent = t("loginVerifying");
      codeStatus.className = "login-error info";
      return;
    }
    codeStatus.textContent = message ? (message.error ? errorText(message.error) : t(message.key)) : "";
    codeStatus.className = message && !message.error ? "login-error info" : "login-error";
  };

  const setBusy = (next) => {
    busy = next;
    applyText();
  };

  const showStep = (next) => {
    step = next;
    idForm.hidden = step !== "id";
    codeForm.hidden = step !== "code";
    applyText();
    place();
    (step === "id" ? idInput : codeInput).focus();
  };

  const startTimer = () => {
    clearInterval(timer);
    timer = setInterval(updateResend, 1000);
  };

  const rememberDevCode = (result) => {
    devCode = result.devCode ?? null;
    devTag.hidden = AUTH_MODE !== "mock" || !devCode;
    devTag.textContent = devCode ? `${t("loginDevCode")}: ${devCode}` : "";
  };

  // 코드 칸: 숫자가 아닌 글자는 입력되기 전에 막습니다. 붙여넣기처럼 미리 막지 못한 것은 input에서 지웁니다.
  codeInput.addEventListener("beforeinput", (event) => {
    if (event.inputType?.startsWith("insert") && event.data?.length === 1 && /\D/.test(event.data)) event.preventDefault();
  });

  // 아이디 칸에 들어온 글자를 정리합니다. "아이디@도메인" 전체가 들어오면 아이디만 남기고 드롭다운을 그 도메인으로 맞춥니다.
  const applyIdInput = (raw, { pasted = false } = {}) => {
    const parsed = splitMailInput(raw);
    if (parsed.domain) domainSelect.value = parsed.domain;
    // "아이디@"까지만 들어왔으면 도메인은 드롭다운에서 고르도록 그쪽으로 옮겨 갑니다.
    const typedAt = raw.trim().endsWith("@") && !pasted;
    idForeign = parsed.foreign;
    const local = raw.includes("@") ? raw.slice(0, raw.indexOf("@")) : raw;
    idStripped = local.trim().toLowerCase() !== parsed.id;
    if (pasted) {
      // 붙여넣기는 칸 전체를 붙여 넣은 아이디로 바꾸고 커서를 끝에 둡니다.
      idInput.value = parsed.id;
      idInput.setSelectionRange(parsed.id.length, parsed.id.length);
    } else if (idInput.value !== parsed.id) {
      // 지운 글자만큼 커서가 끝으로 튀지 않게, 커서 앞부분을 같은 규칙으로 정리한 길이로 맞춥니다.
      const caret = normalizeMailId(idInput.value.slice(0, idInput.selectionStart ?? idInput.value.length)).length;
      idInput.value = parsed.id;
      if (document.activeElement === idInput) idInput.setSelectionRange(caret, caret);
    }
    idError.textContent = "";
    updateId();
    if (typedAt) domainSelect.focus();
  };

  // 한 글자씩 칠 때 @를 누르면 도메인은 드롭다운에서 고르도록 그쪽으로 옮겨 갑니다.
  idInput.addEventListener("beforeinput", (event) => {
    if (event.inputType === "insertText" && event.data === "@") {
      event.preventDefault();
      domainSelect.focus();
    }
  });
  // 붙여넣기는 64자 제한(maxlength)에 잘리기 전에 직접 처리합니다(긴 전체 주소도 도메인을 알아볼 수 있게).
  idInput.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text") ?? "";
    if (!text) return;
    event.preventDefault();
    applyIdInput(text, { pasted: true });
  });
  // 한글 입력(조합) 중에는 건드리지 않고, 조합이 끝나면 정리합니다.
  idInput.addEventListener("input", (event) => {
    if (event.isComposing) return;
    applyIdInput(idInput.value);
  });
  idInput.addEventListener("compositionend", () => applyIdInput(idInput.value));

  idForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || idForeign || mailIdProblem(mailId())) return;
    idError.textContent = "";
    setBusy(true);
    try {
      const result = await sendCode(mailId(), domain());
      if (!open) return;
      sentAt = result.sentAt;
      rememberDevCode(result);
      message = null;
      codeInput.value = "";
      startTimer();
      busy = false;
      showStep("code");
    } catch (error) {
      if (!open) return;
      busy = false;
      idError.textContent = errorText(error);
      applyText();
    } finally {
      busy = false;
      updateId();
    }
  });

  const submitCode = async () => {
    const code = codeInput.value;
    if (busy || !isValidCode(code)) return;
    message = null;
    setBusy(true);
    try {
      await verifyCode(code);
      if (!open) return;
      busy = false;
      finish();
    } catch (error) {
      if (!open) return;
      busy = false;
      message = { error };
      codeInput.value = "";
      applyText();
      codeInput.focus();
    }
  };

  // 코드 칸: 숫자만 6자리까지, 6자리가 채워지면 바로 확인합니다. 붙여넣기도 input 이벤트로 같이 처리됩니다.
  codeInput.addEventListener("input", () => {
    const clean = onlyDigits(codeInput.value).slice(0, CODE_LENGTH);
    if (clean !== codeInput.value) codeInput.value = clean;
    if (clean.length === CODE_LENGTH) submitCode();
  });
  codeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitCode();
  });

  backButton.addEventListener("click", () => {
    if (busy) return;
    message = null;
    showStep("id");
    idInput.select();
  });

  resendButton.addEventListener("click", async () => {
    if (busy || resendWaitSeconds(sentAt, Date.now()) > 0) return;
    message = null;
    setBusy(true);
    try {
      const result = await sendCode(mailId(), domain());
      if (!open) return;
      sentAt = result.sentAt;
      rememberDevCode(result);
      message = { key: "loginResent" };
      codeInput.value = "";
    } catch (error) {
      if (!open) return;
      message = { error };
    } finally {
      busy = false;
      applyText();
      if (open) codeInput.focus();
    }
  });

  // 창을 닫으면 입력한 아이디와 코드를 지웁니다.
  const reset = () => {
    clearInterval(timer);
    timer = null;
    busy = false;
    sentAt = null;
    devCode = null;
    message = null;
    idInput.value = "";
    idStripped = false;
    idForeign = false;
    domainSelect.selectedIndex = 0;
    codeInput.value = "";
    idError.textContent = "";
    devTag.hidden = true;
  };

  const hide = () => {
    if (!open) return;
    open = false;
    backdrop.hidden = true;
    reset();
    onClose?.();
  };

  const finish = () => {
    open = false;
    backdrop.hidden = true;
    reset();
    onSuccess();
  };

  // 960x540 영역에 맞춰 가운데 위쪽에 둡니다. 휴대폰 키보드가 올라오면(visualViewport) 다시 맞춥니다.
  function place() {
    if (!open) return;
    const rect = game.canvas.getBoundingClientRect();
    const scale = rect.width / game.scale.width;
    const offsetX = (game.scale.width - BASE.width) / 2;
    const offsetY = (game.scale.height - BASE.height) / 2;
    const width = Math.min(BOX.width * scale, window.innerWidth - 16);
    const left = rect.left + (offsetX + BASE.width / 2) * scale - width / 2;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    // 휴대폰 가로 화면처럼 낮은 화면에서는 창을 맨 위에 붙이고(설명 줄은 CSS에서 숨김) 키보드가 입력칸을 가리지 않게 합니다.
    const compact = window.innerHeight < COMPACT_HEIGHT;
    box.classList.toggle("compact", compact);
    const top = compact ? 8 : Math.max(8, rect.top + (offsetY + BOX.top) * scale);
    Object.assign(box.style, {
      left: `${Math.max(8, left)}px`,
      top: `${top}px`,
      width: `${width}px`,
      maxHeight: `${Math.max(160, viewportHeight - top - 8)}px`,
      fontSize: `${Math.max(isTouchDevice() ? MIN_TOUCH_FONT : 12, BASE_FONT * scale)}px`,
    });
    Object.assign(devTag.style, {
      left: `${rect.left + 8}px`,
      top: `${rect.bottom - 8}px`,
      fontSize: `${Math.max(12, 13 * scale)}px`,
    });
  }

  // 열려 있는 동안 키 입력이 게임으로 넘어가지 않게 막고, Esc로 닫습니다.
  window.addEventListener(
    "keydown",
    (event) => {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        hide();
      }
      event.stopPropagation();
    },
    true,
  );
  window.addEventListener("keyup", (event) => open && event.stopPropagation(), true);
  close.addEventListener("click", hide);
  onLangChange(() => open && applyText());
  game.scale.on("resize", place);
  window.addEventListener("resize", place);
  window.visualViewport?.addEventListener("resize", place);

  return {
    isOpen: () => open,
    show() {
      if (open) return;
      open = true;
      reset();
      backdrop.hidden = false;
      showStep("id");
    },
    hide,
  };
}
