/**
 * ===== 射箭答題 · 班級排行榜後端（Google Apps Script）=====
 *
 * 用途：記住每位學生的最高分，讓全班在同一份排行榜上比較。
 * 資料存在你 Drive 裡的一份 Google Sheet，你隨時可以自己看／刪。
 *
 * 【一次性設定，約 5 分鐘】
 * 1. 開 https://sheets.new 建一份新試算表，命名為「射箭排行榜」。
 *    第一列打上這些標題（A1 開始）：
 *    班別 | 姓名 | 答對 | 總題數 | 用時秒 | 時間戳
 * 2. 複製網址中 /d/ 與 /edit 之間那串（試算表 ID）。
 * 3. 在該試算表選「擴充功能 → Apps Script」。
 * 4. 把本檔全部內容貼進編輯器，把下面的 SHEET_ID 換成你剛才那串 ID。
 * 5. 按「部署 → 新增部署 → 類型選『網頁應用程式』」
 *    執行身分：我
 *    誰可以存取：任何人
 *    按部署 → 授權（會出現 Google 警告，選「進階 → 前往」）。
 * 6. 複製那個「網頁應用程式網址」（結尾是 /exec），貼回遊戲的「班級排行榜」欄位。
 *
 * 之後改題目不用重做，只有改本檔程式才要重新部署。
 */

var SHEET_ID = "把這裡換成你的試算表ID";
var SHEET_NAME = "工作表1";   // 你的分頁名稱，預設「工作表1」

function _sheet() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
}

function _rows() {
  var v = _sheet().getRange(2, 1, Math.max(_sheet().getLastRow() - 1, 1), 6).getValues();
  return v.filter(function (r) { return String(r[1]).trim() !== ""; });
}

/** 讀排行榜：GET ?class=4A → 回傳該班 JSON 陣列（按分數高→低、用時短→長） */
function doGet(e) {
  var cls = (e && e.parameter && e.parameter["class"]) || "";
  var out = _rows().filter(function (r) { return !cls || String(r[0]) === cls; })
    .map(function (r) {
      return { cls: String(r[0]), name: String(r[1]), score: Number(r[2]), total: Number(r[3]), time: Number(r[4]), ts: Number(r[5]) };
    })
    .sort(function (a, b) { return b.score - a.score || a.time - b.time; })
    .slice(0, 30);
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** 寫入成績：POST 一段 JSON（text/plain，避免 CORS 預檢）
 *  {cls,name,score,total,time} → 同一人只留最高分（同分留較快） */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    var cls = String(d.cls || ""), name = String(d.name || "").trim();
    if (!name) return _json({ ok: false, err: "no name" });
    var sh = _sheet();
    var rows = _rows();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === cls && String(rows[i][1]) === name) {
        var oldScore = Number(rows[i][2]), oldTime = Number(rows[i][4]);
        var better = d.score > oldScore || (d.score === oldScore && d.time < oldTime);
        if (better) {
          sh.getRange(i + 2, 2, 1, 5).setValues([[name, d.score, d.total, d.time, new Date()]]);
        }
        return _json({ ok: true, updated: better });
      }
    }
    sh.appendRow([cls, name, d.score, d.total, d.time, new Date()]);
    return _json({ ok: true, added: true });
  } catch (err) {
    return _json({ ok: false, err: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function _json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
