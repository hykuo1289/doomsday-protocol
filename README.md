# 末日協議 Doomsday Protocol

手機優先的單機回合制策略遊戲。玩家與四個 AI 國家進行政治宣傳、核彈生產、防禦部署與核彈攻擊。

## 本機執行

```bash
npm install
npm run dev
```

## GitHub Pages

1. 在 GitHub 建立名為 `doomsday-protocol` 的 repository。
2. 將本專案全部檔案推送到 `main` 分支。
3. Repository → Settings → Pages → Source 選擇 **GitHub Actions**。
4. 推送後由 `.github/workflows/deploy.yml` 自動建置與發布。

若 repository 名稱不是 `doomsday-protocol`，請同步修改 `vite.config.ts` 的 `base`。

## 遊戲規則摘要

- 防禦上限 3 層；有防禦時攔截率 60%；每次遭攻擊消耗 1 層。
- 生產武器一次產生 1 至 5 枚核彈，人口越多越可能高產。
- 人口歸零立即滅亡並停止行動。
- AI 依仇恨值加權選擇宣傳及攻擊目標。
- 介面只顯示各 AI 對玩家的仇恨值，不在行動紀錄顯示仇恨增減。
