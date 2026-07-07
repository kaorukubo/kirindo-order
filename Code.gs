/**
 * キリン堂 青果 自動発注・店舗振分 Webアプリ
 * Google Apps Script バックエンド
 *
 * スプレッドシート構成（シート名は定数 SHEET_* を参照）
 * ─────────────────────────────────────────────────────
 * 【商品マスタ】
 *   A列: 商品名
 *   B列: 発注単位（ケース入数）
 *
 * 【店舗・商品別マスタ】
 *   A列: 店舗名
 *   B列: 商品名
 *   C列: 基本陳列数
 *
 * 【曜日・天候マスタ】
 *   A列: 曜日（日/月/火/水/木/金/土）
 *   B列: 天候（晴れ/曇り/雨 など）
 *   C列: 係数（数値、例: 1.0, 1.2）
 *
 * 【発注・振分実績】
 *   A列: 日付 / B列: 商品名 / C列: 総発注数 / D列: ケース数 / E列: バラ数
 *   F〜K: 店舗1〜6振分 / L〜Q: 店舗1〜6ロス / R: 天候 / S: 確定日時
 *
 * 【販売実績】※日次の店舗×商品実績
 *   A列: 日付 / B列: 店舗名 / C列: 商品名 / D列: 販売数 / E列: ロス数
 *
 * 【過去販売インポート】※CSV貼付用ステージング
 *   A列: 日付 / B列: 店舗名 / C列: 商品名 / D列: 販売数 / E列: ロス数
 *
 * 【ラベル発行】※週次ラベル枚数（過去1週間の販売合計）
 *   A列: 週開始日 / B列: 店舗名 / C列: 商品名 / D列: ラベル枚数
 *   E列: 集計期間From / F列: 集計期間To / G列: 発行日時
 */

/** @const {string} このスプレッドシートの ID（デプロイ前に設定） */
const SPREADSHEET_ID = ''; // 空の場合はスクリプトが紐づくスプレッドシートを使用

/** @const {string} */
const SHEET_PRODUCTS = '商品マスタ';
/** @const {string} */
const SHEET_STORE_PRODUCTS = '店舗・商品別マスタ';
/** @const {string} */
const SHEET_DAY_WEATHER = '曜日・天候マスタ';
/** @const {string} */
const SHEET_RESULTS = '発注・振分実績';
/** @const {string} Excel取込用ステージングシート */
const SHEET_IMPORT = '過去実績インポート';
/** @const {string} 日次販売実績 */
const SHEET_SALES = '販売実績';
/** @const {string} 過去販売CSV貼付用 */
const SHEET_SALES_IMPORT = '過去販売インポート';
/** @const {string} 週次ラベル発行 */
const SHEET_LABELS = 'ラベル発行';
/** @const {string} A4印刷用・Excel書き出し */
const SHEET_ORDER_PRINT = '発注書（印刷）';

/** @const {string[]} 発注・振分実績の列定義 */
const RESULT_HEADERS = [
  '日付', '商品名', '総発注数（個数）', 'ケース数', 'バラ数',
  '店舗1振分', '店舗2振分', '店舗3振分', '店舗4振分', '店舗5振分', '店舗6振分',
  '店舗1ロス', '店舗2ロス', '店舗3ロス', '店舗4ロス', '店舗5ロス', '店舗6ロス',
  '天候', '確定日時',
];

/** @const {string[]} 販売実績の列定義（CSVテンプレートも同じ） */
const SALES_HEADERS = ['日付', '店舗名', '商品名', '販売数', 'ロス数'];

/** @const {string[]} ラベル発行の列定義 */
const LABEL_HEADERS = ['週開始日', '店舗名', '商品名', 'ラベル枚数', '集計期間From', '集計期間To', '発行日時'];

/** @const {string[]} 曜日 */
const DAY_NAMES_ = ['日', '月', '火', '水', '木', '金', '土'];

/** @const {number} 想定店舗数（実データ: 4店舗） */
const STORE_COUNT = 4;

/** @const {number} 納品リードタイム（発注日から店舗納品までの日数） */
const DELIVERY_LEAD_DAYS = 2; // 今日発注 → 明日到着 → 明後日店舗納品

/** @const {number} 神戸市の緯度経度（Open-Meteo用） */
const KOBE_LAT = 34.6901;
const KOBE_LON = 135.1956;

/** @const {number} クイック取込の日数（直近N日のCSVのみ） */
const SALES_IMPORT_QUICK_DAYS = 14;
/** @const {number} 全件取込の1回あたりファイル数 */
const SALES_IMPORT_BATCH_SIZE = 10;
/** @const {string} 取込済みファイルメタ保存キー */
const SALES_IMPORT_META_KEY = 'SALES_CSV_IMPORT_META';

/**
 * Webアプリ入口
 * @param {GoogleAppsScript.Events.DoGet} e
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  // 初回セットアップ: /exec?setup=1 でマスタ投入
  if (e && e.parameter && e.parameter.setup === '1') {
    var result = initSampleData();
    return ContentService.createTextOutput(JSON.stringify(result, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.importSales === '1') {
    var importResult = importSalesFromSheet();
    return ContentService.createTextOutput(JSON.stringify(importResult, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.importDriveSales === '1') {
    var driveImport = importSalesFromDriveQuick_();
    return ContentService.createTextOutput(JSON.stringify(driveImport, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.rebuild === '1') {
    var rebuildResult = initSampleData();
    return ContentService.createTextOutput(JSON.stringify(rebuildResult, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.clearSales === '1') {
    var clearResult = clearSalesData_();
    return ContentService.createTextOutput(JSON.stringify(clearResult, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('青果 発注・振分')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

/**
 * スプレッドシート取得
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * シート取得（なければヘッダー付きで作成）
 * @param {string} name
 * @param {string[]} [headers]
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  }
  return sheet;
}

/**
 * 2次元配列をオブジェクト配列に変換（1行目ヘッダー）
 * @param {Array<Array<*>>} values
 * @returns {Array<Object<string, *>>}
 */
function rowsToObjects_(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1)
    .filter(function (row) { return row.some(function (cell) { return cell !== '' && cell != null; }); })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (key, i) {
        obj[key] = row[i];
      });
      return obj;
    });
}

/**
 * マスタデータ一括取得 API
 * @returns {Object}
 */
