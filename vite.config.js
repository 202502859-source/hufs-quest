import { defineConfig } from "vite";

// 개발 서버는 public/planner/index.html을 /planner/ 주소로 열어 주지 않고 게임 첫 화면을 돌려줍니다.
// 배포(Vercel)와 같은 주소를 쓰도록 개발 서버에서만 /planner/ 를 index.html로 연결합니다.
const plannerIndex = {
  name: "planner-index",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === "/planner" || req.url === "/planner/" || req.url?.startsWith("/planner/?")) {
        req.url = "/planner/index.html" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [plannerIndex],
});
