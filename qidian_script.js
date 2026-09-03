/***
 * 脚本名称：qidian_script.js
 * 功能描述：用于起点读书（qidian）福利中心的激励视频任务自动化
 *           流程：解锁屏幕 -> 启动起点读书 -> 进入福利中心 -> 按 task_list 逐个执行任务
 *                -> 循环点击"去完成" -> 观看广告 -> 关闭广告返回 -> 检测任务完成
 * 作    者：reki
 * 更新日期：2026-09-03
 * 更新日志：
 *          1、新增“去完成”位置检测（使用双标题滑动到安全区间）
 *          2、新增广告加点任务
 */

// ==================== 无障碍服务启动 ====================
// 必须在脚本最开头调用，后续所有控件查找都依赖无障碍服务
// 未锁屏时用 auto.waitFor() 阻塞等待；锁屏时无法弹设置页，仅 auto() 申请，后续靠脚本重试
startAuto();

// ==================== 全局变量与常量 ====================

// view_video_total：统计已观看视频数量，超过 max_video_total 阈值自动退出，防止无限循环
let view_video_total = 0;
// loop_stop_total：视频循环停止次数（预留计数，当前未参与退出判断）
let loop_stop_total = 0;
// us_execution_count：解锁屏幕执行次数，用于解锁失败重试计数
let us_execution_count = 0;
// main_execution_count：主程序执行次数，超过 max_execution_count 则停止任务
let main_execution_count = 0;

// ad_time：默认等待广告时长（秒），closeWatchAd 返回前等待这么久让广告播完
const ad_time = 15;
// max_execution_count：主程序 / 解锁的最大执行次数，超过则放弃不再重试
const max_execution_count = 5;
// default_width：默认屏幕宽度（仅当无法获取真实宽度时兜底）
const default_width = 1080;
// default_height：默认屏幕高度（仅当无法获取真实高度时兜底）
const default_height = 1920;
// max_video_total：单次运行观看视频总数上限，超过则强制退出，防止脚本失控
const max_video_total = 20;
// max_ad_retry_depth：waitJlAdVideo 自调用的最大递归深度，防止页面卡死时栈溢出
const max_ad_retry_depth = 3;

// unlock_pwd：屏幕解锁密码（hamibot 配置项，可为空字符串）
const { unlock_pwd } = hamibot.env;
// task_list：执行任务选择（hamibot 配置项），数组，元素为 '1'(激励任务) / '2'(广告加点)
//   示例配置：[{ name:'task_list', type:'checkbox', label:'执行任务：', options:{'1':'激励任务','2':'广告加点'} }]
//   未选择时 hamibot.env.task_list 为 undefined，脚本会提示并退出
const { task_list } = hamibot.env;

// screen_width / screen_height：屏幕宽高像素值（getDeviceWidth / getDeviceHeight 已做兜底）
const screen_width = getDeviceWidth();
const screen_height = getDeviceHeight();

// ==================== 控制台初始化 ====================
console.log('=====================');
console.log(`获取屏幕宽度：${screen_width}，高度：${screen_height} ，锁屏密码：${unlock_pwd}，执行任务：${task_list}`);
// console.setSize(w, h)：控制台窗口设为屏幕一半大小，尽量少遮挡内容区域
console.setSize(screen_width / 2, screen_height / 2);
// console.setPosition(x, y)：控制台放在屏幕上方 1/8 处，避开常用点击区域（顶部 Logo / 底部按钮）
console.setPosition(0, screen_height / 8);
console.show();

// ==================== 脚本入口 ====================
main();

/**
 * 主程序入口
 * 流程：解锁屏幕 -> 校验解锁结果 -> 启动起点读书 -> 关闭启动弹窗 -> 执行福利任务
 * 解锁失败会重试，超过 max_execution_count 次则放弃
 */
function main() {
    // 首次点亮并解锁手机
    let us_flag = unlockScreen();

    // 解锁失败则循环重试，直到成功或超过最大次数
    while (!us_flag) {
        us_execution_count++;
        console.log(`解锁屏幕失败，等待尝试第：${us_execution_count}次重新解锁`);
        sleep(3000);
        us_flag = unlockScreen();
        if (us_execution_count > max_execution_count) {
            console.log('解锁屏幕失败次数过多,退出任务');
            break;
        };
    };

    // 只有解锁成功才继续执行任务
    if (us_flag) {
        let start_status = startApp('起点读书');
        if (start_status) {
            closeStartupWindow();   // 关闭开屏广告与各类启动弹窗
            executeWelfareTask();   // 进入福利中心执行视频任务
        };
    };
};

/**
 * 重新运行主程序
 * 未找到福利中心 / 未找到视频任务时调用，最多重试 max_execution_count 次
 */
function retryMain() {
    main_execution_count++;
    if (main_execution_count <= max_execution_count) {
        // 延迟 5 秒后重新执行主程序，给页面留足加载时间
        setTimeout(main, 5000);
    } else {
        console.log('已达到最大尝试次数, 停止任务');
    };
}

/**
 * 启动无障碍服务
 * @note 未锁屏时用 auto.waitFor() 阻塞等待用户开启；锁屏时 auto() 仅申请，后续靠脚本重试
 */
function startAuto() {
    if (!isActuallyLocked()) {
        auto.waitFor();
    } else {
        auto();
    };
}

/**
 * 尝试启动指定应用
 * @param {string} app_name 应用名称（需在设备上可通过 launchApp 唤起）
 * @returns {boolean} 是否启动成功
 */
function startApp(app_name) {
    try {
        console.log('=====================');
        console.log(`切换程序到：${app_name}`);
        let success_app = launchApp(app_name);
        if (success_app) {
            console.log('=====================');
            return true;
        } else {
            console.log(`程序：${app_name}，启动状态：失败`);
            console.log('=====================');
        };
        return false;
    } catch (e) {
        console.error('启动应用出错：', e);
        return false;
    };
}

/**
 * 关闭启动任务前的弹窗
 * （开屏广告"跳过"、青少年模式"我知道了"、首页运营弹窗 imgClose、通知弹窗关闭按钮）
 * 注意：这些弹窗不一定每次都出现，找不到时 clickElementLoop 会静默返回 false
 */
function closeStartupWindow() {
    // 跳过开屏广告（右上角"跳过"按钮）
    clickElementLoop(textContains('跳过').findOne(1000));
    // 弹窗1：青少年模式提示，点"我知道了"关闭
    if (textContains('青少年模式').findOne(500)) {
        clickElementLoop(text('我知道了').findOne(500));
    };
    // 弹窗2：首页运营弹窗，点右上角 imgClose 关闭
    clickElementLoop(id('imgClose').findOne(500));
    // 通知弹窗：系统通知引导弹窗的关闭按钮
    clickElementLoop(id('systemNotificationBottomDialogClose').findOne(500));
};

/**
 * 执行起点福利任务（主任务调度）
 * 流程：进入福利中心 -> 校验激励任务页 -> 保持屏幕常亮 10 分钟 -> watchVideos() -> 关闭常亮
 * 任一步骤未找到目标页面，则调用 retryMain() 重启流程
 */
