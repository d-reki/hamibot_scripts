/*** 
    脚本名称：qidian_script.js
    功能描述：用于qidian视频任务
    作    者：reki
    更新日期：2026-05-28
    日志：修复滑动失效问题，修复无法暂停问题，忽略广告·加点
***/
// 无障碍启动
startAuto();
// 引入必要的模块和设置
let view_video_total = 0; // 统计观看视频数量
let loop_stop_total = 0; // 视频循环停止次数
let us_execution_count = 0; // 解锁屏幕执行次数
let main_execution_count = 0; // 主程序执行次数
const ad_time = 15; // 默认等待15s广告
const max_execution_count = 5; // 主程序最大执行次数
const default_width = 1080;  // 默认屏幕宽度
const default_height = 1920;  // 默认屏幕高度
const { unlock_pwd } = hamibot.env; // 屏幕密码
// const { select_tasks } = hamibot.env; // 执行任务
const screen_width = getDeviceWidth()  // 屏幕宽度
const screen_height = getDeviceHeight();  // 屏幕高度
console.log("=====================");
console.log(`获取屏幕宽度：${screen_width}，高度：${screen_height}`)
console.setSize(screen_width /2, screen_height / 2);
console.setPosition(0, screen_height / 8);
console.show();
// 主程序
main();
// 主程序入口	
function main(){
    // 首次点亮并解锁手机
    let us_flag = unlockScreen();
    while (!us_flag){
        us_execution_count ++;
        console.log(`解锁屏幕失败，等待尝试第${us_execution_count}重新解锁`);
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
        console.log(`切换程序到：“${app_name}”`);
        let success_app = launchApp(app_name);
        if (success_app) {
            console.log("=====================");
            return true;
        } else {
            console.log(`程序：“${app_name}”，启动状态：失败`);
            console.log("=====================");
        }
        return false;
    } catch (e) {
        console.error("启动应用出错：", e);
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
    if (text("领福利").findOne(50)){
        clickElementCenter(text("领福利").findOne(500),true);
    } else {
        clickElementLoop(text("我").findOne(500),true);
    };
    let flzx = text("福利中心").findOne(2000);
    // 判断是否在福利中心页面
    if (flzx || text("激励任务").findOne(2000)) {
        if (flzx){clickElementCenter(flzx,true);}
        // clickElementLoop(textContains("跳过").findOne(1000));
        if (text("激励任务").findOne(2000)) {
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
    clickElementCenter(className("android.widget.Image").clickable(true).boundsInside(0,0,screen_width /2 ,screen_height/4).findOne(500),true);
    // 获取所选任务,判断是否只执行激励任务
    let watch_flag = null;
    console.log("开始执行所有视频任务");
    while (text("去完成").findOnce()) {
       // 只要激励任务里面找到4个已领取就算完成视频任务
        if (getTaskFlag(4)){
            console.log("视频任务已全部完成");
            console.log("=====================");
            return
        };
        // 先检测一下“知道了按钮”是否关闭
        let close_btn_zdl = text("知道了").findOne(1000);
        if (close_btn_zdl) {
            clickElementCenter(close_btn_zdl);
        };
        swipeTargetElement("去完成",true);
        console.log("=====================");
        watch_flag = waitAdVideo();
        // 当出现异常或观看视频数量超过20个直接退出
        if (watch_flag == 2 || view_video_total > 20) {
        break;
        };
        console.log("=====================");
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
    // 优化广告观看逻辑，先关闭广告 -> 跳转广告
    sleep(1000);
    clickElementClose(); // 关闭广告
    sleep(1000);
    continueWatchAd(); // 跳转广告
  	console.log(`等待广告：${ad_time}秒`);
  	sleep(ad_time*1000);
    // 返回退出
    closeWatchAd();
    if (textContains("领奖上限").findOne(500)) {
        console.log("当前设备已超过领奖上限,退出");
        watch_flag = 2;
    };
    if (textEndsWith("完成拼图").findOne(500)){
        console.log("出现验证码,请过段时间再执行")
        watch_flag = 2;
    };
    while (!text("激励任务").findOne(3000) && error_total < 5){
        let stop_time = parseInt(random(2,3));
      	let flzx = text("福利中心").findOne(1000);
        if (flzx){
            console.log(`检测到未在任务页，等待${stop_time}s后尝试进入任务`);
            sleep(stop_time * 1000);
            clickElementCenter(flzx,true);
        } else {
            let continue_ad_btn = continueWatchAd();
            if (continue_ad_btn){
                console.log(`广告未完成，等待广告：${ad_time}秒`);
  	            sleep(ad_time*1000);
                closeWatchAd();
            } else {
                console.log(`广告未完成，等待重新观看`);
                waitAdVideo();
            };  
        };
        error_total++;
    };
    view_video_total++;
  	loop_stop_total = 0;
    console.log(`结束看广告，已看视频：${view_video_total}个`);
    return watch_flag;
}; 

// 判断广告是否观看完，未完成的则继续观看
function continueWatchAd(){
    let continue_ad_btn = className("android.view.ViewGroup").depth(11).drawingOrder(5).findOne(2000);
    if (continue_ad_btn){
        clickElementCenter(continue_ad_btn);
        return true;
    } else {
        continue_ad_btn = className("android.view.ViewGroup").depth(11).drawingOrder(6).findOnce(2000);
        if (continue_ad_btn){
            clickElementCenter(continue_ad_btn);
            return true;
        }
    }
    return false;
};

// 判断任务是否完成
function getTaskFlag(task_num) {
    // 先找到任意一个“激励任务”控件
    let jl_task_btn = text("激励任务").findOne(1000);
    if (!jl_task_btn) {
        console.log("未找到任何“激励任务”控件");
        return false;
    }
    // 找到其父级可滚动或列表容器（可能需要根据实际层级调整 parent() 次数）
    let jl_task_parent = jl_task_btn.parent(); // 示例：向上找1级
    if (!jl_task_parent) {
        // 如果不知道父级深度，直接全屏统计
        let count = text("已领取").find().length;
        console.log("“全屏”已领取数量：", count);
        return count >= task_num;
    }
    // 在容器范围内统计
    let b = jl_task_parent.bounds();
    let jl_elements = boundsInside(b.left, b.top, b.right, b.bottom).text("已领取").find();
    console.log(`“已领取”数量：${jl_elements.length}`);
    return jl_elements.length >= task_num;
};

// 去完成按钮点击
function click_to_complete(text_name){
    let jl_task_btn = text("激励任务").findOne(1000);
    // 需要在激励任务的盒子范围内点击“去完成”
    if (jl_task_btn){
        let b = jl_task_btn.bounds();
        // 定义查找区域：x从0到screen_width，y从b.top-100到屏幕底部
        let jl_element = boundsInside(0, b.top - 100, screen_width, screen_height).text(text_name).findOne(1000);
        if (jl_element){
            clickElementCenter(jl_element)
            return true;
        }
    };
    // 如果没找到的话就全屏点击
    jl_element = text(text_name).findOne(1000)
    if (jl_element){
        clickElementCenter(jl_element);

    };
};

// 滑动至目标并点击
function swipeTargetElement(text_name, is_click) {
    console.hide()
    let ele_btn = text(text_name).findOne(1000);
    if (!ele_btn) {
        console.show()
        console.log("未找到元素:", text_name);
        return;
    }
    let b = ele_btn.bounds();   // 用 bounds 代替 getCenterXy
    // print(`控件边界：top=${b.top}, bottom=${b.bottom}`);
    let swipe_distance = 300;
    let max_swipes = Math.ceil(screen_height / swipe_distance);
    let target_y_min = screen_height / 2 - 300;
    let target_y_max = screen_height / 2 + 300;
    let swipe_count = 0;
    // 判断条件改为用 bounds 的 top 和 bottom 是否在目标区域内
    while ((b.top < target_y_min || b.bottom > target_y_max) && swipe_count < max_swipes) {
        let swipe_y1, swipe_y2;
        if (b.top < 0) {
            // 控件在屏幕顶部外：手指向上滑（从中间往上方），让内容下移，拉出顶部控件
            swipe_y1 = screen_height / 2;
            swipe_y2 = swipe_y1 - swipe_distance;
        } else if (b.bottom > screen_height) {
            // 控件在屏幕底部外：手指向上滑（从中间往上方），让内容上移，拉出底部控件
            swipe_y1 = screen_height / 2;
            swipe_y2 = swipe_y1 - swipe_distance;
        } else {
            // 控件至少部分可见，但不在中间区域，轻微滑动调整
            if (b.top < target_y_min) {
                // 偏上，向下滑一点（手指从上往下）
                swipe_y1 = screen_height * 0.4;
                swipe_y2 = swipe_y1 + swipe_distance;
            } else {
                // 偏下，向上滑一点（手指从下往上）
                swipe_y1 = screen_height * 0.6;
                swipe_y2 = swipe_y1 - swipe_distance;
            }
        }
        console.log(`开始第${swipe_count+1}次滑动`);
        swipe(screen_width/2, swipe_y1, screen_width/2, swipe_y2, random(400, 1000));
        sleep(800);
        // 重新查找并读取新的 bounds
        ele_btn = text(text_name).findOne(1000);
        if (!ele_btn) break;
        b = ele_btn.bounds();
        swipe_count++;
    };
    if (is_click) {
        click_to_complete(text_name);
    }
    console.show()
}
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
function clickElementCenter(element,is_hide) {
    // 元素节点或者元素位置
    try {
        center = getCenterXy(element);
        if (!center) {return false;};
        // 隐藏点击,防止控制台遮挡了点击区域
        if (is_hide){
            console.hide();
            sleep(1000)
        } else {
            sleep(500)
        };
        let flag = false;
        if (center.center_x > 0 && center.center_y > 0){
            flag = click(random(center.center_x-2,center.center_x+2), random(center.center_y-2,center.center_y+2));
        };
      	sleep(500)
        console.show();
        return flag
    } catch (e) {
        console.error("点击坐标中心出错：", e);
        return false;
    }
};

// 点击元素关闭
function clickElementClose() {
    let try_count = 0;
    const max_try = 2;
    let close_flag = false;
    let btn_type = "";
    while (try_count < max_try && !close_flag) {
        console.log(`开始第${try_count + 1}次尝试获取关闭按钮`)
        // 右上角关闭按钮
        let close_btn_close = className("android.view.ViewGroup").boundsInside(screen_width * 2 / 3, 0, screen_width, screen_height / 4).find();
        if (close_btn_close && close_btn_close.length > 0) {
            // print("获取关闭按钮1");
            clickElementCenter(close_btn_close[close_btn_close.length - 1]);
            close_flag = true;
            btn_type = "右上角"
            break;
        };
        if (!close_flag) {
            // 内置广告左上角的关闭按钮
            let inside_close_btn = className("android.widget.ImageView").depth(6).drawingOrder(2).boundsInside(0, 0, screen_width / 2, screen_height / 3).findOne(1000);
            if (inside_close_btn) {
                close_flag = true;
                btn_type = "内置广告左上角";
                clickElementCenter(inside_close_btn);
                break;
            }
        };
        if (text("激励任务").findOne(1000)){
            return;
        };
        // 等待一段时间让页面有机会刷新
        sleep(1000);
        try_count++;
    };
    if (!close_flag) {
        console.log(`尝试${max_try}次后仍未找到关闭按钮`);
    } else {
        console.log(`退出按钮位置：${btn_type}`);
    }
}
// 视频关闭退出
function closeWatchAd(){
    // 先回到桌面,可以有效关闭因系统阻挡跳转广告（双应用、允许跳转等）
    home();
    sleep(1000);
  	startApp("起点读书");
    sleep(1000);
  	// 返回尝试关闭
  	back();
    let try_count = 0;
    while (try_count < 2) {
        // 查找"知道了"按钮
        let close_btn_zdl = text("知道了").findOne(1000);
        if (close_btn_zdl) {
            // 找到了"知道了"按钮，点击它
            clickElementCenter(close_btn_zdl);
            // 找到了就直接退出循环
            return;
        } else {
            // 没找到"知道了"按钮，说明还在视频里面则尝试点击退出
            try_count++;
            clickElementClose();
        };
        if (text("激励任务").findOne(1000)){
            return;
        };
    }
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