function getMasterData() {
  try {
    ensureMasterInitialized_();
    const ss = getSpreadsheet_();

    const productSheet = ss.getSheetByName(SHEET_PRODUCTS);
    const storeProductSheet = ss.getSheetByName(SHEET_STORE_PRODUCTS);
    const dayWeatherSheet = ss.getSheetByName(SHEET_DAY_WEATHER);

    if (!productSheet || !storeProductSheet || !dayWeatherSheet) {
      throw new Error('必要なマスタシートが見つかりません。シート名を確認してください。');
    }

    const productsRaw = rowsToObjects_(productSheet.getDataRange().getValues());
    const storeProductsRaw = rowsToObjects_(storeProductSheet.getDataRange().getValues());
    const dayWeatherRaw = rowsToObjects_(dayWeatherSheet.getDataRange().getValues());

    /** 商品マスタ正規化 */
    const products = productsRaw.map(function (row) {
      return {
        name: String(row['商品名'] || '').trim(),
        orderUnit: Number(row['発注単位（ケース入数）'] || row['発注単位'] || 1) || 1,
      };
    }).filter(function (p) { return p.name; });

    /** 店舗名（実データ固定順） */
    const storeOrder = REAL_STORES_.map(function (s) { return s.name; });

    /** 店舗×商品マップ */
    const storeProductMap = {};
    storeProductsRaw.forEach(function (row) {
      const storeName = String(row['店舗名'] || '').trim();
      const productName = String(row['商品名'] || '').trim();
      const baseDisplay = Number(row['基本陳列数'] || 0);
      if (!storeName || !productName) return;
      if (!storeProductMap[productName]) {
        storeProductMap[productName] = {};
      }
      storeProductMap[productName][storeName] = baseDisplay;
    });

    /** 曜日×天候係数マップ */
    const coefficientMap = {};
    const weatherOptions = [];
    dayWeatherRaw.forEach(function (row) {
      const day = String(row['曜日'] || '').trim();
      const weather = String(row['天候'] || '').trim();
      const coef = Number(row['係数'] || 1);
      if (!day || !weather) return;
      if (!coefficientMap[day]) {
        coefficientMap[day] = {};
      }
      coefficientMap[day][weather] = coef;
      if (weatherOptions.indexOf(weather) === -1) {
        weatherOptions.push(weather);
      }
    });

    /** 店舗×商品リスト（店舗ベースUI用） */
    const storeProducts = {};
    storeOrder.slice(0, STORE_COUNT).forEach(function (storeName) {
      storeProducts[storeName] = products.map(function (p) {
        return {
          name: p.name,
          orderUnit: p.orderUnit,
          baseDisplay: Number((storeProductMap[p.name] || {})[storeName]) || 0,
        };
      });
    });

    /** 今週のラベル発行状況 */
    const weekStart = formatDateCell_(getWeekStart_(new Date()));
    const weeklyLabels = getWeeklyLabels_(weekStart);

    /** 直近7日の店舗別販売比率（CSV数量比率按分用） */
    const salesRatio = buildSalesRatio_(7);

    /** 店舗略称 */
    const storeShortNames = {};
    REAL_STORES_.forEach(function (s) { storeShortNames[s.name] = s.short; });

    return {
      success: true,
      products: products,
      storeOrder: storeOrder.slice(0, STORE_COUNT),
      storeShortNames: storeShortNames,
      storeProducts: storeProducts,
      storeProductMap: storeProductMap,
      coefficientMap: coefficientMap,
      weatherOptions: weatherOptions,
      salesRatio: salesRatio,
      weekStart: weekStart,
      weeklyLabels: weeklyLabels,
      deliveryLeadDays: DELIVERY_LEAD_DAYS,
      salesDateDefault: addDaysStr_(formatDateCell_(new Date()), -1),
      lossDateDefault: addDaysStr_(formatDateCell_(new Date()), 1),
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || String(err),
    };
  }
}

// ─── 神戸市 天気予報 ─────────────────────────────────────

/**
 * 指定日の店舗×商品 販売数・ロス数を取得
 * 販売実績: 今日届く分（通常は発注日-1日の検収日）
 * ロス: 明日納品時に確定（通常は発注日+1日）
 * @param {string} salesDate yyyy-MM-dd
 * @param {string} lossDate yyyy-MM-dd
 * @returns {Object}
 */