function executeWelfareTask() {
    console.log('=====================');

    // 如果已经在福利页（有"领福利"），直接点它；否则先切到"我"的 tab
    if (text('领福利').findOne(50)) {
        clickElementCenter(text('领福利').findOne(500), true);
    } else {
        clickElementLoop(text('我').findOne(500), true);
    };

    // 用统一导航函数进入福利中心（含 3 次重试）
    if (!gotoWelfareCenter()) {
        console.log(`未找到福利中心, 第：${main_execution_count}次尝试重启`);
        retryMain();
        sleep(3000);
        return;                    // ← 提前返回，不再三层嵌套
    };

    // 已确认到达激励任务页，开始执行任务
    device.keepScreenOn(60 * 1000 * 10);

    let start_time = new Date();
    watchVideos();
    console.log('福利任务已完成');

    let end_time = new Date();
    console.log(`视频任务共耗时: ${((end_time - start_time) / 1000).toFixed(2)} s`);
    console.log('=====================');

    device.cancelKeepingAwake();
    sleep(3000);
};

/**
 * 循环观看视频任务（任务调度层）
 * 按 task_list 中勾选的顺序逐个调用对应子函数：
 *   '1' -> runIncentiveTask()   激励任务
 *   '2' -> runAdExtraTask()     广告加点
 * 未选择任务（task_list 为 undefined）则提示并退出
 * @note 每个子函数内部各自管理"找去完成 -> 看广告 -> 返回"的循环，本函数只负责排序调用
 */
function watchVideos() {
    // 点击左上角起点白泽(Logo)，防止其他弹窗弹出影响看视频
    clickElementCenter(
        className('android.widget.Image')
            .clickable(true)
            .boundsInside(0, 0, screen_width / 2, screen_height / 4)
            .findOne(500),
        true
    );

    // 未选择任务则提示并退出
    if (!task_list) {
        console.log('未选择任务，请在配置中选择任务再执行');
        return;
    };

    console.log(`开始执行任务所有勾选任务：${task_list}`);

    // 按勾选顺序逐个执行任务（forEach 的 task_id 是字符串，与配置中的 '1'/'2' 严格比较）
    task_list.forEach(function(task_id) {
        if (task_id === '1') {
            // ===== 任务1：激励任务 =====
            console.log('【任务1】开始执行激励任务');
            runIncentiveTask();
        } else if (task_id === '2') {
            // ===== 任务2：广告加点 =====
            console.log('【任务2】开始执行广告加点任务');
            runAdExtraTask();
        };
    });
    console.log('=====================');
    console.log('所有已选任务执行完毕');
};

/**
 * 任务1：激励任务
 * 循环：检测完成 -> 关弹窗 -> 滑找并点击"去完成" -> 看广告 -> 返回
 * 退出条件（满足其一即 return，结束本任务）：
 *   - getTaskFlag(4) 为真：已领取满 4 个，任务完成
 *   - swipeTargetElement 返回 false：滑到底仍找不到"去完成"，说明已无可领项
 *   - waitJlAdVideo 返回 2 或 view_video_total 超上限：广告异常或达到视频总数上限
 */
function runIncentiveTask() {
    // 只要激励任务里找到 4 个"已领取"就算完成
    while (true) {
        if (getTaskFlag(4)) {
            console.log('激励任务已全部完成');
            console.log('=====================');
            return;
        };

        // 关闭"知道了"弹窗（广告结束后可能弹出奖励领取确认）
        let close_btn_zdl = text('知道了').findOne(1000);
        if (close_btn_zdl) { clickElementCenter(close_btn_zdl); };

        // 锚点="激励任务"：查找区间=(激励任务.top, 限时福利.top)，区间内只有激励任务的4个去完成
        // 不用全屏 text('去完成') 作循环条件，否则会命中上方"广告·加点！"的按钮
        let click_flag = swipeTargetElement('去完成', true, '激励任务');
        if (!click_flag) {
            console.log('激励任务区域未找到可执行的去完成按钮，任务已完成');
            console.log('=====================');
            return;
        };

        console.log('=====================');

        // 复用与广告加点完全相同的广告观看逻辑
        let watch_flag = waitJlAdVideo();
        if (watch_flag == 2 || view_video_total > max_video_total) {
            // watch_flag == 2：广告异常（领奖上限 / 验证码 / 未绑定手机 / 返回失败）
            // view_video_total > max_video_total：达到单次观看上限，防止失控
            break;
        };
        console.log('=====================');
    };
};

/**
 * 任务2：广告加点
 *   - 入口判断：需存在"广告·加点！"模块，有时该活动会消失
 *   - 锚点：用"广告·加点！"做锚点，查找区间=(广告加点.top, 激励任务.top)
 *   - 该区间只有 1 个"去完成"，看完 1 个即视为完成
 */
function runAdExtraTask() {
    const ANCHOR = '广告·加点！';   // 区间上界标题
    // 先判断是否有"广告·加点！"，没有就直接跳过（活动可能临时下线）
    if (!text(ANCHOR).findOne(1000)) {
        console.log('未找到广告·加点！模块，跳过该任务');
        return;
    };
    // 子任务定义：按判定优先级从上往下
    //  type：日志标识；btn：按钮文案；run：对应的子任务函数
    var subTasks = [
        { type: '看视频', btn: '去完成', run: function () { return waitJdAdVideo(); } },
        { type: '读小说', btn: '去阅读', run: function () { return waitJdReadBook(); } }
    ];

    // 读小说子任务次数上限：防止"去阅读"未被消耗时无限循环
    const MAX_READ_TIMES = 3;
    let read_times = 0;

    while (true) {
        // 关闭"知道了"弹窗（广告结束后的奖励弹窗）
        let close_btn_zdl = text('知道了').findOne(1000);
        if (close_btn_zdl) { clickElementCenter(close_btn_zdl); };

        // ===== 第一步：探测区块内是哪种按钮（只查找，不点击）=====
        let matched = null;
        for (let i = 0; i < subTasks.length; i++) {
            if (findButtonInSection(subTasks[i].btn, ANCHOR)) {
                matched = subTasks[i];
                break;
            };
        };

        // ===== 两类按钮都没有 → 广告加点任务已全部完成 =====
        if (!matched) {
            console.log(`广告加点区块内既无"去完成"也无"去阅读"，任务已全部完成`);
            console.log('=====================');
            return;
        };

        console.log('=====================');
        console.log(`检测到"${matched.btn}"，执行广告加点-${matched.type}子任务`);

        // 读小说次数保护：超过上限则终止，防止按钮未消耗时死循环
        if (matched.type === '读小说') {
            if (read_times >= MAX_READ_TIMES) {
                console.log(`读小说子任务已达 ${MAX_READ_TIMES} 次上限，终止广告加点任务`);
                console.log('=====================');
                return;
            };
            read_times++;
            console.log(`读小说子任务第：${read_times}/${MAX_READ_TIMES} 次`);
        };

        // ===== 第二步：定位并点击已判定类型的按钮 =====
        let click_flag = swipeTargetElement(matched.btn, true, ANCHOR);
        if (!click_flag) {
            console.log(`未成功点击"${matched.btn}"，广告加点任务终止`);
            console.log('=====================');
            return;
        };

        // ===== 第三步：执行对应子任务 =====
        let watch_flag = matched.run();
        if (watch_flag == 2 || view_video_total > max_video_total) {
            if (watch_flag == 2) {
                console.log(`广告加点-${matched.type}子任务异常终止`);
            } else {
                console.log('已达视频数量上限，广告加点任务结束');
            };
            console.log('=====================');
            return;
        };

        console.log('=====================');
        // 回到 while 顶部，重新探测区块内剩余按钮
    };
};

/**
 * 在指定任务区块内【探测】按钮是否存在（只查找，不点击）
 */
