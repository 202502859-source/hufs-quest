import { isTouchDevice } from "../device.js";
import { AUTH_MODE, AuthError, sendCode, verifyCode } from "../data/auth.js";
import { CODE_LENGTH, EMAIL_DOMAINS, STUDENT_ID_LENGTH, isValidCode, isValidStudentId, onlyDigits, resendWaitSeconds } from "../data/authRules.js";
import { getLang, onLangChange, t } from "../state.js";

const BASE = { width: 960, height: 540 };
const BOX = { width: 600, top: 28 }; // 게임 좌표. 휴대폰 키보드가 올라와도 가리지 않게 화면 위쪽에 붙입니다.
const BASE_FONT = 15;
const MIN_TOUCH_FONT = 16; // 16px보다 작으면 일부 휴대폰이 입력할 때 화면을 확대합니다.

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
 * 1단계: [학번 9자리] + [도메인 목록] → "인증 코드 받기"
 * 2단계: [코드 6자리] (붙여넣기 가능, 6자리면 자동 확인) · "학번 다시 입력" · "코드 다시 받기"(60초 뒤)
 * 학번은 이 창 안에서만 잠깐 들고 있고, 창을 닫으면 지웁니다.
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

  // 1단계: 학번 + 도메인
  const idForm = el("form", "login-step");
  idForm.noValidate = true;
  const idIntro = el("p", "login-intro");
  const idRow = el("div", "login-row");
  const idInput = el("input", "login-id");
  Object.assign(idInput, { type: "text", inputMode: "numeric", autocomplete: "off", maxLength: STUDENT_ID_LENGTH, spellcheck: false });
  idInput.setAttribute("pattern", "[0-9]*");
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
  idForm.append(idIntro, idRow, idHint, idError, idActions);

  // 2단계: 인증 코드
  const codeForm = el("form", "login-step");
  codeForm.noValidate = true;
  const codeIntro = el("p", "login-intro");
  const codeNote = el("p", "login-note");
  const codeInput = el("input", "login-code");
  Object.assign(codeInput, { type: "text", inputMode: "numeric", autocomplete: "one-time-code", maxLength: CODE_LENGTH, spellcheck: false });
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

  const studentId = () => idInput.value;
  const domain = () => domainSelect.value;

  const applyText = () => {
    box.lang = getLang();
    title.textContent = step === "id" ? t("loginTitle") : t("loginCodeTitle");
    box.setAttribute("aria-label", title.textContent);
    close.textContent = t("loginClose");
    idIntro.textContent = t("loginIntro");
    idInput.placeholder = t("loginIdPlaceholder");
    idInput.setAttribute("aria-label", t("loginIdLabel"));
    domainSelect.setAttribute("aria-label", t("loginDomainLabel"));
    idHint.textContent = t("loginIdHint");
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

  // 학번이 9자리 숫자일 때만 "인증 코드 받기"를 누를 수 있고, 아니면 안내를 보여 줍니다.
  const updateId = () => {
    const valid = isValidStudentId(studentId());
    idHint.hidden = valid;
    sendButton.disabled = !valid || busy;
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

  // 학번 칸에는 숫자만, 최대 9자리까지 남깁니다(붙여넣기·@ 입력도 여기서 지워짐).
  idInput.addEventListener("input", () => {
    const clean = onlyDigits(idInput.value).slice(0, STUDENT_ID_LENGTH);
    if (clean !== idInput.value) idInput.value = clean;
    idError.textContent = "";
    updateId();
  });

  idForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !isValidStudentId(studentId())) return;
    idError.textContent = "";
    setBusy(true);
    try {
      const result = await sendCode(studentId(), domain());
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
      const result = await sendCode(studentId(), domain());
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

  // 창을 닫으면 입력한 학번과 코드를 지웁니다.
  const reset = () => {
    clearInterval(timer);
    timer = null;
    busy = false;
    sentAt = null;
    devCode = null;
    message = null;
    idInput.value = "";
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
    const top = Math.max(8, rect.top + (offsetY + BOX.top) * scale);
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
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