function getStoreInputData(salesDate, lossDate) {
  try {
    var salesDateStr = formatDateCell_(salesDate);
    var lossDateStr = formatDateCell_(lossDate);
    var sales = {};
    var losses = {};

    var sheet = getSpreadsheet_().getSheetByName(SHEET_SALES);
    if (sheet && sheet.getLastRow() >= 2) {
      var values = sheet.getDataRange().getValues();
      for (var r = 1; r < values.length; r++) {
        var d = formatDateCell_(values[r][0]);
        var store = String(values[r][1] || '').trim();
        var product = String(values[r][2] || '').trim();
        var qty = Number(values[r][3]) || 0;
        var loss = Number(values[r][4]) || 0;
        if (!store || !product) continue;

        if (d === salesDateStr) {
          if (!sales[store]) sales[store] = {};
          sales[store][product] = (sales[store][product] || 0) + qty;
        }
        if (d === lossDateStr) {
          if (!losses[store]) losses[store] = {};
          losses[store][product] = (losses[store][product] || 0) + loss;
        }
      }
    }

    return {
      success: true,
      salesDate: salesDateStr,
      lossDate: lossDateStr,
      sales: sales,
      losses: losses,
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

/**
 * 販売実績シートをクリア（テストデータ削除用）
 * @returns {Object}
 */
function clearSalesData_() {
  writeSheet_(SHEET_SALES, SALES_HEADERS, []);
  return { success: true, message: '販売実績をクリアしました。' };
}

/**
 * 発注日から納品日・到着日を算出
 * @param {string} [orderDateStr] yyyy-MM-dd（省略時は今日）
 * @returns {Object}
 */
function calcDeliverySchedule_(orderDateStr) {
  var orderDate = orderDateStr
    ? new Date(orderDateStr + 'T00:00:00')
    : new Date();
  orderDate.setHours(0, 0, 0, 0);

  var arrivalDate = new Date(orderDate);
  arrivalDate.setDate(arrivalDate.getDate() + 1);

  var deliveryDate = new Date(orderDate);
  deliveryDate.setDate(deliveryDate.getDate() + DELIVERY_LEAD_DAYS);

  return {
    orderDate: formatDateCell_(orderDate),
    arrivalDate: formatDateCell_(arrivalDate),
    deliveryDate: formatDateCell_(deliveryDate),
    deliveryDayName: getDayNameFromDateStr_(formatDateCell_(deliveryDate)),
  };
}

/**
 * 神戸市の天気予報を取得し、納品日の天候を返す
 * Open-Meteo API（無料・APIキー不要）
 * @param {string} [orderDateStr] 発注日 yyyy-MM-dd
 * @returns {Object}
 */
function getKobeWeatherForecast(orderDateStr) {
  try {
    var schedule = calcDeliverySchedule_(orderDateStr);
    var deliveryStr = schedule.deliveryDate;

    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + KOBE_LAT
      + '&longitude=' + KOBE_LON
      + '&daily=weather_code'
      + '&timezone=Asia%2FTokyo'
      + '&forecast_days=16';

    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      throw new Error('天気予報の取得に失敗しました（HTTP ' + resp.getResponseCode() + '）');
    }

    var data = JSON.parse(resp.getContentText());
    if (!data.daily || !data.daily.time) {
      throw new Error('天気予報データの形式が不正です');
    }

    var idx = data.daily.time.indexOf(deliveryStr);
    var code = idx >= 0 ? data.daily.weather_code[idx] : null;
    var weather = code != null ? wmoCodeToWeather_(code) : null;

    // マスタに存在する天候名に合わせる（なければ曇り）
    if (!weather) {
      weather = '曇り';
    }

    return {
      success: true,
      location: '神戸市',
      orderDate: schedule.orderDate,
      arrivalDate: schedule.arrivalDate,
      deliveryDate: schedule.deliveryDate,
      deliveryDayName: schedule.deliveryDayName,
      weather: weather,
      weatherCode: code,
      source: 'Open-Meteo',
    };
  } catch (err) {
    var schedule = calcDeliverySchedule_(orderDateStr);
    return {
      success: false,
      message: err.message || String(err),
      orderDate: schedule.orderDate,
      arrivalDate: schedule.arrivalDate,
      deliveryDate: schedule.deliveryDate,
      deliveryDayName: schedule.deliveryDayName,
    };
  }
}

/**
 * WMO天気コード → マスタ天候（晴れ/曇り/雨）
 * @param {number} code
 * @returns {string}
 */
function wmoCodeToWeather_(code) {
  if (code === 0 || code === 1) return '晴れ';
  if (code === 2 || code === 3 || code === 45 || code === 48) return '曇り';
  if (code >= 51 && code <= 67) return '雨';
  if (code >= 71 && code <= 77) return '雨';
  if (code >= 80 && code <= 82) return '雨';
  if (code >= 95 && code <= 99) return '雨';
  return '曇り';
}

/**
 * マスタ天候リストに合わせて天候名を正規化
 * @param {string} weather
 * @param {string[]} options
 * @returns {string}
 */
function normalizeWeatherOption_(weather, options) {
  if (options.indexOf(weather) >= 0) return weather;
  if (weather === '晴れ' && options.indexOf('晴') >= 0) return '晴';
  return options.length ? options[0] : weather;
}

/**
 * 発注・振分実績の保存 API
 * @param {Object} payload
 * @param {string} payload.targetDate - 納品日 yyyy-MM-dd
 * @param {string} payload.orderDate - 発注日 yyyy-MM-dd
 * @param {string} payload.weather - 天候
 * @param {Array<Object>} payload.items - 商品ごとの確定データ
 * @returns {Object}
 */
function saveOrderResults(payload) {
  try {
    if (!payload || !payload.targetDate || !Array.isArray(payload.items)) {
      throw new Error('保存データが不正です。');
    }

    const headers = RESULT_HEADERS;
    const sheet = getOrCreateSheet_(SHEET_RESULTS, headers);
    const storeOrder = payload.storeOrder || [];
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const rows = [];
    const salesRows = [];

    payload.items.forEach(function (item) {
      const allocations = item.allocations || [];
      const losses = item.losses || [];
      const sales = item.sales || [];

      const row = [
        payload.targetDate,
        item.productName,
        item.totalUnits || 0,
        item.cases || 0,
        item.remainder || 0,
      ];

      for (var i = 0; i < STORE_COUNT; i++) {
        row.push(allocations[i] != null ? allocations[i] : 0);
      }
      for (var j = 0; j < STORE_COUNT; j++) {
        row.push(losses[j] != null ? losses[j] : 0);
        if (storeOrder[j]) {
          salesRows.push([
            payload.targetDate,
            storeOrder[j],
            item.productName,
            sales[j] != null ? sales[j] : 0,
            losses[j] != null ? losses[j] : 0,
          ]);
        }
      }

      row.push(payload.weather || '');
      row.push(now);
      rows.push(row);
    });

    if (rows.length === 0) {
      throw new Error('保存する商品データがありません。');
    }

    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);

    if (salesRows.length > 0) {
      appendSalesRows_(salesRows, true);
    }

    return {
      success: true,
      message: rows.length + '件の発注データを保存しました。',
      savedCount: rows.length,
      storeOrder: storeOrder,
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || String(err),
    };
  }
}

/**
 * 発注確認データを A4 印刷用シートへ書き出し（Excel ダウンロード用）
 * @param {Object} payload
 * @returns {Object}
 */
function exportOrderToPrintSheet(payload) {
  try {
    if (!payload || !Array.isArray(payload.items)) {
      throw new Error('書き出しデータが不正です。');
    }

    var items = payload.items.filter(function (it) {
      return (Number(it.totalUnits) || 0) > 0;
    });
    if (items.length === 0) {
      throw new Error('発注する商品がありません。');
    }

    var storeOrder = payload.storeOrder || [];
    var storeShort = payload.storeShortNames || {};
    var orderDate = String(payload.orderDate || '');
    var deliveryDate = String(payload.targetDate || '');
    var weather = String(payload.weather || '');
    var arrivalDate = addDaysStr_(orderDate, 1);

    var rows = buildOrderPrintRows_(items, storeOrder, storeShort, {
      orderDate: orderDate,
      deliveryDate: deliveryDate,
      arrivalDate: arrivalDate,
      weather: weather,
    });

    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(SHEET_ORDER_PRINT);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_ORDER_PRINT);
    } else {
      sheet.clear();
    }

    var colCount = rows.reduce(function (max, row) {
      return Math.max(max, row.length);
    }, 1);
    while (colCount < 12) colCount++;

    var padded = rows.map(function (row) {
      var r = row.slice();
      while (r.length < colCount) r.push('');
      return r;
    });

    sheet.getRange(1, 1, padded.length, colCount).setValues(padded);
    sheet.getRange(1, 1, 1, colCount).setFontWeight('bold').setFontSize(12);
    sheet.getRange(1, 10, 1, 11).setFontWeight('bold');

    var orderHeaderRow = findRowIndex_(padded, 'No', '商品名');
    if (orderHeaderRow >= 0) {
      sheet.getRange(orderHeaderRow + 1, 1, 1, 4).setFontWeight('bold').setBackground('#f0fdf4');
    }
    var matrixHeaderRow = findRowIndex_(padded, '商品名', '合計');
    if (matrixHeaderRow >= 0) {
      var matrixCols = 2 + storeOrder.length;
      sheet.getRange(matrixHeaderRow + 1, 1, 1, matrixCols).setFontWeight('bold').setBackground('#f0fdf4');
      sheet.setFrozenRows(matrixHeaderRow + 1);
    }

    sheet.setColumnWidth(1, 42);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 64);
    sheet.setColumnWidth(4, 64);
    for (var c = 5; c <= colCount; c++) {
      sheet.setColumnWidth(c, 56);
    }

    var ssId = ss.getId();
    var gid = sheet.getSheetId();
    return {
      success: true,
      message: items.length + '品を「' + SHEET_ORDER_PRINT + '」シートに書き出しました。',
      sheetUrl: ss.getUrl() + '#gid=' + gid,
      xlsxUrl: 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=xlsx&gid=' + gid,
      itemCount: items.length,
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || String(err),
    };
  }
}

/**
 * @param {Array<Object>} items
 * @param {string[]} storeOrder
 * @param {Object<string,string>} storeShort
 * @param {Object} meta
 * @returns {Array<Array>}
 */
