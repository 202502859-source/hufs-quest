import test from "node:test";
import assert from "node:assert/strict";

import { validateEvalTarget } from "./evalTarget.mjs";

const prod = "https://hufs-quest.vercel.app";
const preview = "https://test-preview.example.com";

test("공식 실서비스 주소 허용", () => {
  assert.equal(validateEvalTarget(prod), prod);
});

test("명시적으로 승인된 Preview 주소 허용", () => {
  assert.equal(
    validateEvalTarget(preview, preview),
    preview
  );
});

test("승인되지 않은 Preview 차단", () => {
  assert.throws(
    () => validateEvalTarget(preview),
    /승인된 Preview/
  );
});

test("다른 HTTPS 주소 차단", () => {
  assert.throws(
    () => validateEvalTarget(
      "https://other.example.com",
      preview
    ),
    /승인된 Preview/
  );
});

test("HTTP 주소 차단", () => {
  assert.throws(
    () => validateEvalTarget(
      "http://hufs-quest.vercel.app"
    ),
    /HTTPS origin/
  );
});

test("공식 주소를 흉내 낸 외부 주소 차단", () => {
  assert.throws(
    () => validateEvalTarget(
      prod + ".example.com"
    ),
    /승인된 Preview/
  );
});

test("사용자 정보가 들어간 주소 차단", () => {
  assert.throws(
    () => validateEvalTarget(
      "https://user@hufs-quest.vercel.app"
    ),
    /HTTPS origin/
  );
});

test("추가 경로가 포함된 주소 차단", () => {
  assert.throws(
    () => validateEvalTarget(prod + "/other"),
    /HTTPS origin/
  );
});

test("쿼리 및 해시가 포함된 주소 차단", () => {
  for (const suffix of ["?test=1", "#test"]) {
    assert.throws(
      () => validateEvalTarget(prod + suffix),
      /HTTPS origin/
    );
  }
});

test("주소 끝 슬래시 호환성 유지", () => {
  assert.equal(
    validateEvalTarget(prod + "/"),
    prod
  );
});
