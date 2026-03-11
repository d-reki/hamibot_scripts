/*** 
    脚本名称：dongchedi_script.js
    功能描述：用于dongchedi抢国补
    作    者：reki
    创建日期：2025-11-03
    备注：
***/
auto.waitFor();
// 1. 必须要条件，通知短信
events.observeNotification();
// 搜狗输入法一键粘贴位置
const name_x = 107; // 购车人粘贴_x
const name_y = 1849; // 购车人粘贴_y
const phone_x = 107; // 手机号粘贴_x
const phone_y  = 1977; // 手机号粘贴_y
const yzm_x = 97; // 验证码粘贴_x
const yzm_y = 1713;  // 验证码粘贴_y
const input_show_time = 400 // 输出框动画出现时间（毫秒）
const monitoring_time = 500 // 信息填充页面监测时间（刷新时间,毫秒）
const click_stop_time = 50 // 点击停止时间，防止系统点击后还未反应过来（毫秒）
// 全局变量控制监测状态
var is_monitoring = false;
var detection_thread = null;
// 创建悬浮窗UI
var floatyWin = floaty.window(
    <vertical padding="16">
  			<button id="handBtn" text="手动填充" bg="#4CAF50" />
        <button id="startBtn" text="自动监测" bg="#6be585" />
        <button id="exitBtn" text="退出脚本" bg="#659999" />
    </vertical>
);
// 退出按钮事件
floatyWin.exitBtn.click(function () {
    // 停止监测线程
    stopMonitoring();
    // 退出时停止所有线程
    threads.shutDownAll();
    floatyWin.close();
    hamibot.exit();
});

// 按钮点击事件监听手动
floatyWin.handBtn.click(function () {
  // 新线程中执行任务，避免阻塞UI线程
  threads.start(function() {
    ui.run(function() {
      floatyWin.handBtn.attr("bg", "#FF9800");
    });
    // 执行具体的自动化任务
    fillTheInfo();
    // 任务执行完毕后，恢复按钮状态
    ui.run(function() {
      floatyWin.handBtn.attr("bg", "#4CAF50");
    });
  });
});

// 开始自动监测按钮事件
floatyWin.startBtn.click(function () {
    if (is_monitoring) {
        // 如果正在监测，点击则停止
        stopMonitoring();
        floatyWin.startBtn.attr("bg", "#6be585");
    } else {
        // 如果未监测，点击则启动
        startMonitoring();
        floatyWin.startBtn.attr("bg", "#FF4B2B");
    }
});

// 保持悬浮窗不被关闭
setInterval(function() {}, 1000);

// 启动监测函数
function startMonitoring() {
  if (is_monitoring) return; // 防止重复启动
  is_monitoring = true;
  console.log("开始监测验证码节点");
  // 启动检测线程
  detection_thread = threads.start(function() {
    while (is_monitoring) {
        // 已知悉按钮点击
        let know_button = depth(8).textContains("已知悉").findOne(500);
        if (know_button){
          let konw_bounds = know_button.bounds();
          console.log("找到已知悉节点")
          click(konw_bounds.centerX(), konw_bounds.centerY());
        } else {
          console.log("未找到已知悉节点")
        };
        // 检测验证码节点
        let click_yzm = desc("获取验证码").clickable(true).findOne(500);
        if (click_yzm) {
          console.log("信息填充窗口已出现,开始填充信息");
          // 执行任务
          fillTheInfo();
          console.log("信息填充任务执行完成");
          // 任务完成后停止监测
          stopMonitoring();
          break;
        }
        sleep(monitoring_time);
    }
  });
}

// 停止监测函数
function stopMonitoring() {
    ui.run(function() {
        floatyWin.startBtn.attr("bg", "#6be585");
        });
    is_monitoring = false;
    if (detection_thread && detection_thread.isAlive()) {
        detection_thread.interrupt(); // 中断检测线程
    }
    console.log("监测已停止");
};