function buildOrderPrintRows_(items, storeOrder, storeShort, meta) {
  var orderDate = meta.orderDate || '';
  var deliveryDate = meta.deliveryDate || '';
  var arrivalDate = meta.arrivalDate || '';
  var weather = meta.weather || '';
  var dnDelivery = dayNameFromDateStr_(deliveryDate);
  var dnArrival = dayNameFromDateStr_(arrivalDate);
  var shortDelivery = shortDateJp_(deliveryDate);
  var shortArrival = shortDateJp_(arrivalDate);

  var rows = [];
  rows.push(['畑光　様', '', '', '', '', '', '', '', '', 'Isaten Foods株式会社', '']);
  rows.push(['', '', '', '', '', '', '', '', '', '〒652-0832 神戸市兵庫区鍛冶屋町2-1-2', '']);
  rows.push([
    '引取日', shortDelivery + ' (' + dnDelivery + ')', '', '到着日', shortArrival + ' (' + dnArrival + ')',
    '', '発注日', orderDate, '天候', weather,
  ]);
  rows.push(['', 'キリン堂用 青果 発注・分荷表', '', '', '納品日', deliveryDate + ' (' + dnDelivery + ')', '', '', '', 'TEL 078-219-3411', '']);
  rows.push([]);

  rows.push(['【発注一覧（畑光様）】']);
  rows.push(['No', '商品名', '発注数', 'ケース']);
  items.forEach(function (it, i) {
    rows.push([i + 1, it.productName, Number(it.totalUnits) || 0, Number(it.cases) || 0]);
  });
  var totalUnits = items.reduce(function (a, it) { return a + (Number(it.totalUnits) || 0); }, 0);
  var totalCases = items.reduce(function (a, it) { return a + (Number(it.cases) || 0); }, 0);
  rows.push(['', '合計', totalUnits, totalCases]);
  rows.push([]);

  rows.push(['【店舗別振分】']);
  var matrixHeader = ['商品名', '合計'];
  storeOrder.forEach(function (s) {
    matrixHeader.push(storeShort[s] || s);
  });
  rows.push(matrixHeader);

  items.forEach(function (it) {
    var row = [it.productName, Number(it.totalUnits) || 0];
    storeOrder.forEach(function (_s, si) {
      row.push(Number((it.allocations || [])[si]) || 0);
    });
    rows.push(row);
  });

  var storeTotals = storeOrder.map(function (_s, si) {
    return items.reduce(function (a, it) {
      return a + (Number((it.allocations || [])[si]) || 0);
    }, 0);
  });
  rows.push(['合計', totalUnits].concat(storeTotals));
  rows.push([]);
  rows.push(['※ Excel: ファイル→印刷 または ダウンロード→Microsoft Excel（A4・横向き推奨）']);

  return rows;
}

function addDaysStr_(dateStr, days) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function shortDateJp_(dateStr) {
  if (!dateStr) return '';
  var p = String(dateStr).split('-');
  if (p.length < 3) return dateStr;
  return Number(p[1]) + '/' + Number(p[2]);
}

function dayNameFromDateStr_(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T00:00:00');
  return DAY_NAMES_[d.getDay()];
}

function findRowIndex_(rows, c1, c2) {
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === c1 && String(rows[i][1]) === c2) return i;
  }
  return -1;
}

/**
 * 指定日の保存済み実績取得（任意・再編集用）
 * @param {string} targetDate yyyy-MM-dd
 * @returns {Object}
 */
function getSavedResultsByDate(targetDate) {
  try {
    const sheet = getSpreadsheet_().getSheetByName(SHEET_RESULTS);
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, items: [] };
    }

    const values = sheet.getDataRange().getValues();
    const items = [];

    for (var r = 1; r < values.length; r++) {
      if (String(values[r][0]) !== String(targetDate)) continue;

      const allocations = [];
      const losses = [];
      for (var i = 0; i < STORE_COUNT; i++) {
        allocations.push(Number(values[r][5 + i]) || 0);
        losses.push(Number(values[r][11 + i]) || 0);
      }

      items.push({
        productName: String(values[r][1]),
        totalUnits: Number(values[r][2]) || 0,
        cases: Number(values[r][3]) || 0,
        remainder: Number(values[r][4]) || 0,
        allocations: allocations,
        losses: losses,
        weather: String(values[r][17] || ''),
      });
    }

    return { success: true, items: items };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

// ─── サンプルデータ投入 ─────────────────────────────────

/**
 * 販売実績を一括置換（チャンク投入用）
 * @param {Array<Array>} rows
 * @param {boolean} clearFirst
 * @returns {Object}
 */
function bulkReplaceSalesChunk(rows, clearFirst) {
  if (clearFirst) {
    writeSheet_(SHEET_SALES, SALES_HEADERS, []);
  }
  if (!rows || rows.length === 0) {
    return { success: true, added: 0 };
  }
  var sheet = getOrCreateSheet_(SHEET_SALES, SALES_HEADERS);
  var start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, rows.length, SALES_HEADERS.length).setValues(rows);
  return { success: true, added: rows.length, totalRows: sheet.getLastRow() - 1 };
}

/**
 * 発注・振分実績のデータ行をクリア
 * @returns {Object}
 */
function clearOrderResults_() {
  writeSheet_(SHEET_RESULTS, RESULT_HEADERS, []);
  return { success: true, message: '発注・振分実績をクリアしました。' };
}

/**
 * マスタシートが未作成なら自動初期化（Webアプリ初回アクセス時）
 */
function ensureMasterInitialized_() {
  const ss = getSpreadsheet_();
  if (!ss.getSheetByName(SHEET_PRODUCTS)) {
    initSampleData();
    return;
  }
  if (!ss.getSheetByName(SHEET_SALES)) {
    writeSheet_(SHEET_SALES, SALES_HEADERS, []);
  }
  if (!ss.getSheetByName(SHEET_SALES_IMPORT)) {
    writeSheet_(SHEET_SALES_IMPORT, SALES_HEADERS, []);
  }
  if (!ss.getSheetByName(SHEET_LABELS)) {
    writeSheet_(SHEET_LABELS, LABEL_HEADERS, []);
  }
}

function getStoreNamesFromSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_STORE_PRODUCTS);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  var stores = [];
  for (var r = 1; r < values.length; r++) {
    var s = String(values[r][0] || '').trim();
    if (s && stores.indexOf(s) === -1) stores.push(s);
  }
  return stores;
}

function getProductNamesFromSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_PRODUCTS);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  var products = [];
  for (var r = 1; r < values.length; r++) {
    var p = String(values[r][0] || '').trim();
    if (p) products.push([p, Number(values[r][1]) || 1]);
  }
  return products;
}

/**
 * サンプルマスタをスプレッドシートに一括投入する
 * Apps Script エディタでこの関数を選んで「実行」してください（初回のみ）
 * @returns {Object}
 */
