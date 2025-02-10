// 无障碍启动
startAuto();
// 引入必要的模块和设置
let view_video_total = 0; // 统计观看视频数量
let us_execution_count = 0; // 解锁屏幕执行次数
let main_execution_count = 0; // 主程序执行次数
const max_execution_count = 5; // 主程序最大执行次数
const default_width = 1080;  // 默认屏幕宽度
const default_height = 1920;  // 默认屏幕高度
const { unlock_pwd } = hamibot.env; // 屏幕密码
const { select_tasks } = hamibot.env; // 执行任务
const screen_width = getDeviceWidth()  // 屏幕宽度
const screen_height = getDeviceHeight();  // 屏幕高度
console.log("=====================");
console.log(`获取屏幕宽度:${screen_width},高度:${screen_height}`)
console.show();
console.setSize(screen_width /2, screen_height / 3);
console.setPosition(0, 0);
// 主程序
main();
// 主程序入口	
function main(){
    // 首次点亮并解锁手机
    let us_flag = unlockScreen();
    while (!us_flag){
        us_execution_count ++;
        console.log(`解锁屏幕失败,等待尝试第${us_execution_count}重新解锁`);
        sleep(3000);
        us_flag = unlockScreen();
        if (us_execution_count > max_execution_count){
            console.log(`解锁屏幕失败次数过多,退出任务`);
            break;
        };
    };
    // 解锁屏幕状态再执行任务
    if (us_flag){
        let start_status = startApp("起点读书");
        if (start_status) {
            closeStartupWindow();
            executeWelfareTask();
        };
    }
};
// 重新运行主程序
function retryMain() {
    main_execution_count++;
    if (main_execution_count <= max_execution_count) {
        setTimeout(main, 5000);
    } else {
        console.log("已达到最大尝试次数, 停止任务");
    };
};
// 启动无障碍
function startAuto(){
    if (!isActuallyLocked()){
        // console.log("启动等待无障碍");
        auto.waitFor();
    } else {
        // console.log("启动定时无障碍");
        auto();
    };
}
// 尝试启动应用
function startApp(app_name) {
    try {
        console.log("=====================");
        console.log(`启动程序: ${app_name}.`);
        let success_app = launchApp(app_name);
        if (success_app) {
            console.log(`程序: ${app_name}, 启动状态: 成功`);
            console.log("=====================");
            return true;
        } else {
            console.log(`程序: ${app_name}, 启动状态: 失败`);
            console.log("=====================");
        }
        return false;
    } catch (e) {
        console.error("启动应用出错:", e);
        return false;
    }
};
// 关闭启动任务前的弹窗(不一定有用)
function closeStartupWindow(){
    // 跳过开屏广告
    clickElementLoop(textContains("跳过").findOne(1000));
    // clickElementLoop(id("button_text_id").findOne(500));
    // 弹窗1
    if (textContains("青少年模式").findOne(500)){
        clickElementLoop(text("我知道了").findOne(500));
    };
    // 弹窗2
    clickElementLoop(id("imgClose").findOne(500));
    // 通知弹窗
    clickElementLoop(id("systemNotificationBottomDialogClose").findOne(500));
};
// 执行起点福利任务
function executeWelfareTask() {
    console.log("=====================");
    console.log("开始进入福利中心");
    if (text("领福利").findOne(1000)){
        clickElementCenter(text("领福利").findOne(1000));
    } else {
        clickElementLoop(text("我").findOne(1000));
    };
    let flzx = text("福利中心").findOne(1000);
    // 判断是否在福利中心页面
    if (flzx || text("激励视频任务").findOne(1000)) {
        if (flzx){clickElementCenter(flzx);}
        // clickElementLoop(textContains("跳过").findOne(1000));
        if (text("激励视频任务").findOne(1000)) {
            // 保持屏幕常亮 10 分钟,防止做任务重息屏
            device.keepScreenOn(60 * 1000 * 10);
            let start_time = new Date();
            watchVideos();
            console.log("福利任务已完成");
            let end_time = new Date();
            console.log(`视频任务共耗时: ${((end_time - start_time) / 1000).toFixed(2)}s`);
            console.log("=====================");
            // 关闭屏幕常亮
            device.cancelKeepingAwake();
        } else {
            console.log(`未找到视频任务, 第${main_execution_count}尝试重启任务或自行前往视频任务页面`);
            retryMain();
        };
    } else {
        console.log(`未找到福利中心, 第${main_execution_count}尝试重启任务或自行前往视频任务页面`);
        retryMain();
    };
    sleep(3000);
};
// 观看视频
function watchVideos() {
    // 点击一下左上角起点白泽,防止其他弹窗弹出影响看视频
    clickElementCenter(className("android.widget.Image").clickable(true).boundsInside(0,0,screen_width /2 ,screen_height/4).findOne(500));
    // 获取所选任务,判断是否只执行激励任务
    let watch_flag = null;
    if (select_tasks.length > 0){
        if (select_tasks.includes("task_video_all")){
            console.log("开始执行所有视频任务");
            while (text("看视频").findOnce()) {
                swipeTargetElement("看视频",true);
                console.log("=====================");
                watch_flag = waitAdVideo();
                // 当出现异常或观看视频数量超过20个直接退出
                if (watch_flag == 2 || view_video_total > 20) {
                    break;
                };
                console.log("=====================");
            };
        } else {
            console.log("开始执行激励视频任务");
            swipeTargetElement("激励视频任务",false);
            let jl_video = getJlVideoXy();
            // 查找在特定Y轴范围内的“看视频”按钮
            let look_video = text("看视频").boundsInside(0, jl_video.y_top, screen_width, jl_video.y_bottom).findOnce();
            while (look_video) {
                clickElementCenter(look_video);
                console.log("=====================");
                watch_flag = waitAdVideo();
                // 当出现异常或观看视频数量超过15个直接退出
                if (watch_flag == 2 || view_video_total > 15) {
                    break;
                };
                jl_video = getJlVideoXy();
                look_video = text("看视频").boundsInside(0, jl_video.y_top, screen_width, jl_video.y_bottom).findOnce();
                console.log("=====================");
            };
        };
    };
};
// 等待观看广告
function waitAdVideo() {
    let watch_flag = 1;
    let error_total = 0;
    console.log("开始看广告");
    if (text("手机号绑定").findOne(500)) {
        console.log("请先绑定手机号,再执行任务");
        return 2;
    };
    if (text("继续播放").findOne(500)){
        clickElementCenter(text("继续播放").findOne(500));
    };
    let reward = textEndsWith("获得奖励").findOne(7000);
    let ad_time = getAdTime(reward);
    console.log(`等待广告:${ad_time}秒`);
    sleep(ad_time*1000);
    // 返回退出
    back();
    if (textContains("领奖上限").findOne(500)) {
        console.log("当前设备已超过领奖上限,退出");
        watch_flag = 2;
    };
    if (textEndsWith("完成拼图").findOne(500)){
        console.log("出现验证码,请过段时间再执行")
        watch_flag = 2;
    };
    while (!text("激励视频任务").findOne(3000) && error_total < 5){
        let stop_time = parseInt(random(2,3));
        if (text("福利中心").findOne(500)){
            console.log(`检测到未在任务页, 等待${stop_time}s后尝试进入任务`);
            sleep(stop_time * 1000);
            clickElementCenter(text("福利中心").findOne(500));
        } else {
            console.log(`任务可能未退出, 等待${stop_time}s后尝试点击退出`);
            sleep(stop_time * 1000);
            clickElementClose();
        };
        error_total++;
    };
    let close_btn_zdl = text("知道了").findOne(2000);
    if (close_btn_zdl){clickElementCenter(close_btn_zdl);};
    view_video_total++;
    console.log(`结束看广告,已看视频:${view_video_total}个`);
    return watch_flag;
}; 
// 获取广告时间
function getAdTime(element) {
    if (element) {
        let time_match = element.text().match(/\d+/g);
        return time_match ? parseInt(time_match[0]) + 1 : 10;
    } else {
        // console.log("未获取到广告时间,默认等待30s");
        return 30;
    };
};
// 根据指定文本,滚动到指定节点,中间开始滑动,swipe_way方向,每次滑动距离为300,直到出现目标
function swipeTargetElement(text_name,is_click){
    let ele_btn = text(text_name).findOne(1000);
    let center = getCenterXy(ele_btn); // 获取元素位置
    let swipe_distance = 300; // 每次滑动距离
    let swipe_y1 = screen_height / 2; // 滑动起始点
    let swipe_y2 = 0; // 滑动终止点
    let swipe_count = 0;
    let max_swipes = Math.ceil(screen_height / swipe_distance); // 计算最大滑动次数,防止陷入死循环
    let target_y_min = screen_height / 2 - 300; // 目标范围最小值
    let target_y_max = screen_height / 2 + 300; // 目标范围最大值
    // console.log(`${text_name}位置:(${center.center_x},${center.center_y})`)
    if (center){
        // 当节点位置大于屏幕且不能在屏幕边缘的时候,需要向上滑
        if ((center.center_y + swipe_distance)  > screen_height) {
            // 目标在屏幕下方，需要向上滑动
            swipe_y2 = swipe_y1 - swipe_distance;
        } else if (center.center_y <= 0) {
            // 目标在屏幕上方，需要向下滑动
            swipe_y2 = swipe_y1 + swipe_distance;
        } else {
            // 目标在屏幕内，不需要滑动
            console.log("目标已经在屏幕内，无需滑动");
            if (is_click){clickElementCenter("", center);}
            return;
        };
        while ( (center.center_y < target_y_min || center.center_y > target_y_max) && swipe_count < max_swipes){
          	console.log("目标不在屏幕内，开始滑动");
            swipe(screen_width/2,swipe_y1,screen_width/2,swipe_y2,random(400, 1000))
            ele_btn = text(text_name).findOne(1000);
            center = getCenterXy(ele_btn);
            swipe_count++;
        };
        if (is_click){clickElementCenter("", center);}
    };
};
// 获取随机坐标中心
function getCenterXy(element) {
    if (!element) {
        return null;
    };
    let bounds = element.bounds();
    return {center_x:bounds.centerX(), center_y:bounds.centerY()};
};
// 获取激励任务视频位置
function getJlVideoXy(){
    let js_video = getCenterXy(text("激励视频任务").findOne(3000));
    if (!js_video){
        // 如果没有找到，就全屏搜索
        return {y_top:0,y_bottom:screen_height};
    } else {
        // 定义一个Y轴的搜索范围，“激励视频任务”按钮Y轴位置上下200像素
        return {
                y_top:Math.max(0, js_video.center_y - 200),
                y_bottom:Math.min(screen_height, js_video.center_y + 200)
        };
    };
};
// 递归点击父元素函数
function clickElementLoop(element) {
    try {
        // 如果元素为空，直接返回false
        if (!element){return false;}
        // 尝试点击当前元素
        if (element.click()){return true;}
        // 获取父元素
        let parent_element = element.parent();
        // 如果没有父元素，尝试点击当前元素的中心
        if (!parent_element) {
            clickElementCenter(element);
            return false;
        }
        // 递归点击父元素
        return clickElementLoop(parent_element);
    } catch (e) {
        console.error("点击元素出错:", e);
        return false;
    }
};
// 点击元素坐标中心
function clickElementCenter(element,center) {
    // 元素节点或者元素位置
    try {
        if (!center){
            center = getCenterXy(element);
            if (!center) {return false;};
        };
        console.hide();
        // 隐藏点击,防止控制台遮挡了点击区域
        sleep(random(1000,2000))
        let flag = false;
        if (center.center_x > 0 && center.center_y > 0){
            flag = click(random(center.center_x-2,center.center_x+2), random(center.center_y-2,center.center_y+2));
        };
        console.show();
        sleep(random(1000,2000))
        return flag
        // console.log("已点击坐标");
    } catch (e) {
        console.error("点击坐标中心出错:", e);
        console.show();
        return false;
    }
};
// 点击元素关闭
function clickElementClose(){
    // 跳过按钮
    let close_btn_tggg = text("跳过广告").findOne(500);
    if (close_btn_tggg){
        clickElementCenter(close_btn_tggg);
        let close_btn_jxgk = text("继续观看").findOne(500);
        if (close_btn_jxgk){clickElementCenter(close_btn_jxgk);};
        return;
    };
    let close_btn_gb = text("关闭").findOne(500);
    if (close_btn_gb){
        clickElementCenter(close_btn_gb);
        return;
    };
    let close_btn_tg = text("跳过").findOne(500);
    if (close_btn_tg){
        clickElementCenter(close_btn_tg);
        return;
    };
    // 右上角关闭按钮
    let close_btn_10 = className("android.view.ViewGroup").indexInParent(1).boundsInside(screen_width * 2 / 3,0,screen_width,screen_height/4).findOne(500);
    if (close_btn_10){
        clickElementCenter(close_btn_10);
        return
    };
    // 左上角关闭按钮
    let close_btn_5 = className("android.widget.ImageView").boundsInside(0,0,screen_width * 2 / 3,screen_height/4).findOne(500);
    if (close_btn_5){
        clickElementCenter(close_btn_5);
        return;
    };
};
// 判断是否有数字键盘检测
function isPwdKeyboardVisible() {
    for (let i = 0; i < 10; i++) {
        if (!(desc(i).findOne(500) || text(i).findOne(500))){
            return false; // 如果任何一个数字的元素不存在，则返回false
        };
    };
    return true; // 所有数字的元素都存在
};
// 判断是否有数字键盘检测
function clickElementScreenPwd(selector) {
    let element = desc(selector).findOne(500);
    if (element) {
        element.click();
    } else {
        element = text(selector).findOne(500);
        if (element) {
            element.click();
        };
    }
};
// 唤醒并解锁手机
function unlockScreen(){
    //判断屏幕锁定，解锁屏幕（数字密码）
    try {
        device.wakeUpIfNeeded(); //唤醒设备
        sleep(1000); // 等待屏幕亮起
        //  检查是否锁屏再进行密码验证
        if (isActuallyLocked()){
            gesture(1000, [screen_width / 2, screen_height * 2 / 3], [screen_width / 2, 100]); // 向上滑动进入解锁页面或者解锁手机
            sleep(1000);
            if (unlock_pwd.length > 0 && isPwdKeyboardVisible()){
                let pwd_list = unlock_pwd.split("");
                pwd_list.forEach(pwd => {
                    clickElementScreenPwd(pwd);
                    sleep(500);
                });
            };
            sleep(1000);
        };
        // 重置回到桌面
        home();
        sleep(1000);
        if (isActuallyLocked()){
            return false;
        } else {
            return true;
        };
    } catch(e){
        console.log("解锁出现屏幕异常")
        return false;
    };
};
// 获取屏幕宽度
function getDeviceWidth() {
    let width = device.width;
    if (width === 0) {
        try {
            // 尝试使用其他方式获取宽度
            width = context.getResources().getDisplayMetrics().widthPixels;
            // 只有当获取到的宽度大于默认宽度时，才使用这个值
            width = width > default_width ? width : default_width;
        } catch (e) {
            // 如果发生异常，返回默认宽度
            width = default_width;
        };
    }
    return width;
};
// 获取屏幕高度
function getDeviceHeight() {
    let height = device.height;
    if (height === 0) {
        try {
            // 尝试使用其他方式获取高度
            height = context.getResources().getDisplayMetrics().heightPixels;
            // 只有当获取到的高度大于默认高度时，才使用这个值
            height = height > default_height ? height : default_height;
        } catch (e) {
            // 如果发生异常，返回默认高度
            height = default_height;
        };
    }
    return height;
};

// 屏幕是否为锁定状态
function isDeviceLocked() {
    importClass(android.app.KeyguardManager)
    importClass(android.content.Context)
    let sp = context.getSystemService(Context.KEYGUARD_SERVICE)
    return sp.isKeyguardLocked()
};
function isScreenOff() {
    importClass(android.os.PowerManager)
    let pm = context.getSystemService(Context.POWER_SERVICE)
    return !pm.isInteractive()
};
// 综合判断方案
function isActuallyLocked() {
    return isDeviceLocked() || isScreenOff()
};
/*** hamibot 配置
[
  {
    "name": "select_tasks",
    "type": "checkbox",
    "label": "任务选择",
    "options": {
      "task_video_a": "激励视频任务",
      "task_video_all": "所有视频任务"
    },
    "help": "选择需要执行的任务"
  },
  {
    "name": "unlock_pwd",
    "type": "text",
    "label": "锁屏密码",
    "help": "向上滑动解锁,可为空"
  }
]
***/ 