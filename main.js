const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("CHANNEL_ACCESS_TOKEN");
const USER_IDS = JSON.parse(PropertiesService.getScriptProperties().getProperty("USER_IDS"));
const WEEKDAYS_IDS = JSON.parse(PropertiesService.getScriptProperties().getProperty("WEEKDAYS_IDS"));
const SHEET_ID = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
const sheet = SpreadsheetApp.openById(SHEET_ID);
var ss = sheet.getActiveSheet();
const lastRow = ss.getLastRow();
const today = new Date();
const day = today.getDay();
const isWeekendOrHoliday = day === 0 || day === 6 || isHoliday(today);
const pushUrl = "https://api.line.me/v2/bot/message/push";
const replyUrl = "https://api.line.me/v2/bot/message/reply";
const headers = {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN,
};
const dinnerTemplate = {
  "type": "template",
  "altText": "夜ご飯の予定をおしえてください！",
  "template": {
    "type": "buttons",
    "text": "夜ご飯の予定をおしえてください！",
    "actions": [
      {
        "type": "postback",
        "label": "たべます",
        "data": "action=select_dinner&answer=たべます"
      },
      {
        "type": "postback",
        "label": "たべますがバイトです",
        "data": "action=select_dinner&answer=たべますがバイトです"
      },
      {
        "type": "postback",
        "label": "たべません",
        "data": "action=select_dinner&answer=たべません"
      }
    ]
  }
};
const lunchTemplate = {
  "type": "template",
  "altText": "お昼ご飯の予定もおしえてください！",
  "template": {
    "type": "buttons",
    "text": "お昼ご飯の予定もおしえてください！",
    "actions": [
      {
        "type": "postback",
        "label": "たべます",
        "data": "action=select_lunch&answer=たべます"
      },
      {
        "type": "postback",
        "label": "たべません",
        "data": "action=select_lunch&answer=たべません"
      }
    ]
  }
};
 
function doPost(e) {
  const json = JSON.parse(e.postData.contents);
  const events = json.events;

  events.forEach((event) => {
    if (event.type === "postback") {
      const data = event.postback.data;
      const userId = event.source.userId;
      const replyMessage = {"type": "text", "text": "回答ありがとうございます！"};
      const keyValuePairs = data.split("&").map(pair => pair.split("="));
      const params = keyValuePairs.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

      if (params['action'] == "register_schedule") {
        sendTemplate(event.replyToken, dinnerTemplate);
      }
      if (params['action'] == "select_dinner") {
        saveToSpreadsheet(userId, "dinner", params["answer"]);

        const message = isWeekendOrHoliday ? lunchTemplate : replyMessage;
        sendTemplate(event.replyToken, message);
      }
      if (params['action'] == "select_lunch") {
        saveToSpreadsheet(userId, "lunch", params["answer"]);
        sendTemplate(event.replyToken, replyMessage);
      }
    }
  });
}

/**
 * テンプレートメッセージを送る
 */
function sendTemplate(replyToken, template) {
  UrlFetchApp.fetch(replyUrl, {
    "headers": headers,
    "method": "post",
    "payload": JSON.stringify({
      "replyToken": replyToken,
      "messages": [template]
    })
  });
}

/**
 * スプレッドシートにデータを登録する
 */
function saveToSpreadsheet(userId, mealType, answer) {
  let newRow = lastRow + 1;
  let existingRow = -1;

  // すでに同じ日付とユーザーIDの行が存在するかどうかを確認する
  for (let i = 1; i <= lastRow; i++) {
    if (ss.getRange(i, 2).getValue() === userId) {
      existingRow = i;
      break;
    }
  }

  // 既存の行が見つかった場合はその行にデータを追加し、そうでなければ新しい行にデータを追加する
  if (existingRow !== -1) {
    newRow = existingRow;
  } else {
    ss.getRange(newRow, 1).setValue(today);
    ss.getRange(newRow, 2).setValue(userId);
  }

  if (mealType === "dinner") {
    ss.getRange(newRow, 3).setValue(answer);
  } else if (mealType === "lunch") {
    ss.getRange(newRow, 4).setValue(answer);
  }
}

/**
 * 登録を促すメッセージを送る
 */
function sendDailyQuestions() {
  const registrationMessage = {
  "type": "template",
  "altText": "今日のスケジュールを登録してください",
  "template": {
    "type": "buttons",
    "text": "今日のスケジュールを登録してください",
    "actions": [
      {
        "type": "postback",
        "label": "登録する",
        "data": "action=register_schedule"
      }
    ]
  }};

  const TARGET_USERS = isWeekendOrHoliday ? WEEKDAYS_IDS : USER_IDS;
  sendMessage(TARGET_USERS, registrationMessage)
}

/**
 * 集計結果を送る
 */
function sendSummary() {
  let summaryMessage = "今日のご飯の予定です\n\n";
  let data = [];
  const userData = {};
  const USER_NAMES = Object.fromEntries(Object.entries(USER_IDS).map(([key, value]) => [value, key]));

  data = ss.getRange(1, 1, lastRow, 4).getValues();
  data.forEach(row => {
    const userId = row[1];
    const dinnerAnswer = row[2];
    const lunchAnswer = row[3];
    let userName = USER_NAMES[userId];

    if (!userData[userId]) {
      userData[userId] = {};
    }
    let message = `${userName} → 夜ご飯：${dinnerAnswer}`;
    if (isWeekendOrHoliday) {
      message += ` / お昼ご飯：${lunchAnswer}`;
    }
    summaryMessage += `${message}\n`;
  });

  summaryMessage += "\n修正がある場合は直接ご連絡ください！";
  const completeMessage = {type: "text",text: summaryMessage};

  sendMessage(USER_IDS, completeMessage);
}

/**
 * 全員へメッセージを送る
 */
function sendMessage(TARGET_USERS, message) {
  for (const userId in TARGET_USERS) {
    UrlFetchApp.fetch(pushUrl, {
      "headers": headers,
      "method": "post",
      "payload": JSON.stringify({
        "to": TARGET_USERS[userId],
        "messages": [message],
      })
    });
  }
}

/**
 * 休日を管理する
 */
function isHoliday(date) {
  const holidays = [
    { month: 4, day: 1 }, // 5月1日
    { month: 4, day: 3 }, // 5月3日
    { month: 4, day: 4 },
    { month: 4, day: 5 },
    { month: 6, day: 17 },
    { month: 7, day: 11 },
  ];

  return holidays.some(holiday => date.getMonth() === holiday.month && date.getDate() === holiday.day);
}

/**
 * スプレッドシートのデータを削除する
 */
function deleteData() {
  sheet.deleteRows(1, lastRow - 1);
}