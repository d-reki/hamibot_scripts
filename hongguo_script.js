// 引入必要的模块和设置
auto.waitFor();
const screen_width = device.width;  // 屏幕宽度
const screen_height = device.height;  // 屏幕高度
console.show();
console.setSize(device.width /2, device.height / 3);
console.setPosition(0, 0);
// 主程序入口
function main() {
    try {
        let start_status = startApp("红果免费短剧");
        if (start_status) {
            executeTask();
        }
    } catch (e) {
        console.error("主程序执行出错:", e);
        setTimeout(main, 5000); // 出错后重试
    }
};

// 执行起点福利任务
function executeTask() {
    try {
        console.log("=====================");
        console.log(`屏幕宽度:${screen_width},屏幕高度:${screen_height}`)
        console.log("开始进入福利");
        clickCenter(text("福利").findOne(3000));
        // 判断是否跳出签到框,关闭
        closeSignIn();
        let succ_flag = true;
        if (text("一键登录").findOne(1000)) {
            console.log("请先自行登录");
            setTimeout(main, 10000);
        } else {
            if (text("日常福利").findOne(1000)) {
                const { select_tasks } = hamibot.env;
                select_tasks = ["task_a","task_b"];
                for (let task in select_tasks){
                    if (select_tasks[task] == "task_a"){
                      	console.log("=====================");
                        console.log("开始执行'看短剧'任务");
                        videoWelfareTask();
                      	console.log("=====================");
                    } else if (select_tasks[task] == "task_b"){
                      	console.log("=====================");
                        console.log("开始执行'日常福利'任务");
                        dailyWelfareTask();
                        console.log("=====================");
                    };
                };
            } else {
                succ_flag = false;
                console.log("进入福利失败, 尝试重新执行");
                setTimeout(main, 5000);
            };
            if(!succ_flag){
                console.log("福利任务失败");
            } else {
                console.log("福利任务已完成");
            };
            sleep(5000);
        };
        console.log("=====================");
    } catch (e) {
        console.error("执行福利任务出错:", e);
    }
};

// 尝试启动应用
function startApp(app_name) {
    try {
        console.log("=====================");
        console.log(`启动程序: '${app_name}'.`);
        let success_app = launchApp(app_name);
        if (success_app) {
            console.log(`程序: '${app_name}', 启动状态: 成功`);
            console.log("=====================");
            return true;
        } else {
            console.log(`程序: '${app_name}', 启动状态: 失败`);
            console.log("=====================");
        }
        return false;
    } catch (e) {
        console.error("启动应用出错:", e);
        return false;
    }
};

// 滚动到指定节点,中间开始滑动,swipe_way方向,每次滑动距离为500,直到出现目标
function swipeTargetElement(desc_name){
    let ele_btn = desc(desc_name).findOne(1000);
    let center = getXy(ele_btn);
    let swipe_distance = 500;
    let swipe_y1 = screen_height / 2;
    let swipe_y2 = 0;
    let swipe_count = 0;
    let max_swipes = Math.ceil(screen_height / swipe_distance);
    let target_y_min = screen_height / 2 - 500;
    let target_y_max = screen_height / 2 + 500;
    console.log(`${desc_name}位置:${center.center_x},${center.center_y}`)
    if (center){
        // 当位置大于屏幕的时候,需要向上滑
        if (center.center_y > screen_height) {
            // 目标在屏幕下方，需要向上滑动
            swipe_y2 = swipe_y1 - swipe_distance;
        } else if (center.center_y < 0) {
            // 目标在屏幕上方，需要向下滑动
            swipe_y2 = swipe_y1 + swipe_distance;
        } else {
            // 目标在屏幕内，不需要滑动
            // console.log("目标已经在屏幕内，无需滑动");
            console.log(`开始点击:${desc_name}`);
            clickCenter("", center);
            while(textStartsWith("加载中").exists()){
                console.log("网络加载中")
                sleep(3000)
            };
            return;
        };
        // console.log("目标不在屏幕内，开始滑动");
        while ( (center.center_y < target_y_min || center.center_y > target_y_max) && swipe_count < max_swipes){
        // while ((center.center_y > screen_height/1.5 || center.center_y < 0) && swipe_count < max_swipes){
            // console.log("开始滑动:")
            swipe(screen_width/2,swipe_y1,screen_width/2,swipe_y2,random(400, 1000))
            ele_btn = desc(desc_name).findOne(1000);
            center = getXy(ele_btn);
            swipe_count++;
        };
        console.log(`开始点击:${desc_name}`);
        clickCenter("",center);
        while(textStartsWith("加载中").exists()){
            console.log("网络加载中")
            sleep(3000)
        };
    };
};

