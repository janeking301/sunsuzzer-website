# SUNSUZZER Google Maps 自動辨識功能部署說明

前台已加入 Google Maps 網址欄位與店家資料展示；要真正取得店名、地址、電話與營業時間，還需要部署 Worker 並設定 Google Places API 金鑰。

## 1. 建立 Google Maps API 金鑰
1. 在 Google Cloud Console 建立或選擇專案。
2. 啟用 **Places API (New)**，並為專案設定帳單與使用額度限制。
3. 建立 API key。不要把這把金鑰放進前台 HTML。

Google 官方文件：
- https://developers.google.com/maps/documentation/places/web-service
- https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places

## 2. 部署 Cloudflare Worker
1. 登入 Cloudflare Dashboard，進入 Workers & Pages，建立 Worker。
2. 將 `worker/google-maps-lookup.js` 的內容貼進 Worker 編輯器並部署。
3. 在 Worker 的 Settings → Variables and Secrets 新增 Secret：
   - Name: `GOOGLE_MAPS_API_KEY`
   - Value: 你的 Google Maps API key
4. 複製 Worker 網址，例如 `https://sunsuzzer-place-lookup.<你的帳號>.workers.dev`。

## 3. 把 Worker 網址接回前台
在 `index.html` 搜尋：
```js
const PLACE_LOOKUP_ENDPOINT = "https://YOUR-WORKER.workers.dev/lookup";
```
將網址換成你自己的 Worker 網址並保留結尾 `/lookup`，提交 GitHub 更新。

## 4. 功能限制
- 使用者貼上 Google Maps 分享網址後，Worker 會嘗試解析並查詢 Google Places API。
- API 有資料時會回傳店名、地址、電話、營業時間與 Maps 連結。
- Google 未提供電話或營業時間時，欄位會顯示未提供，不會自行猜測。
- Google Maps API 可能產生費用；請先設定帳單提醒、配額與金額上限。
- 目前網站的訂單示意資料仍只儲存在瀏覽器 localStorage，尚未連接永久訂單資料庫。要讓後台跨裝置保存訂單，還需要另外接資料庫與管理介面。