function initSampleData() {
  const ss = getSpreadsheet_();
  var storeNames = REAL_STORES_.map(function (s) { return s.name; });

  writeSheet_(SHEET_PRODUCTS, ['商品名', '発注単位（ケース入数）'], REAL_PRODUCT_ROWS_);
  writeSheet_(SHEET_STORE_PRODUCTS, ['店舗名', '商品名', '基本陳列数'], REAL_STORE_PRODUCT_ROWS_);

  // 店舗マスタ: A店舗名 B店舗コード C略称
  writeSheet_('店舗マスタ', ['店舗名', '店舗コード', '略称'],
    REAL_STORES_.map(function (s) { return [s.name, s.code, s.short]; }));

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const weathers = ['晴れ', '曇り', '雨'];
  const dayWeatherRows = [];
  days.forEach(function (day) {
    weathers.forEach(function (weather) {
      var coef = 1.0;
      var isWeekend = (day === '日' || day === '土');
      var isFriday = (day === '金');
      if (weather === '晴れ') coef = isWeekend ? 1.3 : (isFriday ? 1.15 : 1.0);
      else if (weather === '曇り') coef = isWeekend ? 1.1 : (isFriday ? 1.0 : 0.95);
      else if (weather === '雨') coef = isWeekend ? 0.9 : (isFriday ? 0.88 : 0.85);
      dayWeatherRows.push([day, weather, coef]);
    });
  });
  writeSheet_(SHEET_DAY_WEATHER, ['曜日', '天候', '係数'], dayWeatherRows);

  writeSheet_(SHEET_RESULTS, RESULT_HEADERS, []);
  writeSheet_(SHEET_IMPORT, RESULT_HEADERS, []);
  writeSheet_(SHEET_SALES, SALES_HEADERS, []);
  writeSheet_(SHEET_SALES_IMPORT, ['検収日', '店舗名', '商品名', '受領数量'], []);
  writeSheet_(SHEET_LABELS, LABEL_HEADERS, []);
  writeSheet_(SHEET_ORDER_PRINT, ['書き出し日時'], []);

  var defaultSheet = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) { /* 無視 */ }
  }

  return {
    success: true,
    message: '実データマスタを投入しました。' + REAL_PRODUCT_ROWS_.length + '品 × ' + storeNames.length + '店',
    stores: storeNames,
    products: REAL_PRODUCT_ROWS_.length,
  };
}

/**
 * シートにデータを書き込み（既存シートはクリアして再利用）
 * @param {string} name
 * @param {string[]} headers
 * @param {Array<Array<*>>} rows
 */
function writeSheet_(name, headers, rows) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  } else {
    sheet.clear();
  }

  const colCount = headers.length;
  const allRows = [headers].concat(rows);
  sheet.getRange(1, 1, allRows.length, colCount).setValues(allRows);
  sheet.getRange(1, 1, 1, colCount).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, colCount);
}

/**
 * サンプル販売実績（直近14日）
 * @param {string[]} stores
 * @param {Array<[string,number]>} products
 * @returns {Array<Array>}
 */