// 日常福利任务
function dailyWelfareTask(){
    if (desc("签到领金币").findOne(1000)){
        console.log("=====================");
        console.log("开始执行签到任务");
        swipeTargetElement("签到领金币");
        sleep(random(1500,2500));
        clickCenter(textStartsWith("立即签到").findOne(1000));
        whetherBusy();
        sleep(random(500,1000));
        closeSignIn();
        console.log("签到已完成");
        console.log("=====================");
    };
    if (desc("收益日报奖励").findOne(1000)) {
        // dailyWelfareLoop("收益日报奖励", dailyWelfareT1);
    };
    if (desc("看视频赚海量金币").findOne(1000)) {
        //dailyWelfareLoop("看视频赚海量金币", dailyWelfareT2);
    };
    if (desc("翻卡赢金币").findOne(1000)) {
        //dailyWelfareLoop("翻卡赢金币", dailyWelfareT4);
    };
    if (desc("浏览商品赚钱").findOne(1000)){
        dailyWelfareLoop("浏览商品赚钱", dailyWelfareT3);
    };
    if (desc("逛街赚金币").findOne(1000)){
        //dailyWelfareLoop("逛街赚金币", dailyWelfareT5);
    };
};

// 日常任务循环执行
function dailyWelfareLoop(taskDesc, taskFunction) {
    console.log("=====================");
    console.log(`任务:${taskDesc},开始执行`);
    let flag = 1;
    let empty_total = 0;
    while (desc(taskDesc).exists()) {
        flag = taskFunction();
        if (flag == 2) {
            console.log("未获取到奖励,等待重新尝试");
            empty_total++;
        } else if (flag == 1) {
            empty_total = 0;
        }
        if (flag == 3 || empty_total > 2) {
            break;
        }
        sleep(random(1000, 2000));
    }
    console.log(`任务:${taskDesc},执行完成`);
    console.log("=====================");
};

// 日常任务-收益日报
function dailyWelfareT1(){
    swipeTargetElement("收益日报奖励");
    sleep(random(1000,2000));
    // 点击后会跳出确认框再进行看视频
    if (textStartsWith("看视频最高再领").findOne(1000)){
        clickCenter(textStartsWith("看视频最高再领").findOne(1000));
        const reward = waitForRewardText(3000);
        if (!reward){
            return 2;
        };
        const time = getAdDuration(reward);
        console.log(`等待:${time + 1}秒`);
        sleep(1000 * (time + 1));
        back();
        clickCenter(desc("坚持退出").findOne(1000));
        return 1;
    } else if (desc("我知道了").findOne(1000) ){
        clickCenter(desc("我知道了").findOne(1000));
        return 3;
    } else {
        return 2
    };
};

// 日常任务-看视频海量金币
function dailyWelfareT2(){
    swipeTargetElement("看视频赚海量金币");
    // 点击后直接跳到视频
    if (textContains("你已领过该奖励").findOne(500)){ //不生效
        return 3;
    };
    sleep(random(500,1000));
    const reward = waitForRewardText(3000);
    if (!reward){
        return 2;
    };
    const time = getAdDuration(reward);
    console.log(`等待:${time + 1}秒`);
    sleep(1000 * (time + 1));
    back();
    clickCenter(desc("坚持退出").findOne(1000));
    return 1;
};

// 日常任务-浏览商品赚钱
function dailyWelfareT3(){
    let ls_flag = 1;
    swipeTargetElement("浏览商品赚钱");
    while (text("抖音快捷绑定").exists()){
        console.log("浏览商品需要绑定抖音,请先绑定抖音")
        sleep(5000);
    };
    sleep(random(500,1000));
    // 浏览商品是默认60s
    const time = 75;
    console.log(`等待:${time}秒`);
    swipeRandomGoods(time * 1000);
    back();
    if (textEndsWith("秒可领奖励").findOne(10000)){
        ls_flag = 2;
    };
    clickCenter(desc("坚持退出").findOne(1000));
    return ls_flag;
};

// 日常任务-翻卡赢金币
function dailyWelfareT4(){
    swipeTargetElement("翻卡赢金币");
    sleep(random(1000,2000));
    // 点击后会跳出确认框再进行看视频
    if (textStartsWith("看视频").findOne(1000)){
        clickCenter(textStartsWith("看视频").findOne(1000));
        const reward = waitForRewardText(3000);
        if (!reward){
            return 2;
        };
        const time = getAdDuration(reward);
        console.log(`等待:${time + 1}秒`);
        sleep(1000 * (time + 1));
        back();
        clickCenter(desc("坚持退出").findOne(1000));
        return 1;
    } else if (desc("开心收下").findOne(1000) ){
        clickCenter(desc("开心收下").findOne(1000));
        return 3;
    } else if (desc("我知道了").findOne(1000) ){
        clickCenter(desc("我知道了").findOne(1000));
        return 3;
    } else {
        return 2
    };
};

