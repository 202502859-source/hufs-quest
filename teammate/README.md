# HUFS WORLD v4.1 — 프로젝트 통합 패키지

## 파일 설명
- `hufs-world.html`: 독립 실행 가능한 전체 시제품 (캠퍼스 그래픽 지도 + 본전공/이중전공/부전공 수강추천)
- `hufs-embed.js`: 기존 웹 프로젝트에 붙이기 위한 ES module 함수
- `example.html`: 통합 예제

## 가장 쉬운 통합 (HTML, React, Vue 무관)
정적 파일이 서비스되는 경로에 `hufs-world.html`을 복사합니다. 그리고 기존 페이지에 다음 코드를 추가합니다.

```html
<iframe src="/hufs-world.html" title="HUFS WORLD" style="width:100%;height:900px;border:0"></iframe>
```

수강추천 화면으로 바로 열려면 `/hufs-world.html?page=course`를 사용합니다.

## 이벤트를 받는 통합 (Vanilla JS)
`hufs-world.html`, `hufs-embed.js`를 같은 서버의 공개 디렉터리에 배치하고:

```html
<div id="hufs-root"></div>
<script type="module">
import { mountHufsWorld } from '/hufs-embed.js';
const hufs = mountHufsWorld(document.querySelector('#hufs-root'), {
  src: '/hufs-world.html',
  initialPage: 'course',
  onEvent(type, detail) {
    if (type === 'basket-changed') console.log('시간표 장바구니:', detail);
    if (type === 'place-selected') console.log('선택 건물:', detail);
  }
});
// hufs.openCampus(); hufs.openPlanner(); hufs.getBasket(); hufs.destroy();
</script>
```

## React 예시
```jsx
import { useEffect, useRef } from 'react';
import { mountHufsWorld } from './hufs-embed.js';
export default function HufsPage() {
  const root = useRef(null);
  useEffect(() => {
    const instance = mountHufsWorld(root.current, {
      src: '/hufs-world.html', initialPage: 'course',
      onEvent: (type, detail) => console.log(type, detail)
    });
    return () => instance.destroy();
  }, []);
  return <div ref={root} />;
}
```

## 주요 이벤트
- `basket-changed`: `{major, additionalMode, additionalMajor, year, courses:[{id,name,category,section,credits,slots}]}`
- `place-selected`: `{id,name}`
- `navigation`: `{page:'campus'|'course'}`

## 실제 서비스 전 반드시 교체할 부분
- 강좌/학점/시간표: HTML 내부 `courseSet`, `electives` 는 모두 가상의 시연 데이터. 학교 공식 개설강좌로 교체 필요.
- 강의평가: `ratings`는 가상의 숫자. 실제 평점 사용 시 합법적 사용 권한과 출처/동의를 확인해야 함.
- 전공/이중전공/부전공 이수요건: 학교 교육과정 데이터를 연도별로 검증해야 함.
- 지도: 그래픽 개념도. 실제 건물 위치, 경로, 실내 접근 조건과 일치하지 않음.
- LLM: 현재는 시뮬레이션/규칙 기반 추천, 실제 LLM API 및 RAG 미연동.
- 실제 수강신청/장바구니 서버로 저장되지 않음.
- `postMessage` 수신 시 사용 서버에 맞춰 허용된 부모 origin 검증을 강화할 것.

## 로컬 실행
보안 정책 때문에 `file://` 환경에서 JS module import가 제한될 수 있습니다. 개발 서버에서 실행하세요.

```bash
python3 -m http.server 8080
# http://localhost:8080/example.html
```
