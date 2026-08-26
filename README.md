# 生活帳本

依你原本 Excel 記帳表格式做的網頁記帳工具，資料存在 Firebase Firestore，電腦、手機都能開，登入同一個帳號資料就會同步。

## 一、設定 Firebase（約 5 分鐘）

1. 到 [Firebase Console](https://console.firebase.google.com/) 建立一個新專案。
2. 左側選單「Build → Authentication」→「Get started」→ 啟用「Email/Password」登入方式。
3. 左側選單「Build → Firestore Database」→「Create database」→ 選 production mode，地區選 asia-east1（或任一）。
4. 建立好之後，點左側「Firestore Database → 規則」，把內容換成本專案根目錄的 `firestore.rules`（貼上後按發布）。
5. 左側選單「專案設定」（齒輪圖示）→ 往下捲到「我的應用程式」→ 點 網頁圖示 `</>` 新增一個網頁應用程式 → 註冊後會看到一段 `firebaseConfig`。
6. 把那段設定值貼到 `src/firebase.js` 裡取代 `YOUR_API_KEY` 等等的佔位字。

## 二、上傳到 GitHub

```bash
cd ledger-app
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的帳號/你的repo名稱.git
git push -u origin main
```

## 三、開啟 GitHub Pages

1. 打開你 GitHub 上的 repo → Settings → Pages。
2. 「Build and deployment → Source」選 **GitHub Actions**。
3. 打開 `vite.config.js`，把 `base: "/ledger-app/"` 改成 `base: "/你的repo名稱/"`（要跟 repo 名稱完全一致），存檔後 commit + push。
4. push 到 `main` 分支後，repo 的 Actions 分頁會自動跑建置流程，跑完後網址會是：
   `https://你的帳號.github.io/你的repo名稱/`

之後每次 push 到 main，網站都會自動重新部署。

## 四、開始使用

1. 打開部署好的網址，第一次使用點「第一次使用？建立帳號」，用 email + 密碼建立一個帳號（這組帳密只有你自己用）。
2. 手機也打開同一個網址，用同一組帳密登入，資料就會跟電腦同步（Firestore 即時同步，兩邊都會自動更新）。
3. 可以把網頁加到手機主畫面（Safari／Chrome 選單裡的「加入主畫面」），開起來就像 App 一樣。

## 本機測試（選用）

```bash
npm install
npm run dev
```

## 檔案說明

- `src/App.jsx`：主要畫面與邏輯
- `src/firebase.js`：Firebase 連線設定（要填自己的 config）
- `firestore.rules`：資料庫安全規則，只允許登入者存取自己的資料
- `.github/workflows/deploy.yml`：自動部署到 GitHub Pages 的流程