// 日常任务-逛街赚金币
function dailyWelfareT5(){
    let ls_flag = 1;
    swipeTargetElement("逛街赚金币");
    sleep(random(500,1000));
    // 逛街赚金币是默认30s
    const time = 40;
    console.log(`等待:${time}秒`);
    swipeRandomGoods(time * 1000);
    back();
    whetherBusy();
    if (textEndsWith("秒可领奖励").findOne(10000)){
        ls_flag = 2;
    };
    clickCenter(desc("坚持退出").findOne(1000));
    return ls_flag;
};
// 看短剧任务
function videoWelfareTask(){

};

// 点击坐标中心
function clickCenter(ele,center) {
    try {
        if (!center){
            center = getXy(ele);
        };
        if (!center) {
            // console.log("没找到坐标");
            return false;
        };
        console.hide();
        // 隐藏点击,防止控制台遮挡了点击区域
        sleep(random(1000,2000))
        // 中心位置加随机数 防止被检测一直点中心位置
        flag = click(random(center.center_x-3,center.center_x+3), random(center.center_y-3,center.center_y+3));
        console.show();
        return flag
        // console.log("已点击坐标");
    } catch (e) {
        console.error("点击坐标中心出错:", e);
        console.show();
        return false;
    }
};
// 提取坐标中心
function getXy(obj) {
    try {
        if (obj == null) {
            return null;
        }
        const bounds = obj.bounds();
        return {center_x:bounds.centerX(), center_y:bounds.centerY()}
        return {center_x: (bounds.left + bounds.right) / 2,center_y: (bounds.top + bounds.bottom) / 2};
    } catch (e) {
        console.error("提取坐标中心出错:", e);
        return null;
    }
};
// 签到关闭按钮
function closeSignIn(){
    let qd_btn = className("com.lynx.tasm.behavior.ui.LynxFlattenUI").depth(11).clickable(true).indexInParent(125).findOne(500);
    if (qd_btn){
        clickCenter(qd_btn);
    };
};

// 随机滑动屏幕,浏览商品
function swipeRandomGoods(times) {
    let total_duration = 0; // 记录已滑动的时间
    while (total_duration < times) {
        let is_swipe_up = random(0, 100) < 35; // 35%的概率上滑
        let start_x = random(screen_width / 2 - 200, screen_width / 2 + 200);
        let start_y = is_swipe_up ? screen_height - random(400,600) : screen_height / 2 + random(400,600);
        let end_x = random(screen_width / 2 - 200, screen_width / 2 + 200);
        let end_y = is_swipe_up ? screen_height / 2 + random(400,600) : screen_height / 2 - random(400,600);
        let duration = random(400, 2000);
        let pause_duration = random(3000,8000);
        // console.log(`暂停时间:${pause_duration/1000}s,滑动轨迹:(${start_x},${start_y})=>(${end_x},${end_y})`)
        swipe(start_x, start_y, end_x, end_y, duration);
        sleep(pause_duration);
        // className("com.lynx.tasm.ui.image.FlattenUIImage").findOne(1000).click();
        total_duration += duration + pause_duration + 1000;
    };
};
// 刷视频
function brushRandomVideos(a, b) {
    for (let i = 0; i < random(a, b); i++) {
        // 生成随机坐标和滑动时间
        let start_x = random(800 / 1440 * device.width, 1100 / 1440 * device.width);
        let start_y = random(2300 / 3168 * device.height, 2500 / 3168 * device.height);
        let end_x = random(900 / 1440 * device.width, 1020 / 1440 * device.width);
        let end_y = random(200 / 3168 * device.height, 350 / 3168 * device.height);
        let duration = random(400, 1000);

        swipe(start_x, start_y, end_x, end_y, duration);
        //toastLog(APP_name + "计数器：" + (i + 1));
        // 生成2.6到8.7之间的随机数
        sleep(random(2600, 8700));
    };
};
// 等待奖励文本出现
function waitForRewardText(timeout) {
    try {
        return textEndsWith("可领奖励").findOne(timeout);
    } catch (e) {
        console.error("等待奖励文本出现出错:", e);
        return null;
    };
};
function getAdDuration(reward) {
    try{
        let time_text = jsTime(reward);
        if (time_text) {
            return parseInt(time_text);
        } else {
        	console.log("未获取广告时间,默认等待10s");
            return 9;
        };
    } catch (e) {
        console.error("获取广告时间出错:",e)
        return null;
    };
};
//提取数字
function jsTime(text_obj) {
    try {
        if (text_obj == null) {
            return null
        }
        // 存储初始文本内容
        let init_text = text_obj.text();
        // log(init_text)
        //获取时间
        let match = init_text.match(/\d+/g);
        return match ? parseInt(match[0]) : null;
    } catch(e) {
        console.error("获取时间出错:",e);
        return null;
    };
};
main()