function findButtonInSection(text_name, anchor_name) {
    let title_b = getFollowingTitle(anchor_name);

    // 先把区块滚进安全带，确保按钮已渲染
    ensureTitlesInSafeZone(anchor_name, title_b);

    let a = text(anchor_name).findOnce();
    if (!a) { return null; };

    // 下界 = 锚点 top；上界 = 下个标题 top
    let lower = a.bounds().top;
    let b = title_b ? text(title_b).findOnce() : null;
    let upper = b ? b.bounds().top : screen_height;

    let hit = boundsInside(0, lower, screen_width, upper).text(text_name).findOnce();
    if (hit) {
        let hb = hit.bounds();
        console.log(`区块[${anchor_name} ~ ${title_b}]内检测到"${text_name}"，bounds=(${hb.left},${hb.top},${hb.right},${hb.bottom})`);
    };
    return hit;
};


/**
 * 等待观看广告并尝试返回任务页-激励任务
 * @param {number} [depth=0] 自调用递归深度（内部使用，超过 max_ad_retry_depth 强制返回 2）
 * @returns {number} 1=正常完成；2=异常终止（未绑定手机 / 领奖上限 / 验证码 / 无法返回）
 *
 * 流程：关广告 -> 点"继续观看" -> 等待 ad_time 秒 -> 返回退出广告页 -> 检测异常 -> 尝试回到任务页
 * 返回任务页的逻辑：优先 home()+重开+back()（阻断系统跳转拦截）；
 *   若在福利页则等待后点进福利中心；若仍在广告页则继续看或自调用重试
 */
function waitJlAdVideo(depth) {
    // 递归深度保护：避免页面卡死时无限自调用导致栈溢出
    depth = depth || 0;
    if (depth > max_ad_retry_depth) {
        console.log(`广告流程自调用超过：${max_ad_retry_depth} 层，判定为异常并退出本轮`);
        return 2;
    };

    let watch_flag = 1;   // 1=正常，2=异常
    let error_total = 0;  // 返回任务页的失败重试计数

    console.log('开始看广告');

    // 未绑定手机号时无法领取奖励，直接终止
    if (text('手机号绑定').findOne(500)) {
        console.log('请先绑定手机号,再执行任务');
        return 2;
    };

    // 优化广告观看逻辑：等待页面稳定 -> 先关闭广告 -> 再处理跳转广告
    sleep(1000);
    clickElementClose();   // 关闭广告（右上角 ViewGroup 或内置广告左上角 ImageView）
    sleep(1000);
    continueWatchAd();     // 点击"继续观看"类按钮（跳过前几个广告）

    console.log(`等待广告：${ad_time} 秒`);
    sleep(ad_time * 1000);

    // 返回退出广告页
    closeWatchAd();

    // 检测到领奖上限，终止任务
    if (textContains('领奖上限').findOne(500)) {
        console.log('当前设备已超过领奖上限,退出');
        watch_flag = 2;
    };

    // 出现拼图验证码，说明被风控，终止任务
    if (textEndsWith('完成拼图').findOne(500)) {
        console.log('出现验证码,请过段时间再执行');
        watch_flag = 2;
    };

    // 循环尝试回到"激励任务"页面，最多尝试 5 次
    // 退出条件：找到"激励任务"（成功返回）/ error_total >= 5（放弃）
    while (!text('激励任务').findOne(3000) && error_total < 5) {
        let stop_time = parseInt(random(2, 3));  // 随机 2~3 秒
        let flzx = text('福利中心').findOne(1000);

        if (flzx) {
            // 在福利页但不在任务页：等待后点进福利中心
            console.log(`检测到未在任务页，等待：${stop_time}s后尝试进入任务`);
            sleep(stop_time * 1000);
            clickElementCenter(flzx, true);
        } else {
            // 还在广告页：尝试点继续观看
            let continue_ad_btn = continueWatchAd();
            if (continue_ad_btn) {
                // 继续观看成功，再等一轮广告
                console.log(`广告未完成，等待广告：${ad_time}s`);
                sleep(ad_time * 1000);
                closeWatchAd();
            } else {
                // 无法继续，自调用重试（带深度保护，超过上限返回 2 终止）
                console.log('广告未完成，等待重新观看');
                waitJlAdVideo(depth + 1);
            };
        };
        error_total++;
    };

    // 统计 + 重置（loop_stop_total 当前未参与退出判断，仅作预留计数）
    view_video_total++;
    loop_stop_total = 0;
    console.log(`结束看广告，已看视频：${view_video_total}个`);
    return watch_flag;
};

/**
 * 等待观看广告并尝试返回任务页-加点任务视频
 * @param {number} [depth=0] 自调用递归深度（内部使用，超过 max_ad_retry_depth 强制返回 2）
 * @returns {number} 1=正常完成；2=异常终止（未绑定手机 / 领奖上限 / 验证码 / 无法返回）
 *
 * 流程：关广告 -> 点"继续观看" -> 等待 ad_time 秒
 * 返回任务页的逻辑：优先 home()+重开+back()（阻断系统跳转拦截）；
 */
function waitJdAdVideo(depth) {
    // 递归深度保护：避免页面卡死时无限自调用导致栈溢出
    depth = depth || 0;
    if (depth > max_ad_retry_depth) {
        console.log(`广告流程自调用超过：${max_ad_retry_depth} 层，判定为异常并退出本轮`);
        return 2;
    };

    let watch_flag = 1;   // 1=正常，2=异常
    // 未绑定手机号时无法领取奖励，直接终止
    if (text('手机号绑定').findOne(500)) {
        console.log('请先绑定手机号,再执行任务');
        return 2;
    };
    console.log(`等待广告：${ad_time}s`)
    sleep(ad_time * 1000)
    // 关闭右上角重新进入阅读
    clickElementClose();
    sleep(1000);
    close_ad = className('android.view.ViewGroup').depth(11).drawingOrder(7).indexInParent(6).findOne(1000);
    if (close_ad){
        clickElementCenter(close_ad);
        sleep(1000);
    };
    // 返回退出广告页
    closeWatchAd();
    // ===== 结束后统一异常检测（兜底，正常流程上面已检测过）=====
    if (textContains('领奖上限').findOne(500)) {
        console.log('当前设备已超过领奖上限,退出');
        watch_flag = 2;
    };
    if (textEndsWith('完成拼图').findOne(500)) {
        console.log('出现验证码,请过段时间再执行');
        watch_flag = 2;
    };
    return watch_flag;
};
/**
 * 等待观看广告并尝试返回任务页-加点任务阅读
 * @param {number} [depth=0] 自调用递归深度（内部使用，超过 max_ad_retry_depth 强制返回 2）
 * @returns {number} 1=正常完成；2=异常终止（未绑定手机 / 领奖上限 / 验证码 / 无法返回）
 *
 * 流程：关广告 -> 点"继续观看" -> 等待 ad_time 秒
 * 返回任务页的逻辑：优先 home()+重开+back()（阻断系统跳转拦截）；
 */
