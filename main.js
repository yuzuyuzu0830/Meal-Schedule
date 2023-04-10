const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("CHANNEL_ACCESS_TOKEN");
const USER_IDS = JSON.parse(PropertiesService.getScriptProperties().getProperty("USER_IDS"));
const WEEKDAYS_IDS = JSON.parse(PropertiesService.getScriptProperties().getProperty("WEEKDAYS_IDS"));
const sheet = SpreadsheetApp.openById('SHEET_ID');
var ss = sheet.getActiveSheet();
const lastRow = ss.getLastRow();
const today = new Date();
const day = today.getDay();
const isWeekendOrHoliday = day === 0 || day === 6 || isHoliday(today);

function doPost(e) {
  const json = JSON.parse(e.postData.contents);
  const events = json.events;

  events.forEach((event) => {
    if (event.type === "postback") {
      const data = event.postback.data;
      const userId = event.source.userId;
      const keyValuePairs = data.split("&").map(pair => pair.split("="));
      const params = keyValuePairs.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

      if (params['action'] == "register_schedule") {
        sendDinnerTemplate(event.replyToken);
      }
      if (params['action'] == "select_dinner") {
        // Google スプレッドシートにデータを保存
        saveToSpreadsheet(userId, "dinner", params["answer"]);
        if (isWeekendOrHoliday == true) {
          sendLunchTemplate(event.replyToken);
        } else {
          reply(event.replyToken, "回答ありがとうございます！");
        }
      }
      if (params['action'] == "select_lunch") {
        // Google スプレッドシートにデータを保存
        saveToSpreadsheet(userId, "lunch", params["answer"]);
        reply(event.replyToken, "回答ありがとうございます！");
      }
    }
  });
}


function saveToSpreadsheet(userId, mealType, answer) {
  let newRow = lastRow + 1;
  let existingRow = -1;

  // すでに同じ日付とユーザーIDの行が存在するかどうかを確認
  for (let i = 1; i <= lastRow; i++) {
    const dateCellValue = ss.getRange(i, 1).getValue();
    const userIdCellValue = ss.getRange(i, 2).getValue();
    
    if (dateCellValue.toISOString().slice(0, 10) === today.toISOString().slice(0, 10) && userIdCellValue === userId) {
      existingRow = i;
      break;
    }
  }

  // 既存の行が見つかった場合は、その行にデータを追加。そうでなければ新しい行にデータを追加
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

function sendDailyQuestions() {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN,
  };
  const url = "https://api.line.me/v2/bot/message/push";
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

  let TARGET_USERS = USER_IDS;
  if (isWeekendOrHoliday) {
    TARGET_USERS = WEEKDAYS_IDS;
  }

  for (const userId in USER_IDS) {
    UrlFetchApp.fetch(url, {
      "headers": headers,
      "method": "post",
      "payload": JSON.stringify({
        "to": TARGET_USERS[userId],
        "messages": [registrationMessage]
      })
    });
  }
}

function sendDinnerTemplate(replyToken) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN,
  };
  const url = "https://api.line.me/v2/bot/message/reply";
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

  UrlFetchApp.fetch(url, {
    "headers": headers,
    "method": "post",
    "payload": JSON.stringify({
      "replyToken": replyToken,
      "messages": [dinnerTemplate]
    })
  });
}

function sendLunchTemplate(replyToken) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN,
  };
  const url = "https://api.line.me/v2/bot/message/reply";
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

  UrlFetchApp.fetch(url, {
    "headers": headers,
    "method": "post",
    "payload": JSON.stringify({
      "replyToken": replyToken,
      "messages": [lunchTemplate]
    })
  });
}

function reply(replyToken, message) {
  const url = "https://api.line.me/v2/bot/message/reply";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN
  };
  const payload = {
    "replyToken": replyToken,
    "messages": [{"type": "text", "text": message}]
  };
  const options = {
    "method": "post",
    "headers": headers,
    "payload": JSON.stringify(payload)
  };

  UrlFetchApp.fetch(url, options);
}

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
      message += ` / お昼ご飯：${lunchAnswer}`; // 週末または休日の場合、昼ご飯の回答を追加
    }
    summaryMessage += `${message}\n`;
  });

  summaryMessage += "\nよろしくお願いします！";
  sendMessage(summaryMessage);
}

function sendMessage(message) {
  const url = "https://api.line.me/v2/bot/message/push";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN,
  };
  for (const userId in USER_IDS) {
    UrlFetchApp.fetch(url, {
      "headers": headers,
      "method": "post",
      "payload": JSON.stringify({
        "to": USER_IDS[userId],
        "messages": [
        {
          type: "text",
          text: message,
        },
      ],
      })
    });
  }
}

function isHoliday(date) {
  const year = date.getFullYear();

  const holidays = [
    { month: 4, day: 1 }, // 5月1日
    { month: 4, day: 3 }, // 5月3日
    { month: 4, day: 4 }, // 5月4日
    { month: 3, day: 10 }, // 5月4日
  ];

  return holidays.some(holiday => date.getMonth() === holiday.month && date.getDate() === holiday.day);
}