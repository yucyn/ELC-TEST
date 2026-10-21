# ELC SPEC V3.3｜Excel → Notion 同步 Web App（部署原始碼）

**這不是離線 HTML。** 需部署到 Vercel，才能執行 Excel 解析及安全存取 Notion API。未設定環境變數前，「讀取 Notion」與同步不會運作。

## 1. 準備 Notion Integration

1. 在 Notion 建立 Internal integration，複製 token；不要貼在網頁、HTML 或 GitHub。
2. 將 `ELC Lighting Database` 頁面授權給該 integration，必須含三個子資料庫的讀寫權限。
3. 依照 `.env.example` 建立 Vercel 專案環境變數：`NOTION_TOKEN`、`ELC_ACCESS_KEY` 及三個資料源 ID。
4. 於 Vercel 匯入此資料夾的 GitHub Repo 部署；Framework Preset 選 **Other**，Output Directory 留空，使用根目錄 `public` 提供 HTML，`api` 提供 Serverless Functions。
5. 開啟網站，輸入 `ELC_ACCESS_KEY`；按「讀取 Notion 最新資料」測試。預設資料源 ID 已對應既有 ELC Notion 資料庫。

## 2. 日常使用

1. 按「讀取 Notion 最新資料」。
2. 上傳 `.xls` / `.xlsx` / `.csv`，按「開始辨識 Excel」，選擇工作表。
3. 確認欄位對應，點「辨識資料並比對 Notion」。
4. 型號一致的項目會初步通過；新增、差異需人工核准。
5. 填工程名稱、**新的唯一專案編號**，按「確認整批同步 Notion」。
6. 網頁會顯示新增或跳過的項目；可至 Notion 確認。

## 3. 安全與限制

- 密鑰只放在 Vercel 環境變數；不要存前端程式。Vercel 的存取密碼只是初期單人密碼門檻，不是完善的多使用者登入/權限系統，正式多人用應導入 SSO 或驗證服務。
- 本版為 **新增＋跳過現有資料**，不修改 Notion 已有產品或專案燈具。這是避免覆寫正確資料的刻意限制。
- 傳送前會即時重新比對產品規格，若不一致則拒絕此次同步。
- Notion API 沒有跨多筆交易；若部分寫入成功會回傳部分成功清單；再次同步可跳過既有產品、專案及燈具。
- 若一個既有產品的同型號出現不同規格，需在 Notion 人工核對；不可默默合併。
- 匯入程式將「原始規格」保留；產品資料標示「待確認」，**不能視為原廠核准資料**。
- 複雜 Excel（合併儲存格、無欄名、跨列規格）仍需手動確認欄位；辨識不到的資料不會自動匯入。
- 每次最多 80 筆，來源檔限 6MB，超過請分批；生產環境應加入稽核記錄、備份與速率限制。
- `xlsx@0.18.5` 用於舊 `.xls` 相容性，屬較舊的套件版本，部署前應評估安全掃描與替換為持續維護的 XLS 解析方案；避免上傳來路不明的 Excel。
- 未在使用者自己的 Vercel / Notion 帳戶執行端對端測試，不保證 Notion 授權與 API 對應已配置成功。

## 4. 必須確認的 Notion 欄位

- Lighting Products：產品名稱、品牌、完整型號、燈具類型、原始規格、資料來源、確認狀態、功率W、光通量lm、CRI、SDCM、IP等級。
- Lighting Projects：專案名稱、專案編號、專案狀態、資料來源。
- Project Fixtures：燈具名稱、燈具編號、完整型號、數量、單位、原始預算規格、資料狀態、所屬專案、產品參照。

若任何欄位在 Notion 被重新命名，後端也需要調整同名屬性。DXF 匯出與原廠型錄比對不包含在 V3.3 的同步功能中。
