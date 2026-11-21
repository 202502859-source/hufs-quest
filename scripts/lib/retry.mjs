// ingest가 쓰는 재시도 · 진행 표시 도우미. 네트워크를 직접 부르지 않는 순수 함수라 테스트에서 바로 씁니다.
// 테스트: scripts/lib/retry.test.mjs (npm test)

// 11/20 ingest가 두 번 중간에 끊김(DNS ENOTFOUND, 340/485에서 종료). 짧은 끊김은 같은 조각을 다시 시도해 넘깁니다.
export const RETRY_DELAYS_MS = [2000, 5000, 10000];

// fn을 실행하고, 실패하면 delays 간격으로 다시 시도합니다(처음 1번 + 다시 시도 delays.length번).
// 모두 실패하면 마지막 오류에 attempts(시도 횟수)를 붙여 던집니다. onRetry(오류, 다음 시도 번호, 기다릴 ms)로 알립니다.
export async function withRetry(fn, { delays = RETRY_DELAYS_MS, sleep = defaultSleep, onRetry = () => {} } = {}) {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await fn(attempt);
    } catch (err) {
      const wait = delays[attempt - 1];
      if (wait === undefined) throw Object.assign(err, { attempts: attempt });
      onRetry(err, attempt + 1, wait);
      await sleep(wait);
    }
  }
}

// 진행 표시: every개마다, 그리고 마지막 조각에서 한 줄. 아니면 null.
export function progressLine(done, total, every = 50) {
  if (done === total || done % every === 0) return `임베딩 ${done}/${total}`;
  return null;
}

// 멈춘 지점 안내 문구. index는 0부터 센 조각 위치, savedCount는 DB에 저장을 마친 조각 수입니다.
export function stopMessage({ step, index, id, total, savedCount, error }) {
  return [
    `중단: ${index + 1}번째 조각(id ${id})의 ${step}에서 다시 시도까지 모두 실패했습니다 (${total}개 중).`,
    `  오류: ${error?.message ?? error}`,
    `  DB에 저장을 마친 조각: 앞 ${savedCount}개. 옛 조각 삭제는 하지 않았습니다(테이블에 옛 조각과 새 조각이 섞여 있을 수 있음).`,
    "  네트워크를 확인한 뒤 같은 명령으로 다시 실행하면 처음부터 다시 저장합니다.",
  ].join("\n");
}

function defaultSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
