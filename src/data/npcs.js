import { BUILDINGS, doorTile } from "./campus.js";
import { isTouchDevice } from "../device.js";
import { getLang, isGuest } from "../state.js";

/*
 * 건물별 시연용 대사입니다. 한 줄에 두 행까지 들어가며, \n으로 행을 나눕니다.
 * 학사 규정을 말하는 대사는 학교 공식 페이지(2026-11-08 확인) 내용만 사용했습니다.
 * NPC가 그 건물의 실제 담당 부서라는 뜻은 아닙니다.
 * academic: true인 대사는 재학생 전용이고, 게스트에게는 기본 안내만 보여 줍니다(기획서의 외부인 체험 모드).
 */
const LINES = {
  // 본관 NPC는 재학생에게 질문 입력창을 엽니다(DialogScene.openAsk). 게스트에게는 기본 안내가 나옵니다.
  social: {
    academic: true,
    ko: [
      "여기는 사회과학관이에요.\n졸업학점은 입학 연도마다 달라요.",
      "서울캠퍼스 2025학년도 이후 입학생이\n이중전공을 하면 졸업학점은 126학점이에요.",
      "사범대학은 기준이 달라요.\n본인 학번의 공식 표를 꼭 확인하세요.",
    ],
    en: [
      "This is Social Sciences Hall.\nGraduation credits vary by entering year.",
      "Seoul Campus students entering from 2025 need\n126 credits to graduate on the double major track.",
      "The College of Education differs.\nCheck the official table for your class year.",
    ],
  },
  cyber: {
    academic: true,
    ko: [
      "여기는 사이버관이에요.\n수강신청 준비는 잘 되어 가나요?",
      "예비수강신청함에는 15강좌까지 담을 수 있어요.\n담기만 해서는 신청이 끝나지 않아요!",
      "수강신청 기간에 꼭 다시 신청하세요.\n세부 일정은 매 학기 공지를 확인하세요.",
    ],
    en: [
      "This is Cyber Hall.\nHow is your course registration going?",
      "The pre-registration basket holds up to 15 courses.\nAdding them doesn't complete registration!",
      "Register again during the registration period.\nCheck each semester's notice for exact dates.",
    ],
  },
  library: {
    ko: ["여기는 도서관이에요.\n오늘도 좋은 책을 만나길 바라요."],
    en: ["This is the Library.\nI hope you find a great book today."],
  },
  union: {
    ko: ["여기는 학생회관 및 기숙사예요.\n캠퍼스 생활이 궁금하면 또 들러 주세요."],
    en: ["This is the Student Union & Dorm.\nCome back any time to learn about campus life."],
  },
  gatehouse: {
    ko: ["한국외대 서울캠퍼스에 오신 걸 환영해요!\n이곳은 정문안내실이에요.", "건물 앞의 안내원들에게 말을 걸어 보세요.\n스페이스바를 누르면 대화할 수 있어요."],
    en: ["Welcome to HUFS Seoul Campus!\nThis is the Gate Office.", "Try talking to the guides outside each building.\nPress the space bar to start a conversation."],
    touch: {
      ko: ["한국외대 서울캠퍼스에 오신 걸 환영해요!\n이곳은 정문안내실이에요.", "건물 앞의 안내원들에게 말을 걸어 보세요.\n대화하기 버튼을 누르면 대화할 수 있어요."],
      en: ["Welcome to HUFS Seoul Campus!\nThis is the Gate Office.", "Try talking to the guides outside each building.\nTap the Talk button to start a conversation."],
    },
  },
};

const basicLines = (b) => ({
  ko: [`여기는 ${b.name}입니다.\n건물 안내는 아직 준비 중이에요.`],
  en: [`This is ${b.nameEn}.\nBuilding information is coming soon.`],
});

export function npcName(npc) {
  return getLang() === "en" ? `${npc.building.nameEn} Guide` : `${npc.building.name} 안내원`;
}

// 지금 언어와 로그인 상태에 맞는 대사를 돌려줍니다.
export function npcLines(npc) {
  const lines = LINES[npc.id];
  const usable = lines && !(lines.academic && isGuest()) ? lines : basicLines(npc.building);
  return (isTouchDevice() && usable.touch ? usable.touch : usable)[getLang()];
}

export const NPCS = BUILDINGS.map((building) => {
  const door = doorTile(building);
  return {
    id: building.id,
    building,
    // 입구 왼쪽 아래에 세워 문 앞 길을 막지 않습니다.
    tileX: door.x - 1,
    tileY: door.y + 1,
  };
});