function waitJdReadBook(depth) {
    depth = depth || 0;

    const READ_TIME = 60;   // 阅读页停留时长（秒）

    console.log('【广告加点-读小说】开始执行');
    // 保持亮屏
    device.keepScreenOn(60 * 1000 * 5);

    // ===== 第1步:搜索并点击获取到的第一本小说 =====
    let search_btn = id('ivSearch').findOne(2000);
    if (!search_btn){
        console.log('未找到搜索接口异常终止');
        return 2;
    };
    clickElementCenter(search_btn);
    sleep(1000);
    let book = id('tvBookName').findOne(1000);
    if (!book) {
        console.log('未找到小说异常终止');
        return 2;
    };
    clickElementCenter(book,true);
    sleep(1000);
    let read_book = text('立即阅读').findOne(1000);
    if (!read_book){
        console.log('未找到立即阅读按钮异常终止');
        return 2;
    };
    clickElementCenter(read_book);
    sleep(1000);
    // ===== 第2步：阅读页停留 =====
    console.log(`进入阅读数据，停留阅读 ${READ_TIME} 秒`);
    sleep(READ_TIME * 1000);
    console.log('阅读结束，回到首页');
    // 解除亮屏
    device.cancelKeepingAwake();
    // ===== 第4步：退3次=====
    let back_count = 0;
    while(back_count < 5){
        back()
        if (text('取消').findOne(1000)){
            clickElementCenter(text('取消').findOne(1000));
        };
        if (text('书架').findOne(1000)){
            break
        };
        back_count ++;
    };
    // ===== 第5步：导航回福利中心 =====
    if (!gotoWelfareCenter()) {
        console.log('返回福利中心失败，读小说任务异常终止');
        return 2;
    };

    console.log('读小说任务完成，已回到福利中心');
    return 1;
};
/**
 * 进入福利中心也没面
 * */ 
function gotoWelfareCenter() {
    console.log('开始进入福利中心');
    // 已经在福利中心页面则直接返回成功
    if (text('激励任务').findOne(1000)) {
        console.log('已在福利中心页面');
        return true;
    };
    for (let i = 0; i < 3; i++) {
        let me_btn = text('我').findOne(1000);
        if (me_btn) { clickElementLoop(me_btn, true); sleep(1500); };

        let flzx = text('福利中心').findOne(2000);
        if (flzx) { clickElementCenter(flzx, true); sleep(2000); };

        if (text('激励任务').findOne(2000)) {
            console.log('已进入到福利中心');
            return true;
        };
        console.log(`第：${i + 1}次返回福利中心未成功，重试`);
        sleep(1000);
    };

    console.log('返回福利中心失败');
    return false;
};
/**
 * 点击"继续观看"类按钮，跳过视频前面的引导/前几个广告
 * 说明：按钮列表按优先级从上往下，命中任意一个有效节点即点击并返回 true
 *      后续增删按钮只需改动 buttons 数组，无需修改循环逻辑
 * @param {number} [timeout=1000] 单个按钮的查找超时（毫秒）
 * @returns {boolean} 是否成功点击了继续按钮
 *
 * buttons 数组每项是一个函数，返回 findOne 的结果；用函数包裹可避免未轮到时提前执行查找。
 * 这些选择器是基于实际布局的深度优先（DFS）匹配，按数组顺序从上往下尝试。
 */
function continueWatchAd(timeout) {
    timeout = timeout || 1000;

    // 去浏览 / 继续观看按钮的查找区域（按屏幕比例，适配不同分辨率）
    // 实测按钮位于屏幕中下部：top 54%、bottom 59.4%、水平居中
    var AD_BTN_ZONE = {
        x1: screen_width * 0.10,   // 左边界：10%（按钮 left 20.5%）
        y1: screen_height * 0.40,  // 上边界：40%（按钮 top 54%）
        x2: screen_width * 0.90,   // 右边界：90%（按钮 right 79.5%）
        y2: screen_height * 0.85   // 下边界：85%（按钮 bottom 59.4%）
    };

    // 最小宽度：必须占屏幕宽度的 50% 以上
    // 实测：去浏览按钮 708px(59%) 通过；异常按钮 360px(30%) 被过滤
    var AD_BTN_MIN_WIDTH_RATIO = 0.5;
    var MIN_WIDTH = screen_width * AD_BTN_MIN_WIDTH_RATIO;

    // 继续观看广告按钮列表：按优先级从上往下，可自由增删调序
    // 每项都统一加了 boundsInside 区域限定，只在该范围内搜索
    var buttons = [
        // 去浏览按钮1（蓝色的按钮上会显示"%的人已领取"）
        function () {
            return className('android.view.ViewGroup').depth(11).drawingOrder(5).indexInParent(4)
                .boundsInside(AD_BTN_ZONE.x1, AD_BTN_ZONE.y1, AD_BTN_ZONE.x2, AD_BTN_ZONE.y2)
                .findOne(timeout);
        },
        // 去浏览按钮2
        function () {
            return className('android.view.ViewGroup').depth(11).drawingOrder(3).indexInParent(3)
                .boundsInside(AD_BTN_ZONE.x1, AD_BTN_ZONE.y1, AD_BTN_ZONE.x2, AD_BTN_ZONE.y2)
                .findOne(timeout);
        },
        // 去浏览按钮3（红色的继续观看）
        function () {
            return className('android.view.ViewGroup').depth(11).drawingOrder(6).indexInParent(5)
                .boundsInside(AD_BTN_ZONE.x1, AD_BTN_ZONE.y1, AD_BTN_ZONE.x2, AD_BTN_ZONE.y2)
                .findOne(timeout);
        },
        // 新增按钮示例（按需取消注释或修改条件，记得同样加上 boundsInside）：
        // function () { return text('继续观看').boundsInside(AD_BTN_ZONE.x1, AD_BTN_ZONE.y1, AD_BTN_ZONE.x2, AD_BTN_ZONE.y2).findOne(timeout); },
    ];

    for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i]();
        if (!btn) { continue; };  // 未找到，尝试下一个按钮
        var b = btn.bounds();
        // 过滤宽高为 0 的无效/离屏节点，避免点了没反应还误判成功
        if (!b || b.width() <= 0 || b.height() <= 0) { continue; };
        // 宽度过滤：同结构元素中，只有占屏 50% 以上的才是目标按钮
        // 异常元素宽度仅 360px(30%)，会被这里挡掉
        if (b.width() < MIN_WIDTH) {continue;};

        console.log(`命中第：${i + 1}个继续按钮，位置(${b.centerX()},${b.centerY()})，执行点击`);
        clickElementCenter(btn);
        return true;
    };

    console.log('未匹配到任何继续按钮');
    return false;
};


/**
 * 判断视频任务是否已完成（仅用于激励任务）
 * 原理：在"激励任务"控件的父容器范围内统计"已领取"的数量
 * @param {number} task_num 判定完成所需的"已领取"数量阈值（激励任务传 4）
 * @returns {boolean} 已领取数量是否达到阈值
 *
 * @notice 风险提示：text('激励任务').parent() 通常只是标题的直接父布局，范围很小，
 *         在其范围内统计"已领取"可能恒为 0，导致任务完成检测失效。
 *         若遇到该现象，可把统计范围改为整屏：
 *             let count = text('已领取').find().length;
 *             return count >= task_num;
 */
/**
 * 页面级向下滚动：露出列表【下方】内容
 * 手指由下往上划（y1 > y2）→ 内容上移
 */
function scrollPageDown() {
    let dist = 250;
    let y1 = screen_height * 0.8;
    swipe(screen_width / 2, y1, screen_width / 2, y1 - dist, random(400, 800));
    sleep(700);
};

/**
 * 页面级向上滚动：露出列表【上方】内容
 * 手指由上往下划（y1 < y2）→ 内容下移
 */