function buildSampleSalesRows_(stores, products) {
  var rows = [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  for (var d = 13; d >= 0; d--) {
    var date = new Date(today);
    date.setDate(date.getDate() - d);
    var dateStr = formatDateCell_(date);
    var dayIdx = date.getDay();
    var isWeekend = (dayIdx === 0 || dayIdx === 6);

    stores.forEach(function (store, si) {
      products.forEach(function (p, pi) {
        var base = 8 + pi * 2 - si;
        var sales = Math.max(1, Math.round(base * (isWeekend ? 1.3 : 1.0) + ((d + si + pi) % 4)));
        var loss = (d + si + pi) % 5 === 0 ? 1 : 0;
        rows.push([dateStr, store, p[0], sales, loss]);
      });
    });
  }
  return rows;
}

// ─── 過去実績 Excel 取込 ─────────────────────────────────

/**
 * 「過去実績インポート」シートのデータを「発注・振分実績」へ取り込む
 *
 * 【運用フロー】
 * 1. 現場から届いた Excel (.xlsx) を開く
 * 2. スプレッドシートの「過去実績インポート」シートへ貼り付け
 *    ※ または ファイル→インポート で xlsx をこのシートに取り込み
 * 3. Apps Script で importHistoricalFromSheet() を実行
 * 4. 取込成功後、インポートシートのデータ行は自動クリア
 *
 * 列順は RESULT_HEADERS（A〜S列）と同一であること
 *
 * @param {Object} [options]
 * @param {boolean} [options.skipDuplicates=true] 同一日付+商品名が既にある行をスキップ
 * @param {boolean} [options.clearImportSheet=true] 取込後にインポートシートをクリア
 * @returns {Object}
 */
function importHistoricalFromSheet(options) {
  options = options || {};
  var skipDuplicates = options.skipDuplicates !== false;
  var clearImportSheet = options.clearImportSheet !== false;

  try {
    const ss = getSpreadsheet_();
    const importSheet = ss.getSheetByName(SHEET_IMPORT);
    if (!importSheet) {
      throw new Error('「' + SHEET_IMPORT + '」シートがありません。initSampleData() を実行するか、シートを作成してください。');
    }

    const values = importSheet.getDataRange().getValues();
    if (values.length < 2) {
      throw new Error('取込データがありません。「' + SHEET_IMPORT + '」シートにExcelデータを貼り付けてください。');
    }

    const resultSheet = getOrCreateSheet_(SHEET_RESULTS, RESULT_HEADERS);
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    // 既存データのキー（日付+商品名）を収集
    var existingKeys = {};
    if (skipDuplicates && resultSheet.getLastRow() >= 2) {
      const existing = resultSheet.getDataRange().getValues();
      for (var r = 1; r < existing.length; r++) {
        var key = makeResultKey_(existing[r][0], existing[r][1]);
        existingKeys[key] = true;
      }
    }

    var rowsToImport = [];
    var skipped = 0;
    var errors = [];

    for (var i = 1; i < values.length; i++) {
      var row = values[i];

      // 空行スキップ
      if (!row[0] && !row[1]) continue;

      // ヘッダー行の再貼り付けをスキップ
      if (String(row[0]).trim() === '日付' && String(row[1]).trim() === '商品名') continue;

      var dateStr = formatDateCell_(row[0]);
      var productName = String(row[1] || '').trim();

      if (!dateStr || !productName) {
        errors.push((i + 1) + '行目: 日付または商品名が空です');
        continue;
      }

      var key = makeResultKey_(dateStr, productName);
      if (skipDuplicates && existingKeys[key]) {
        skipped++;
        continue;
      }

      var importRow = normalizeResultRow_(row, dateStr, productName, now);
      rowsToImport.push(importRow);
      existingKeys[key] = true;
    }

    if (rowsToImport.length === 0) {
      var msg = '取り込めるデータがありませんでした。';
      if (skipped > 0) msg += '（重複スキップ: ' + skipped + '件）';
      if (errors.length) msg += ' エラー: ' + errors.join(' / ');
      throw new Error(msg);
    }

    var startRow = resultSheet.getLastRow() + 1;
    resultSheet.getRange(startRow, 1, rowsToImport.length, RESULT_HEADERS.length).setValues(rowsToImport);

    if (clearImportSheet) {
      clearImportSheetData_(importSheet);
    }

    return {
      success: true,
      message: rowsToImport.length + '件を取り込みました' +
        (skipped > 0 ? '（重複スキップ: ' + skipped + '件）' : '') +
        (errors.length > 0 ? ' ※警告: ' + errors.length + '行を除外' : ''),
      imported: rowsToImport.length,
      skipped: skipped,
      warnings: errors,
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || String(err),
    };
  }
}

/**
 * インポート行を実績シート形式に正規化
 * @param {Array} row
 * @param {string} dateStr
 * @param {string} productName
 * @param {string} defaultTimestamp
 * @returns {Array}
 */
function normalizeResultRow_(row, dateStr, productName, defaultTimestamp) {
  var result = new Array(RESULT_HEADERS.length);
  result[0] = dateStr;
  result[1] = productName;

  for (var c = 2; c < RESULT_HEADERS.length; c++) {
    if (c === RESULT_HEADERS.length - 1) {
      // 確定日時: 空なら取込日時を入れる
      result[c] = row[c] ? String(row[c]) : defaultTimestamp;
    } else if (c === RESULT_HEADERS.length - 2) {
      // 天候: 文字列
      result[c] = row[c] != null && row[c] !== '' ? String(row[c]) : '';
    } else {
      // 数値列
      result[c] = Number(row[c]) || 0;
    }
  }
  return result;
}

/**
 * 日付セルを yyyy-MM-dd に統一
 * @param {*} cell
 * @returns {string}
 */
/**
 * セル値を yyyy-MM-dd に正規化
 * @param {*} cell
 * @returns {string}
 */
function formatDateCell_(cell) {
  if (!cell && cell !== 0) return '';
  if (cell instanceof Date) {
    return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(cell).trim();
  // yyyymmdd（CSV検収日）
  if (/^\d{8}$/.test(s)) {
    return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
  }
  // yyyy/MM/dd → yyyy-MM-dd
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    var parts = s.split('/');
    return parts[0] + '-' + ('0' + parts[1]).slice(-2) + '-' + ('0' + parts[2]).slice(-2);
  }
  return s;
}

/**
 * 重複判定キー
 * @param {*} dateVal
 * @param {*} productVal
 * @returns {string}
 */
function makeResultKey_(dateVal, productVal) {
  return formatDateCell_(dateVal) + '::' + String(productVal).trim();
}

/**
 * インポートシートのデータ行のみクリア（ヘッダーは残す）
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function clearImportSheetData_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, RESULT_HEADERS.length).clearContent();
  }
}

// ─── 販売実績・ラベル ─────────────────────────────────

/**
 * 直近N日分のみ Drive CSV を取込（日常用・高速）
 * @returns {Object}
 */
function importSalesFromDriveQuick_() {
  try {
    var cutoff = addDaysStr_(formatDateCell_(new Date()), -SALES_IMPORT_QUICK_DAYS);
    return importSalesCsvFiles_(getSalesCsvFileList_(cutoff), cutoff, false);
  } catch (err) {
    return formatDriveImportError_(err);
  }
}

/**
 * 全件取込（バッチ用）
 * @param {number} startIndex
 * @param {Object} [options]
 * @returns {Object}
 */
function importSalesFromDriveBatch_(startIndex, options) {
  options = options || {};
  try {
    var batchSize = Number(options.batchSize) || SALES_IMPORT_BATCH_SIZE;
    if (options.fullReset === true && startIndex === 0) {
      writeSheet_(SHEET_SALES, SALES_HEADERS, []);
      clearImportMeta_();
    }

    var fileList = getSalesCsvFileList_(null);
    if (!fileList || fileList.length === 0) {
      throw new Error('CSV ファイルがありません。');
    }

    var start = Number(startIndex) || 0;
    var end = Math.min(start + batchSize, fileList.length);
    var result = importSalesCsvFiles_(fileList.slice(start, end), null, startIndex === 0 && options.fullReset === true);

    return {
      success: true,
      done: end >= fileList.length,
      processed: end,
      total: fileList.length,
      nextIndex: end,
      rowsThisBatch: result.rows,
      message: end + '/' + fileList.length + ' ファイル完了（+' + result.rows + '行）',
      files: result.files,
      skipped: result.skipped,
    };
  } catch (err) {
    return formatDriveImportError_(err);
  }
}

/** 互換: クイック取込 */
function importSalesFromDrive_() {
  return importSalesFromDriveQuick_();
}

/**
 * @param {Array<Object>|null} fileList
 * @param {string|null} minReceiptDate yyyy-MM-dd
 * @param {boolean} clearResults
 * @returns {Object}
 */
function importSalesCsvFiles_(fileList, minReceiptDate, clearResults) {
  if (!fileList) {
    throw new Error('Drive に「売上元データ」フォルダが見つかりません。');
  }
  if (fileList.length === 0) {
    return { success: true, message: '新規CSVなし（すべて取込済）', files: 0, skipped: 0, rows: 0 };
  }

  var meta = getImportMeta_();
  var aggregated = {};
  var imported = 0;
  var skipped = 0;

  fileList.forEach(function (f) {
    if (meta[f.id] && meta[f.id] === f.updated) {
      skipped++;
      return;
    }
    parseCsvSalesBlob_(DriveApp.getFileById(f.id).getBlob(), aggregated, minReceiptDate);
    meta[f.id] = f.updated;
    imported++;
  });

  var rows = aggregatedToRows_(aggregated);
  if (rows.length > 0) {
    appendSalesRows_(rows, true);
  }
  if (imported > 0) {
    setImportMeta_(meta);
  }
  if (clearResults) {
    writeSheet_(SHEET_RESULTS, RESULT_HEADERS, []);
  }

  return {
    success: true,
    message: imported + ' CSV・' + rows.length + '行更新' +
      (skipped > 0 ? '（変更なし ' + skipped + '件スキップ）' : ''),
    files: imported,
    skipped: skipped,
    rows: rows.length,
  };
}

/**
 * @param {string|null} minFileDate yyyy-MM-dd
 * @returns {Array<Object>|null}
 */
function getSalesCsvFileList_(minFileDate) {
  var folder = findDriveFolderByName_('売上元データ');
  if (!folder) return null;

  var list = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (!/\.csv$/i.test(name)) continue;
    var fileDate = csvFileDateFromName_(name);
    if (minFileDate && fileDate && fileDate < minFileDate) continue;
    list.push({
      id: file.getId(),
      name: name,
      updated: file.getLastUpdated().getTime(),
      fileDate: fileDate,
    });
  }
  list.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return list;
}

function csvFileDateFromName_(name) {
  var m = String(name).match(/CSV_(\d{6})_/i);
  if (!m) return null;
  var s = m[1];
  return '20' + s.slice(0, 2) + '-' + s.slice(2, 4) + '-' + s.slice(4, 6);
}

