/* 배포 환경에 맞춰 바꾸는 설정입니다. 비밀 키는 이 파일에 넣지 마세요(브라우저에 그대로 노출됩니다). */
window.GAME_CONFIG = {
  // Vercel 배포 후 "/api/npc"로 바꾸면 HyperCLOVA X 답변을 사용합니다. null이면 브라우저 안에서 근거 문장만 찾아 보여 줍니다.
  npcEndpoint: null,
  dailyPointCap: 100,
};