function scrollPageUp() {
    let dist = 250;
    let y1 = screen_height * 0.25;
    swipe(screen_width / 2, y1, screen_width / 2, y1 + dist, random(400, 800));
    sleep(700);
};

/**
 * 滚动直到【两个边界标题】都落入屏幕安全带内（全局通用）
 *
 * 安全带定义：
 *   top    >= MARGIN_TOP(200)
 *   bottom <= screen_height - MARGIN_BOTTOM(200)
 *   即标题既不能贴屏幕顶（滚过头），也不能贴屏幕底（下方按钮未渲染）
 *
 * 为什么必须先滚进安全带再做统计/查找：
 *   刚进入页面时"激励任务"标题常贴在屏幕最底部（实测 top=2622，屏幕高 2670），
 *   其下方的"去完成/已领取"并未渲染，而"限时福利"更在屏幕外。
 *   此时区间 =(2622, 2670) 只有 48px，统计口径失真，
 *   会把其他任务区块的"已领取"一并算进来（实测多统计到 6 个）。
 *   把两个标题都滚进安全带后，整个区块完整在屏内，统计与查找才准确。
 *
 * @param {string} title_a 区间上界标题（如"激励任务" / "广告·加点！"）
 * @param {string} [title_b] 区间下界标题（如"限时福利" / "激励任务"），可为 null
 * @returns {boolean} 是否成功把两个标题滚进安全带（失败时返回上界是否可见）
 */
function ensureTitlesInSafeZone(title_a, title_b) {
    if (!title_a) { return false; };

    const MARGIN_TOP = 200;                               // 顶部余量
    const MARGIN_BOTTOM = 200;                           // 底部余量
    const line_top = MARGIN_TOP;                         // 200
    const line_bottom = screen_height - MARGIN_BOTTOM;   // 2470

    /** 标题是否落在安全带内；title 为 null 表示无此边界，视为到位 */
    function titleReady(title) {
        if (!title) { return { none: true }; };
        let t = text(title).findOnce();
        if (!t) { return null; };
        let b = t.bounds();
        if (b.top >= line_top && b.bottom <= line_bottom) { return t; };
        return null;
    };

    for (let i = 0; i < 30; i++) {
        let a = titleReady(title_a);
        let b = titleReady(title_b);

        // 两个边界都到位 → 区间完整进入安全带
        if (a && b) {
            console.log(`区间[${title_a} ~ ${title_b}]已进入合规范围`);
            return true;
        };

        let raw_a = text(title_a).findOnce();
        let raw_b = title_b ? text(title_b).findOnce() : null;

        // 冲突：区块比安全带还高，无法同时容纳两个边界 → 降级只保证上界可见
        if (raw_a && raw_b) {
            let ab = raw_a.bounds();
            let bb = raw_b.bounds();
            if (ab.top < line_top && bb.bottom > line_bottom) {
                console.log('区块高度超过一屏安全带，降级为只保证上界可见');
                return true;
            };
        };

        // ---- 决定滚动方向 ----
        if (raw_a) {
            let ab = raw_a.bounds();
            if (ab.top < line_top) {
                // console.log(title_a + ' top=' + ab.top + ' < ' + line_top + '，向上滚');
                scrollPageUp();
            } else if (ab.bottom > line_bottom) {
                // console.log(title_a + ' bottom=' + ab.bottom + ' > ' + line_bottom + '，向下滚');
                scrollPageDown();
            } else if (!raw_b) {
                // console.log(title_a + '已到位，' + title_b + '未渲染，向下滚');
                scrollPageDown();
            } else {
                let bb2 = raw_b.bounds();
                if (bb2.top < line_top) {
                    // console.log(title_a + '已到位，' + title_b + ' top=' + bb2.top + ' < ' + line_top + '，向上滚');
                    scrollPageUp();
                } else {
                    // console.log(title_a + '已到位，' + title_b + ' bottom=' + bb2.bottom + ' > ' + line_bottom + '，向下滚');
                    scrollPageDown();
                };
            };
        } else if (raw_b) {
            // 上界未渲染但下界在屏内 ⇒ 上界必在下界上方的屏幕外（已滚过）
            // console.log(title_a + '未渲染，' + title_b + ' top=' + raw_b.bounds().top + ' 在屏内，向上滚');
            scrollPageUp();
        } else {
            // 两个都未渲染 ⇒ 内容还在下方（刚进入页面的初始状态）
            // console.log('两个标题均未渲染，向下滚寻找');
            scrollPageDown();
        };
    };

    // 兜底：滚了 30 次仍未达标，打印状态供排查
    let fa = text(title_a).findOnce();
    let fb = title_b ? text(title_b).findOnce() : null;
    console.log(`滚动30次未达标，区间[${title_a} ~ ${title_b}]不可见`);
    return !!fa;
};

/**
 * 判断激励任务是否已完成：统计【激励任务 ~ 限时福利】区间内"已领取"的数量
 * @param {number} task_num 判定完成所需的"已领取"数量阈值（激励任务传 4）
 * @returns {boolean} 已领取数量是否达到阈值
 *
 * 【关键修复】统计前必须先把两个标题滚进安全带：
 *   刚进入页面时"激励任务"贴在屏幕底部、"限时福利"未渲染，
 *   区间算出来只有几十像素，会把其他任务区块的"已领取"一并统计（实测 6 个）。
 *   先调用 ensureTitlesInSafeZone 把区块完整滚进屏幕，统计才准确。
 *
 * 区间口径（与 findTarget 完全一致）：
 *   下界 = 激励任务.top    （用 top 而非 bottom，因为"已领取"与标题水平并排垂直重叠）
 *   上界 = 限时福利.top    （彻底排除下方限时福利的已领取）
 */
function getTaskFlag(task_num) {
    const TITLE_A = '激励任务';
    const TITLE_B = '限时福利';

    // 1. 先把【激励任务 ~ 限时福利】两个标题滚进安全带
    ensureTitlesInSafeZone(TITLE_A, TITLE_B);

    let a = text(TITLE_A).findOnce();
    if (!a) {
        console.log(`未找到：${TITLE_A}控件`);
        return false;
    };

    // 2. 两个标题之间统计"已领取"
    let lower = a.bounds().top;
    let b = text(TITLE_B).findOnce();
    let upper = b ? b.bounds().top : screen_height;

    let jl_elements = boundsInside(0, lower, screen_width, upper).text('已领取').find();
    let count = jl_elements.size();

    console.log(`激励任务已领取数量：${count}`);
    return count >= task_num;
};

/**
 * 点击指定文案的按钮，可限定只在锚点所属任务区间内点击
 * @param {string} text_name 目标按钮文案（如"去完成"）
 * @param {string} [anchor_name] 锚点文案（如"激励任务" / "广告·加点！"）。
 *        传入后查找区间 = (锚点.bottom, 下一个标题.top)，上下界都夹死：
 *        - 传"激励任务"  → 只找激励任务的 4 个去完成
 *        - 传"广告·加点！"→ 只找广告加点的 1 个去完成
 *        锚点不可见（已滚出屏幕）时退化为全屏查找（此时屏上内容必然都在锚点下方，安全）
 * @returns {boolean} 是否成功点击
 *
 * @note 【当前主流程已不再调用本函数】
 *       swipeTargetElement() 找到目标后会直接 clickElementCenter(已定位的控件)，
 *       不再二次查找，以彻底避免"滑动阶段和点击阶段口径不一致"导致的跨任务误点。
 *       本函数保留作为独立工具，若单独使用请务必确认上界逻辑正确（已用 getNextTitleTop 修复）。
 */