function aggregatedToRows_(aggregated) {
  return Object.keys(aggregated).map(function (key) {
    var parts = key.split('::');
    return [parts[0], parts[1], parts[2], aggregated[key], 0];
  });
}

function getImportMeta_() {
  var raw = PropertiesService.getScriptProperties().getProperty(SALES_IMPORT_META_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

function setImportMeta_(meta) {
  PropertiesService.getScriptProperties().setProperty(SALES_IMPORT_META_KEY, JSON.stringify(meta));
}

function clearImportMeta_() {
  PropertiesService.getScriptProperties().deleteProperty(SALES_IMPORT_META_KEY);
}

function formatDriveImportError_(err) {
  var msg = err.message || String(err);
  if (/権限|permission|authorization/i.test(msg)) {
    msg = 'Drive 権限が未承認です。「ラベル」タブ →「直近2週間取込」で承認してください。';
  }
  return { success: false, message: msg };
}

/**
 * @param {string} name
 * @returns {GoogleAppsScript.Drive.Folder|null}
 */
function findDriveFolderByName_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : null;
}

/**
 * @param {GoogleAppsScript.Base.Blob} blob
 * @param {Object<string,number>} aggregated
 * @param {string|null} [minReceiptDate] yyyy-MM-dd
 */
function parseCsvSalesBlob_(blob, aggregated, minReceiptDate) {
  var text = blob.getDataAsString('Shift_JIS');
  if (!text || text.indexOf('検収日') < 0) {
    text = blob.getDataAsString('UTF-8');
  }
  var lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return;

  var headers = lines[0].split(',').map(function (h) { return String(h).trim(); });
  var iDate = headers.indexOf('検収日');
  var iStore = headers.indexOf('店舗名');
  var iProduct = headers.indexOf('商品名');
  var iQty = headers.indexOf('受領数量');
  if (iDate < 0 || iStore < 0 || iProduct < 0 || iQty < 0) return;

  for (var li = 1; li < lines.length; li++) {
    var line = lines[li];
    if (!line.trim()) continue;
    var cols = line.split(',');
    var dateStr = formatDateCell_(cols[iDate]);
    if (minReceiptDate && dateStr && dateStr < minReceiptDate) continue;
    var store = String(cols[iStore] || '').trim();
    var product = String(cols[iProduct] || '').trim();
    var qty = Math.round(Number(cols[iQty]) || 0);
    if (!dateStr || !store || !product || qty <= 0) continue;
    var key = dateStr + '::' + store + '::' + product;
    aggregated[key] = (aggregated[key] || 0) + qty;
  }
}

/**
 * 直近N日の店舗別販売比率（商品→店舗→0〜1）
 * @param {number} days
 * @returns {Object}
 */
function buildSalesRatio_(days) {
  var sheet = getSpreadsheet_().getSheetByName(SHEET_SALES);
  var ratio = {};
  if (!sheet || sheet.getLastRow() < 2) return ratio;

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days || 7));
  cutoff.setHours(0, 0, 0, 0);
  var cutoffStr = formatDateCell_(cutoff);

  var values = sheet.getDataRange().getValues();
  var totals = {};

  for (var r = 1; r < values.length; r++) {
    var d = formatDateCell_(values[r][0]);
    if (d < cutoffStr) continue;
    var store = String(values[r][1] || '').trim();
    var product = String(values[r][2] || '').trim();
    var qty = Number(values[r][3]) || 0;
    if (!store || !product) continue;
    if (!totals[product]) totals[product] = {};
    totals[product][store] = (totals[product][store] || 0) + qty;
  }

  Object.keys(totals).forEach(function (product) {
    var sum = 0;
    Object.keys(totals[product]).forEach(function (s) { sum += totals[product][s]; });
    if (sum <= 0) return;
    ratio[product] = {};
    Object.keys(totals[product]).forEach(function (s) {
      ratio[product][s] = totals[product][s] / sum;
    });
  });

  return ratio;
}

/**
 * 販売実績シートから曜日別の平均販売数を算出
 * @returns {Object} store → product → dayName → avg
 */
function buildSalesReference_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_SALES);
  const ref = {};
  if (!sheet || sheet.getLastRow() < 2) return ref;

  const values = sheet.getDataRange().getValues();
  const buckets = {};

  for (var r = 1; r < values.length; r++) {
    var dateStr = formatDateCell_(values[r][0]);
    var store = String(values[r][1] || '').trim();
    var product = String(values[r][2] || '').trim();
    var qty = Number(values[r][3]) || 0;
    if (!dateStr || !store || !product) continue;

    var dayName = getDayNameFromDateStr_(dateStr);
    var key = store + '::' + product + '::' + dayName;
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
    buckets[key].sum += qty;
    buckets[key].count++;
  }

  Object.keys(buckets).forEach(function (key) {
    var parts = key.split('::');
    var store = parts[0];
    var product = parts[1];
    var dayName = parts[2];
    if (!ref[store]) ref[store] = {};
    if (!ref[store][product]) ref[store][product] = {};
    ref[store][product][dayName] = Math.round(buckets[key].sum / buckets[key].count);
  });

  return ref;
}

/**
 * @param {string} dateStr yyyy-MM-dd
 * @returns {string}
 */
function getDayNameFromDateStr_(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  return DAY_NAMES_[d.getDay()];
}

/**
 * 月曜始まりの週開始日
 * @param {Date} date
 * @returns {Date}
 */