function fillTheInfo() {
    // 0. 提前注册事件监听器
    let notification_received = false; // 标志位，表示是否收到通知

    // 定义通知监听回调函数
    const notificationCallback = function(notification) {
        let packageName = notification.getPackageName();
        // 注意：小米手机系统短信的包名可能不是 "com.android.mms"，请根据实际情况调整
        // 常见的包名还有 "com.android.messaging", "com.google.android.apps.messaging" 或小米自家的包名
        if (packageName == "com.android.mms" || packageName == "com.miui.sms") { 
            let notifyText = notification.getText();
            let notifyTicker = notification.tickerText;
            console.log("收到短信通知, 包名:", packageName);
            console.log("通知内容:", notifyText || notifyTicker);
            let code = extractVerificationCode(notifyText || notifyTicker);
            if (code) {
                console.log("提取到验证码: ", code);
                notification_received = true; // 设置标志位
                setClip(code); // 复制到剪贴板
                // 收到验证码后自动填充
                sleep(input_show_time);
                click(yzm_x, yzm_y); // 执行粘贴操作（假设yzm_x, yzm_y是粘贴按钮坐标）
            }
        };
    };

    events.onNotification(notificationCallback);
    console.log("短信通知监听器已注册");
	
    // 1. 填充购车人信息（你原有的代码）
    let name_input = desc("购车人").indexInParent(24).findOne(1000);
    if (name_input) {
        console.log("开始填充购车人");
        let name_bounds = name_input.bounds();
        click(name_bounds.centerX() + 300, name_bounds.centerY());
        sleep(input_show_time);
        click(name_x, name_y);
    } else {
        console.log("未找到购车人输入框");
    }

    // 2. 填充手机号（你原有的代码）
    let phone_input = desc("手机号").indexInParent(32).findOne(1000);
    if (phone_input) {
        console.log("开始填充手机号");
        let phone_bounds = phone_input.bounds();
        sleep(click_stop_time);
        click(phone_bounds.centerX() + 300, phone_bounds.centerY());
        sleep(click_stop_time);
        click(phone_x, phone_y);
    } else {
        console.log("未找到手机号输入框");
    };

    // 3. 点击获取验证码按钮
    let click_yzm = desc("获取验证码").clickable(true).findOne(1000);
    if (click_yzm) {
        let clickyzm_bounds = click_yzm.bounds();
        sleep(click_stop_time);
        click(clickyzm_bounds.centerX(), clickyzm_bounds.centerY());
        console.log("已点击发送验证码，等待短信");
        sleep(input_show_time);
    } else {
        console.log("未找到获取验证码按钮");
    };

    // 4.点击到验证码输入框
    let yzm_input = desc("验证码").indexInParent(40).findOne(2000);
    if (yzm_input) {
        console.log("开始填充验证码");
        let yzm_bounds = yzm_input.bounds();
        sleep(1000);
        click(yzm_bounds.centerX() + 300, yzm_bounds.centerY()); // 点击输入框
      	click(yzm_bounds.centerX() + 300, yzm_bounds.centerY()); // 需要多次点击输入框
    } else {
        console.log("未找到验证码输入框，验证码已复制到剪贴板，请手动粘贴。");
    };

    // 5. 等待验证码到来
    let maxWaitTime = 120 * 1000; // 最大等待时间60秒
    let startTime = Date.now();
    while (!notification_received && (Date.now() - startTime) < maxWaitTime) {
        // 每隔500毫秒检查一次
        sleep(500);
    };
    // 6. 最后，记得取消事件监听，防止内存泄漏和重复处理
    events.removeAllListeners("notification");
    console.log("已取消通知监听");
};

// 使用正则表达式提取验证码的函数
function extractVerificationCode(text) {
    if (!text) return null;
    //  验证码提取
    let pattern = /(\d{4,6})/;
    let match = text.match(pattern);
    return match ? match[0] : null;
};