function click_to_complete(text_name, anchor_name) {
    // 优先：限定在锚点所属任务区间内查找
    if (anchor_name) {
        let jl_task_btn = text(anchor_name).findOne(1000);
        if (jl_task_btn) {
            let b = jl_task_btn.bounds();
            // 下界 = 锚点标题底部；上界 = 下一个标题顶部（用 getNextTitleTop，与 findTarget 口径一致）
            // 早期版本这里上界写死 screen_height，导致会误点到下方任务的"去完成"，已修复
            let lower_top = b.bottom;
            let upper_bottom = getNextTitleTop(lower_top);

            let jl_element = boundsInside(0, lower_top, screen_width, upper_bottom)
                .text(text_name)
                .findOne(1000);
            if (jl_element) {
                clickElementCenter(jl_element);
                return true;
            };
            // 锚点可见但区间内没有目标：绝不做全屏兜底，
            // 否则会回过头点到"激励任务"上方的"广告·加点！"按钮，或下方其他任务的按钮
            console.log(`${anchor_name}区间内未找到${text_name}`);
            return false;
        };
        // 锚点不可见（已随列表滚出屏幕），此时屏幕上基本都是锚点下方的内容，
        // 全屏查找是安全的，退化为全屏查找
        console.log(`未找到锚点：${anchor_name}，退化为全屏查找：${text_name}`);
    };

    // 全屏兜底（无锚点，或锚点已滚出屏幕）
    let jl_element_full = text(text_name).findOne(1000);
    if (jl_element_full) {
        clickElementCenter(jl_element_full);
        return true;
    };
    return false;
};

/**
 * 查找锚点下方的"下一个标题"，返回其 top 作为查找区间的上界
 * @param {number} anchor_bottom 当前锚点标题的 bottom
 * @returns {number} 下一个标题的 top；找不到则返回 screen_height（降级为到屏幕底部）
 *
 * 只在三大标题里找（激励任务 / 广告·加点！ / 限时福利），
 * 逐个用 text() 精确匹配（注意：text() 是精确匹配，不是正则，不能用 text('.*')）
 * 取 top 严格大于锚点 top 的、最靠近的那一个（用 > 排除锚点自己）
 *
 * @param {number} anchor_top 当前锚点标题的 top
 * @returns {number} 下一个标题的 top；找不到则返回 screen_height（降级为到屏幕底部）
 *
 * 实测坐标（同一屏内）：
 *   广告·加点! (72,726,897,798)  → top=726
 *   激励任务   (72,1131,897,1206) → top=1131
 *   限时任务   (72,2337,1128,2445)→ top=2337
 * 传入 726 → 返回 1131；传入 1131 → 返回 2337
 */
function getNextTitleTop(anchor_top) {
    let titles = ['激励任务', '广告·加点！', '限时福利'];
    let min_top = screen_height;   // 关键：初始必须是一个足够大的值，不能用 anchor_top + 1
    let found = false;

    for (let i = 0; i < titles.length; i++) {
        let list = text(titles[i]).find();
        for (let j = 0; j < list.size(); j++) {
            let t = list.get(j);
            let tb = t.bounds();
            // 严格大于锚点 top：既保证在锚点下方，又排除锚点自己（自己的 top == anchor_top）
            if (tb.top > anchor_top && tb.top < min_top) {
                min_top = tb.top;
                found = true;
            };
        };
    };

    return found ? min_top : screen_height;
};

/**
 * 获取锚点的"下一个任务标题"（用于锚点滚出屏幕时的兜底定位）
 * @param {string} anchor_name 锚点标题
 * @returns {string|null} 下一个任务标题文案，无则返回 null
 */
function getFollowingTitle(anchor_name) {
    let map = {
        '广告·加点！': '激励任务',
        '激励任务': '限时福利'
    };
    return map[anchor_name] || null;
};

/**
 * 滑动定位并点击（核心：先把【任务区间】完整滚进屏幕，再在区间内查找）
 * @param {string} text_name 目标元素文案（如"去完成"）
 * @param {boolean} is_click 找到后是否点击
 * @param {string} [anchor_name] 区间上界标题（如"激励任务" / "广告·加点！"）
 *        不传则退化为全屏查找
 * @returns {boolean} 是否找到；is_click 为 true 时表示是否点击成功
 *
 * 【定位策略】
 *   激励任务 → 先把【激励任务】+【限时福利】两个标题都滚到屏幕内
 *   广告加点 → 先把【广告·加点！】+【激励任务】两个标题都滚到屏幕内
 *   两个边界标题都完整在屏内 ⇒ 它们之间的"去完成"必然已渲染且在屏内，
 *   此时在区间内查找即可精准命中。
 *
 * 【为什么必须这样做】
 *   find()/boundsInside() 只能拿到【当前已渲染】的控件。
 *   实测首次进入页面时"激励任务" top≈2622，屏幕高 2670，
 *   标题压在屏幕最底部几乎不可见，其下的"去完成"压根没渲染，
 *   此时做任何查找都找不到 —— 必须先滚动把整个区间拉进屏幕。
 */
function swipeTargetElement(text_name, is_click, anchor_name) {
    console.hide();
    
    let swipe_count = 0;                         // 已滑动次数
    let miss_count = 0;                          // 连续未命中次数
    const MAX_MISS = 2;                          // 连续未命中达此次数，判定该区间无可点项

    // 区间的两个边界标题
    let title_a = anchor_name;                                     // 上界（区间起点）
    let title_b = anchor_name ? getFollowingTitle(anchor_name) : null;  // 下界（区间终点）

    /**
     * 把区间滚进安全带（复用全局 ensureTitlesInSafeZone）
     * 边界标题都在安全带内 ⇒ 区间内的按钮必然已渲染且在屏内
     * @returns {boolean} 是否成功
     */
    function ensureSectionVisible() {
        if (!title_a) { return true; };
        return ensureTitlesInSafeZone(title_a, title_b);
    };

    /**
     * 在【已滚入屏幕的任务区间】内查找目标
     * @returns {UiObject|null} 找到返回控件，否则返回 null
     */
    function findTarget() {
        if (!title_a) { return text(text_name).findOnce(); };

        let a = text(title_a).findOnce();
        if (!a) { return null; };

        // 下界用 top（"去完成"与标题水平并排、垂直重叠，用 bottom 会漏掉）
        let lower = a.bounds().top;
        let upper = screen_height;
        let b = title_b ? text(title_b).findOnce() : null;
        if (b) { upper = b.bounds().top; };
        let hit = boundsInside(0, lower, screen_width, upper).text(text_name).findOnce();
        if (hit) {
            let hb = hit.bounds();
            console.log(`查找区间：(${lower},${upper})，命中：${text_name}，y=(${hb.top},${hb.bottom})`);
        } else {
            console.log(`查找区间：(${lower},${upper})，未找到：${text_name}`);
        };
        return hit;
    };

    // ===== 第一步：把任务区间完整滚进屏幕 =====
    ensureSectionVisible();

    let ele_btn = findTarget();
    let clicked = false;

    while (swipe_count < 30) {
        if (!ele_btn) {
            // 找不到：先重新滚一次区间，仍找不到再逐屏下滑
            ensureSectionVisible();
            ele_btn = findTarget();
            if (!ele_btn) {
                miss_count++;
                if (miss_count >= MAX_MISS) {
                    console.log(`连续${miss_count}次未找到${text_name}，判定该区间无可点项`);
                    break;
                };
                console.log(`区间内未找到，第：${miss_count}次下滑查找`);
                scrollPageDown();
                ele_btn = findTarget();
            };
            swipe_count++;
            continue;
        };

        let b = ele_btn.bounds();
        // 完整可见才点击（防止点到被边缘截断的控件）
        if (b.top >= 0 && b.bottom <= screen_height) {
            if (is_click) {
                clickElementCenter(ele_btn);
                // console.log(`已点击：${text_name}，y=(${b.top},${b.bottom})`);
            };
            clicked = true;
            break;
        };

        // 被截断：按方向微调
        if (b.top < 0) { scrollPageUp(); } else { scrollPageDown(); };
        ele_btn = findTarget();
        swipe_count++;
    };

    if (!clicked) {
        console.log(`未能找到或点击：${text_name}`);
    };

    console.show();
    return clicked;
};/**
 * 获取元素的中心坐标
 * @param {UiObject} element 目标控件
 * @returns {{center_x:number, center_y:number}|null} 中心坐标，元素为空时返回 null
 */