function getWeekStart_(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  var day = d.getDay();
  var diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * 「過去販売インポート」→「販売実績」へ取込
 * @param {Object} [options]
 * @returns {Object}
 */
function importSalesFromSheet(options) {
  options = options || {};
  var skipDuplicates = options.skipDuplicates !== false;
  var clearImportSheet = options.clearImportSheet !== false;

  try {
    const ss = getSpreadsheet_();
    const importSheet = ss.getSheetByName(SHEET_SALES_IMPORT);
    if (!importSheet) {
      throw new Error('「' + SHEET_SALES_IMPORT + '」シートがありません。');
    }

    const values = importSheet.getDataRange().getValues();
    if (values.length < 2) {
      throw new Error('取込データがありません。「' + SHEET_SALES_IMPORT + '」にCSVを貼り付けてください。');
    }

    var existingKeys = {};
    const salesSheet = getOrCreateSheet_(SHEET_SALES, SALES_HEADERS);
    if (skipDuplicates && salesSheet.getLastRow() >= 2) {
      const existing = salesSheet.getDataRange().getValues();
      for (var r = 1; r < existing.length; r++) {
        existingKeys[makeSalesKey_(existing[r][0], existing[r][1], existing[r][2])] = true;
      }
    }

    var rowsToImport = [];
    var skipped = 0;
    var errors = [];

    var headers = values[0].map(function (h) { return String(h).trim(); });
    var isCsvFormat = headers.indexOf('検収日') >= 0;
    var colDate = isCsvFormat ? headers.indexOf('検収日') : 0;
    var colStore = headers.indexOf('店舗名') >= 0 ? headers.indexOf('店舗名') : 1;
    var colProduct = headers.indexOf('商品名') >= 0 ? headers.indexOf('商品名') : 2;
    var colSales = isCsvFormat ? headers.indexOf('受領数量') : 3;
    var colLoss = headers.indexOf('ロス数') >= 0 ? headers.indexOf('ロス数') : 4;

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row[colDate] && !row[colStore] && !row[colProduct]) continue;
      if (String(row[colDate]).trim() === '日付' || String(row[colDate]).trim() === '検収日') continue;

      var dateStr = formatDateCell_(row[colDate]);
      var store = String(row[colStore] || '').trim();
      var product = String(row[colProduct] || '').trim();
      var sales = Number(row[colSales]) || 0;
      var loss = colLoss >= 0 ? (Number(row[colLoss]) || 0) : 0;

      if (!dateStr || !store || !product) {
        errors.push((i + 1) + '行目: 日付・店舗・商品が必要です');
        continue;
      }

      var key = makeSalesKey_(dateStr, store, product);
      if (skipDuplicates && existingKeys[key]) {
        skipped++;
        continue;
      }

      rowsToImport.push([dateStr, store, product, sales, loss]);
      existingKeys[key] = true;
    }

    if (rowsToImport.length === 0) {
      throw new Error('取り込めるデータがありません。' +
        (skipped > 0 ? '（重複: ' + skipped + '件）' : ''));
    }

    appendSalesRows_(rowsToImport, false);

    if (clearImportSheet) {
      var lastRow = importSheet.getLastRow();
      if (lastRow > 1) {
        importSheet.getRange(2, 1, lastRow - 1, SALES_HEADERS.length).clearContent();
      }
    }

    return {
      success: true,
      message: rowsToImport.length + '件の販売実績を取り込みました' +
        (skipped > 0 ? '（重複スキップ: ' + skipped + '件）' : ''),
      imported: rowsToImport.length,
      skipped: skipped,
      warnings: errors,
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

/**
 * @param {Array<Array>} rows
 * @param {boolean} upsert 同一日付+店舗+商品があれば上書き
 */
function appendSalesRows_(rows, upsert) {
  const sheet = getOrCreateSheet_(SHEET_SALES, SALES_HEADERS);
  if (!rows || rows.length === 0) return;

  if (!upsert) {
    var start = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, rows.length, SALES_HEADERS.length).setValues(rows);
    return;
  }

  var values = sheet.getLastRow() >= 1 ? sheet.getDataRange().getValues() : [SALES_HEADERS.slice()];
  if (values.length === 0 || String(values[0][0]) !== SALES_HEADERS[0]) {
    values = [SALES_HEADERS.slice()];
  }

  var indexMap = {};
  for (var r = 1; r < values.length; r++) {
    indexMap[makeSalesKey_(values[r][0], values[r][1], values[r][2])] = r;
  }

  rows.forEach(function (row) {
    var key = makeSalesKey_(row[0], row[1], row[2]);
    if (indexMap[key] != null) {
      values[indexMap[key]] = row;
    } else {
      values.push(row);
      indexMap[key] = values.length - 1;
    }
  });

  if (values.length > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), values.length - sheet.getMaxRows());
  }
  sheet.getRange(1, 1, values.length, SALES_HEADERS.length).setValues(values);
}

function makeSalesKey_(dateVal, storeVal, productVal) {
  return formatDateCell_(dateVal) + '::' + String(storeVal).trim() + '::' + String(productVal).trim();
}

/**
 * 週次ラベル発行（過去1週間の販売合計＝ラベル枚数）
 * @param {string} [weekStartStr] yyyy-MM-dd（月曜）。省略時は今週
 * @returns {Object}
 */
function generateWeeklyLabels(weekStartStr) {
  try {
    var weekStart = weekStartStr
      ? new Date(weekStartStr + 'T00:00:00')
      : getWeekStart_(new Date());
    var weekStartFormatted = formatDateCell_(weekStart);

    var periodTo = new Date(weekStart);
    periodTo.setDate(periodTo.getDate() - 1);
    var periodFrom = new Date(periodTo);
    periodFrom.setDate(periodFrom.getDate() - 6);

    var fromStr = formatDateCell_(periodFrom);
    var toStr = formatDateCell_(periodTo);

    const sheet = getSpreadsheet_().getSheetByName(SHEET_SALES);
    if (!sheet || sheet.getLastRow() < 2) {
      throw new Error('販売実績がありません。先にCSVを取り込んでください。');
    }

    var totals = {};
    var values = sheet.getDataRange().getValues();
    for (var r = 1; r < values.length; r++) {
      var d = formatDateCell_(values[r][0]);
      if (d < fromStr || d > toStr) continue;
      var store = String(values[r][1] || '').trim();
      var product = String(values[r][2] || '').trim();
      var qty = Number(values[r][3]) || 0;
      if (!store || !product) continue;
      var k = store + '::' + product;
      totals[k] = (totals[k] || 0) + qty;
    }

    var keys = Object.keys(totals);
    if (keys.length === 0) {
      throw new Error(fromStr + '〜' + toStr + ' の販売データがありません。');
    }

    var labelSheet = getOrCreateSheet_(SHEET_LABELS, LABEL_HEADERS);
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    // 同一週の既存ラベル行を削除して再発行
    if (labelSheet.getLastRow() >= 2) {
      var existing = labelSheet.getDataRange().getValues();
      for (var i = existing.length - 1; i >= 1; i--) {
        if (formatDateCell_(existing[i][0]) === weekStartFormatted) {
          labelSheet.deleteRow(i + 1);
        }
      }
    }

    var labelRows = keys.map(function (k) {
      var p = k.split('::');
      return [weekStartFormatted, p[0], p[1], totals[k], fromStr, toStr, now];
    });

    var startRow = labelSheet.getLastRow() + 1;
    labelSheet.getRange(startRow, 1, labelRows.length, LABEL_HEADERS.length).setValues(labelRows);

    return {
      success: true,
      message: labelRows.length + '件のラベルを発行しました（' + fromStr + '〜' + toStr + ' の実績）',
      weekStart: weekStartFormatted,
      periodFrom: fromStr,
      periodTo: toStr,
      labels: getWeeklyLabels_(weekStartFormatted),
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

/**
 * @param {string} weekStartStr
 * @returns {Array<Object>}
 */
function getWeeklyLabels_(weekStartStr) {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_LABELS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var values = sheet.getDataRange().getValues();
  var labels = [];
  for (var r = 1; r < values.length; r++) {
    if (formatDateCell_(values[r][0]) !== weekStartStr) continue;
    labels.push({
      storeName: String(values[r][1]),
      productName: String(values[r][2]),
      count: Number(values[r][3]) || 0,
      periodFrom: formatDateCell_(values[r][4]),
      periodTo: formatDateCell_(values[r][5]),
    });
  }
  return labels;
}