function getCenterXy(element) {
    if (!element) { return null; };
    let bounds = element.bounds();
    return { center_x: bounds.centerX(), center_y: bounds.centerY() };
};

/**
 * 递归点击元素：当前元素不可点击时，逐级向上点击父元素
 * 常用于只有父布局响应点击事件的场景（如 ImageView / TextView 子控件 clickable=false）
 * @param {UiObject} element 目标控件
 * @returns {boolean} 是否点击成功
 * @note 递归深度受控件层级限制（通常不超过 15 层），不会栈溢出；最终抛异常则返回 false
 */
function clickElementLoop(element) {
    try {
        if (!element) { return false; };

        // 尝试点击当前元素
        if (element.click()) { return true; };

        // 当前元素不可点击，获取父元素
        let parent_element = element.parent();

        // 没有父元素，退化为点击中心坐标
        if (!parent_element) {
            clickElementCenter(element);
            return false;
        };

        // 递归点击父元素
        return clickElementLoop(parent_element);
    } catch (e) {
        console.error('点击元素出错:', e);
        return false;
    };
};

/**
 * 点击元素中心坐标
 * @param {UiObject} element 目标控件
 * @param {boolean} [is_hide=false] 是否先隐藏控制台（防止控制台遮挡点击区域）
 * @returns {boolean} 是否执行了点击
 *
 * @note 中心点坐标加了 ±2px 随机偏移，降低被风控识别为脚本的概率
 *       原实现中 center 未加声明会污染全局变量，此处已补 let
 */
function clickElementCenter(element, is_hide) {
    try {
        let center = getCenterXy(element);
        if (!center) { return false; };
        // console.log(`中心点坐标：(${center.center_x},${center.center_y})`)
        // 隐藏点击，防止控制台遮挡点击区域
        if (is_hide) {
            console.hide();
            sleep(1000);
        } else {
            sleep(500);
        };
        let flag = false;
        if (center.center_x > 0 && center.center_y > 0) {
            // click(x, y)：在屏幕坐标 (x, y) 处执行点击
            // random(a, b)：返回 [a, b) 之间的随机数，用于偏移 ±1px 增加隐蔽性
            flag = click(
                random(center.center_x - 1, center.center_x + 1),
                random(center.center_y - 1, center.center_y + 1)
            );
        };
        sleep(500);
        console.show();
        return flag;
    } catch (e) {
        console.error('点击坐标中心出错：', e);
        return false;
    };
};

/**
 * 点击广告关闭按钮
 * 策略：优先点右上角 ViewGroup 类型的关闭按钮，其次点内置广告左上角 ImageView 关闭按钮
 * @note 只要命中任一按钮即置 close_flag = true，未校验 clickElementCenter 的返回值
 *       若发现"点了没反应"，可改为 if (clickElementCenter(...)) close_flag = true;
 */
function clickElementClose() {
    let try_count = 0;
    const max_try = 2;
    let close_flag = false;

    while (try_count < max_try && !close_flag) {
        console.log(`开始第${try_count + 1}次尝试获取关闭按钮`);

        // 右上角关闭按钮：取区域内最后一个 ViewGroup（通常是最靠右上角的那个）
        // className('android.view.ViewGroup')：泛指所有 ViewGroup 子类（包括 LinearLayout 等）
        // boundsInside(x1,y1,x2,y2)：限制只在指定区域内查找（此处为右上角 1/3 屏幕宽 × 上 1/4 屏幕高）
        let close_btn_close = className('android.view.ViewGroup').boundsInside(screen_width * 2 / 3, 0, screen_width, screen_height / 4).find();
        if (close_btn_close && close_btn_close.length > 0) {
            clickElementCenter(close_btn_close[close_btn_close.length - 1]);
            close_flag = true;
            break;
        };

        // 内置广告左上角的关闭按钮
        if (!close_flag) {
            let inside_close_btn = className('android.widget.ImageView')
                .depth(6).drawingOrder(2)   // depth/drawingOrder 用于区分同一层次的控件
                .boundsInside(0, 0, screen_width / 2, screen_height / 3)
                .findOne(1000);
            if (inside_close_btn) {
                close_flag = true;
                clickElementCenter(inside_close_btn);
                break;
            };
        };

        // 已经回到任务页，无需再找关闭按钮
        if (text('激励任务').findOne(1000)) {
            return;
        };

        // 等待页面刷新
        sleep(1000);
        try_count++;
    };

    if (!close_flag) {
        console.log(`尝试${max_try}次后仍未找到关闭按钮`);
    };
};

/**
 * 关闭视频广告并返回任务页
 * 关键设计：先 home() 回桌面，可有效阻断"双应用打开 / 允许跳转"类系统拦截导致的广告跳转
 *   再重新启动起点读书 + back()，回到激励任务页
 */
function closeWatchAd() {
    // 先回到桌面，阻断系统跳转拦截
    home();
    sleep(1000);

    startApp('起点读书');
    sleep(1000);
    // 说明已经退出来了
    if (text('激励任务').findOne(1000)){
        if (text('知道了').findOne(1000)){
            clickElementCenter(close_btn_zdl);
        };
        return;
    } else {
        // 尝试返回键退出广告页
        back();
        let try_count = 0;
        // 最多尝试 2 次：每次先找"知道了"（奖励弹窗），找不到再点关闭按钮
        while (try_count < 2) {
            // 查找"知道了"按钮（广告结束后的奖励弹窗）
            let close_btn_zdl = text('知道了').findOne(1000);
            let jl_btn = text('激励任务').findOne(1000);
            if (close_btn_zdl || jl_btn) {
                if (close_btn_zdl){
                    clickElementCenter(close_btn_zdl);
                };
                return;   // 找到即退出
            } else {
                // 没找到，说明还在视频里，尝试点关闭按钮
                try_count++;
                clickElementClose();
            };
        };
    };

};

/**
 * 检测数字密码键盘是否可见
 * 原理：数字 0~9 全部能在界面上找到，则认为键盘已弹出
 * @returns {boolean} 键盘是否可见
 * @note 要求 0~9 全部命中较为严格，个别 ROM 键盘布局差异可能导致漏检而跳过输码。
 *       若发现密码没输进去，可放宽为"任意 3 个数字命中即认为键盘存在"，或直接省略该检测。
 */
function isPwdKeyboardVisible() {
    for (let i = 0; i < 10; i++) {
        // desc(i) 和 text(i) 都尝试：desc 优先（键盘数字键通常有 content-description），text 兜底
        if (!(desc(i).findOne(500) || text(i).findOne(500))) {
            return false;   // 任一数字不存在，判定键盘未弹出
        };
    };
    return true;   // 0~9 全部存在
};

/**
 * 点击密码键盘上的指定字符
 * @param {string|number} selector 要点击的数字或字符
 */
function clickElementScreenPwd(selector) {
    // 先按 desc 找（键盘数字键的 content-description 通常是数字字符串）
    let element = desc(selector).findOne(500);
    if (element) { element.click(); return; };
    // desc 没找到再按 text 找（兜底）
    element = text(selector).findOne(500);
    if (element) { element.click(); };
};

/**
 * 唤醒并解锁手机（支持数字密码）
 * 流程：唤醒 -> 判断锁屏 -> 上滑进入解锁页 -> 逐个点击密码 -> 回桌面 -> 校验是否解锁
 * @returns {boolean} 是否解锁成功
 */
function unlockScreen() {
    try {
        device.wakeUpIfNeeded();   // 唤醒设备（点亮屏幕）
        sleep(1000);               // 等待屏幕亮起

        // 仅在锁屏状态下才进行密码验证
        if (isActuallyLocked()) {
            // 向上滑动进入解锁页面（手势密码/数字密码的解锁入口）
            // gesture(duration, [x1,y1], [x2,y2])：模拟一次指定轨迹的滑动手势
            gesture(1000, [screen_width / 2, screen_height * 2 / 3], [screen_width / 2, 100]);
            sleep(1000);

            // 配置了密码且键盘已弹出时，逐个输入
            if (unlock_pwd && unlock_pwd.length > 0 && isPwdKeyboardVisible()) {
                let pwd_list = unlock_pwd.split('');   // 密码拆成单个字符数组
                pwd_list.forEach(function(pwd) {
                    clickElementScreenPwd(pwd);
                    sleep(500);
                });
            };
            sleep(1000);
        };

        // 重置回到桌面
        home();
        sleep(1000);

        // 再次校验是否真的解锁成功
        if (isActuallyLocked()) {
            return false;
        } else {
            return true;
        };
    } catch (e) {
        console.log('解锁出现屏幕异常');
        return false;
    };
};

/**
 * 获取屏幕宽度
 * @returns {number} 屏幕宽度像素值
 * @note 原实现用 width > default_width 判断，在低于 1080 宽的设备上会误返回 1080，
 *       导致后续所有按屏幕比例计算的坐标偏移，此处改为 width > 0 判断
 */
function getDeviceWidth() {
    let width = device.width;
    if (width === 0) {
        try {
            // device 取不到时，改用 DisplayMetrics 获取
            width = context.getResources().getDisplayMetrics().widthPixels;
            width = width > 0 ? width : default_width;
        } catch (e) {
            // 获取失败，使用默认宽度
            width = default_width;
        };
    };
    return width;
};

/**
 * 获取屏幕高度
 * @returns {number} 屏幕高度像素值
 * @note 同 getDeviceWidth，修正低分辨率设备上的误判
 */
function getDeviceHeight() {
    let height = device.height;
    if (height === 0) {
        try {
            // device 取不到时，改用 DisplayMetrics 获取
            height = context.getResources().getDisplayMetrics().heightPixels;
            height = height > 0 ? height : default_height;
        } catch (e) {
            // 获取失败，使用默认高度
            height = default_height;
        };
    };
    return height;
};

/**
 * 安全获取系统服务
 * 依次尝试多种获取方式，任一成功即返回；全部失败返回 null
 * @param {string} service_name 系统服务名（如 'keyguard' / 'power'）
 * @returns {Object|null} 系统服务对象，失败返回 null
 * @note 不使用 importClass / importPackage，避免环境不支持时报 "xxx is not defined"。
 *       getSystemService 只需要服务名字符串，返回对象上调用的是实例方法，无需引用类型。
 */
function getSystemServiceSafe(service_name) {
    var svc = null;

    // 方式1：用全局 context + 服务名字符串（最常见，兼容性最好）
    try {
        svc = context.getSystemService(service_name);
        if (svc) { return svc; };
    } catch (e) {};

    // 方式2：用全局 activity 再取一次（部分 ROM 上 context 拿不到服务时可行）
    try {
        if (typeof activity !== 'undefined' && activity) {
            svc = activity.getSystemService(service_name);
            if (svc) { return svc; };
        };
    } catch (e) {};

    // 方式3：通过 android.content.Context 常量取值（不使用 importClass）
    //   服务名 'keyguard' -> Context.KEYGUARD_SERVICE；其他（如 'power'）-> POWER_SERVICE
    try {
        svc = context.getSystemService(android.content.Context[
            service_name === 'keyguard' ? 'KEYGUARD_SERVICE' : 'POWER_SERVICE'
        ]);
        if (svc) { return svc; };
    } catch (e) {};

    return null;
};

/**
 * 安全判断屏幕是否点亮
 * 优先用 device.isScreenOn()，失败再用 PowerManager 兜底
 * @returns {boolean} 屏幕是否点亮（取不到时保守返回 false，即按"需要解锁"处理）
 */
function isScreenOnSafe() {
    // 方式1：device.isScreenOn()（Hamibot 内置，最简单可靠）
    try {
        if (typeof device.isScreenOn === 'function') {
            return device.isScreenOn();
        };
    } catch (e) {};

    // 方式2：PowerManager.isInteractive()
    try {
        var pm = getSystemServiceSafe('power');
        if (pm) { return pm.isInteractive(); };
    } catch (e) {};

    // 取不到任何信息时，保守按"屏幕未亮"处理，避免脚本在锁屏下空跑
    return false;
};

/**
 * 判断系统是否处于锁屏状态（Keyguard）
 * @returns {boolean} 是否锁屏
 * @note 关键点：必须做 null 判断。若直接写 km.isKeyguardLocked()，
 *         当 getSystemService 返回 null 时会抛 "无法调用 null 的方法"，
 *         且该异常发生在脚本最开头，会导致整个脚本启动即崩溃。
 *         取不到 KeyguardManager 时退化为屏幕亮灭判断，保证脚本不中断。
 */
function isDeviceLocked() {
    try {
        var km = getSystemServiceSafe('keyguard');
        if (km) {
            return km.isKeyguardLocked();
        };
    } catch (e) {
        console.error('isKeyguardLocked 调用失败：', e);
    };

    // 兜底：取不到 KeyguardManager，用屏幕亮灭近似替代
    // 屏灭 => 一定需要解锁；屏亮 => 无法确认是否锁屏，按未锁定处理
    console.warn('KeyguardManager 获取失败，锁屏判断退化为屏幕亮灭检测');
    return !isScreenOnSafe();
};

/**
 * 判断屏幕是否处于熄灭状态
 * @returns {boolean} 是否熄屏（屏幕熄灭 = 未点亮）
 */
function isScreenOff() {
    return !isScreenOnSafe();
};

/**
 * 综合判断设备是否需要解锁（锁屏或熄屏均视为需要解锁）
 * @returns {boolean} 是否需要解锁
 * @note 解锁流程中只要任一子条件为真就认为需要解锁：
 *        - 锁屏界面（Keyguard 锁定）需要解锁
 *        - 屏幕熄灭（无论是否锁屏）也需要先点亮
 */
function isActuallyLocked() {
    return isDeviceLocked() || isScreenOff();
};
