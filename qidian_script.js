/***
    脚本名称：qidian_script.js
    功能描述：用于起点读书（qidian）福利中心的激励视频任务自动化
             流程：解锁屏幕 -> 启动起点读书 -> 进入福利中心 -> 循环点击"去完成"
                   -> 观看广告 -> 关闭广告返回 -> 检测任务完成
    作    者：reki
    更新日期：2026-09-01
    优化说明：
              1. 修复隐式全局变量
              2. 修复 getDeviceWidth / getDeviceHeight 在低分辨率设备上的宽高误判
              3. 为 waitAdVideo 的自调用加上递归深度上限，防止栈溢出
              4. 移除全部 importClass / importPackage 与模块级系统服务常量，
                 改在 getSystemServiceSafe() 内按服务名字符串按需获取，规避时序与兼容性问题
              5. 为 isDeviceLocked / isScreenOff 增加 null 保护与多重兜底，
                 避免 "getSystemService 返回 null -> 调用方法崩溃"
              6. 修复"去完成"按钮误命中问题：查找"去完成"时限定在"激励任务"锚点【下方】区域，
                 找不到自动下滑继续找，避免命中页面上方的"广告·加点！"模块按钮
***/

// ==================== 无障碍服务启动 ====================
// 必须在脚本最开头调用，后续所有控件查找都依赖无障碍服务
startAuto();

// ==================== 全局变量与常量 ====================
let view_video_total = 0;      // 统计已观看视频数量，超过阈值自动退出
let loop_stop_total = 0;       // 视频循环停止次数（预留计数，当前未参与退出判断）
let us_execution_count = 0;    // 解锁屏幕执行次数
let main_execution_count = 0;  // 主程序执行次数

const ad_time = 15;                 // 默认等待广告时长（秒）
const max_execution_count = 5;      // 主程序 / 解锁的最大执行次数
const default_width = 1080;         // 默认屏幕宽度（仅当无法获取真实宽度时兜底）
const default_height = 1920;        // 默认屏幕高度（仅当无法获取真实高度时兜底）
const max_video_total = 20;         // 单次运行观看视频总数上限，超过则退出
const max_ad_retry_depth = 3;       // waitAdVideo 自调用的最大递归深度，防止栈溢出

const { unlock_pwd } = hamibot.env; // 屏幕解锁密码（hamibot 配置项，可为空）
// const { select_tasks } = hamibot.env; // 执行任务选择（hamibot 配置项）
// 说明：当前 watchVideos() 固定执行"所有视频任务"，未对 select_tasks 做分流。
//       如需按选项区分"激励视频任务 / 所有视频任务"，可在 watchVideos() 内加分支判断。

const screen_width = getDeviceWidth();    // 屏幕宽度
const screen_height = getDeviceHeight();  // 屏幕高度

// ==================== 控制台初始化 ====================
console.log("=====================");
console.log(`获取屏幕宽度：${screen_width}，高度：${screen_height}`);
// 控制台窗口设为屏幕一半大小，尽量少遮挡内容区域
console.setSize(screen_width / 2, screen_height / 2);
// 控制台放在屏幕上方 1/8 处，避开常用点击区域
console.setPosition(0, screen_height / 8);
console.show();

// ==================== 脚本入口 ====================
main();

/**
 * 主程序入口
 * 流程：解锁屏幕 -> 启动起点读书 -> 关闭启动弹窗 -> 执行福利任务
 * 解锁失败会重试，超过 max_execution_count 次则放弃
 */
function main() {
    // 首次点亮并解锁手机
    let us_flag = unlockScreen();

    // 解锁失败则循环重试，直到成功或超过最大次数
    while (!us_flag) {
        us_execution_count++;
        console.log(`解锁屏幕失败，等待尝试第${us_execution_count}重新解锁`);
        sleep(3000);
        us_flag = unlockScreen();
        if (us_execution_count > max_execution_count) {
            console.log(`解锁屏幕失败次数过多,退出任务`);
            break;
        };
    };

    // 只有解锁成功才继续执行任务
    if (us_flag) {
        let start_status = startApp("起点读书");
        if (start_status) {
            closeStartupWindow();   // 关闭开屏广告与各类启动弹窗
            executeWelfareTask();   // 进入福利中心执行视频任务
        };
    };
}

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
        console.log("已达到最大尝试次数, 停止任务");
    };
}

/**
 * 启动无障碍服务
 * 未锁屏时使用 waitFor 阻塞等待用户开启无障碍；
 * 锁屏时无法弹设置页，仅调用 auto() 申请，后续靠脚本重试
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
}

/**
 * 关闭启动任务前的弹窗（开屏广告、青少年模式、首页弹窗、通知弹窗）
 * 注意：这些弹窗不一定每次都出现，找不到时 clickElementLoop 会静默返回 false
 */
function closeStartupWindow() {
    // 跳过开屏广告（右上角"跳过"按钮）
    clickElementLoop(textContains("跳过").findOne(1000));
    // clickElementLoop(id("button_text_id").findOne(500));

    // 弹窗1：青少年模式提示，点"我知道了"关闭
    if (textContains("青少年模式").findOne(500)) {
        clickElementLoop(text("我知道了").findOne(500));
    };

    // 弹窗2：首页运营弹窗，点右上角 imgClose 关闭
    clickElementLoop(id("imgClose").findOne(500));

    // 通知弹窗：系统通知引导弹窗的关闭按钮
    clickElementLoop(id("systemNotificationBottomDialogClose").findOne(500));
}

/**
 * 执行起点福利任务
 * 流程：进入福利中心 -> 校验激励任务页 -> 保持屏幕常亮 -> 观看视频 -> 关闭常亮
 * 任一步骤未找到目标页面，则调用 retryMain() 重启流程
 */
function executeWelfareTask() {
    console.log("=====================");
    console.log("开始进入福利中心");

    // 如果已经在福利页（有"领福利"），直接点它；否则先切到"我"的 tab
    // 注意：findOne(50) 超时极短，是刻意设计——主页通常没有"领福利"，快速走 else 分支
    if (text("领福利").findOne(50)) {
        clickElementCenter(text("领福利").findOne(500), true);
    } else {
        clickElementLoop(text("我").findOne(500), true);
    };

    let flzx = text("福利中心").findOne(2000);

    // 判断是否在福利中心页面
    if (flzx || text("激励任务").findOne(2000)) {
        if (flzx) { clickElementCenter(flzx, true); }

        // clickElementLoop(textContains("跳过").findOne(1000));

        if (text("激励任务").findOne(2000)) {
            // 保持屏幕常亮 10 分钟，防止做任务过程中息屏
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
}

/**
 * 循环观看视频任务
 * 每轮先在"激励任务"【下方】查找"去完成"按钮，找不到则自动下滑继续找；
 * 滑到列表底部仍未找到，或已领取数达标，或达到视频上限，则退出
 * @notice 不使用全局 text("去完成").findOnce() 作为循环条件，
 *         否则会命中"激励任务"上方"广告·加点！"模块的同名按钮，
 *         导致脚本停在上半屏、始终不下滑去找激励任务的按钮
 */
function watchVideos() {
    // 点击一下左上角起点白泽(Logo)，防止其他弹窗弹出影响看视频
    clickElementCenter(
        className("android.widget.Image")
            .clickable(true)
            .boundsInside(0, 0, screen_width / 2, screen_height / 4)
            .findOne(500),
        true
    );

    // 获取所选任务，判断是否只执行激励任务（预留变量）
    let watch_flag = null;
    console.log("开始执行所有视频任务");

    while (true) {
        // 只要激励任务里面找到 4 个"已领取"就算完成视频任务
        if (getTaskFlag(4)) {
            console.log("视频任务已全部完成");
            console.log("=====================");
            return;
        };

        // 先检测一下"知道了"按钮是否关闭
        let close_btn_zdl = text("知道了").findOne(1000);
        if (close_btn_zdl) {
            clickElementCenter(close_btn_zdl);
        };

        // 在"激励任务"【下方】查找"去完成"，找不到则自动下滑继续找
        // 说明：不直接用全局 text("去完成").findOnce() 作循环条件，
        //       否则会命中页面上方的"广告·加点！"模块按钮，
        //       导致脚本停在上半屏、不去下滑找激励任务的按钮
        let click_flag = swipeTargetElement("去完成", true, "激励任务");
        if (!click_flag) {
            // 滑到底仍未找到，说明激励任务的"去完成"已全部处理完
            console.log("“激励任务”区域未找到可执行的“去完成”按钮，视频任务可能已完成");
            console.log("=====================");
            break;
        };

        console.log("=====================");

        watch_flag = waitAdVideo();

        // 当出现异常(watch_flag == 2)或观看视频数量超过上限时直接退出
        if (watch_flag == 2 || view_video_total > max_video_total) {
            break;
        };

        console.log("=====================");
    };
}

/**
 * 等待观看广告并尝试返回任务页
 * @param {number} [depth=0] 自调用递归深度（内部使用，超过 max_ad_retry_depth 强制返回异常）
 * @returns {number} 1=正常完成；2=异常终止（已绑定手机校验 / 领奖上限 / 验证码 / 无法返回）
 */
function waitAdVideo(depth) {
    // 递归深度保护：避免页面卡死时无限自调用导致栈溢出
    depth = depth || 0;
    if (depth > max_ad_retry_depth) {
        console.log(`广告流程自调用超过 ${max_ad_retry_depth} 层，判定为异常并退出本轮`);
        return 2;
    };

    let watch_flag = 1;   // 1=正常，2=异常
    let error_total = 0;  // 返回任务页的失败重试计数

    console.log("开始看广告");

    // 未绑定手机号时无法领取奖励，直接终止
    if (text("手机号绑定").findOne(500)) {
        console.log("请先绑定手机号,再执行任务");
        return 2;
    };

    // 优化广告观看逻辑：等待页面稳定 -> 先关闭广告 -> 再处理跳转广告
    sleep(1000);
    clickElementClose();   // 关闭广告
    sleep(1000);
    continueWatchAd();     // 点击"继续观看"类按钮

    console.log(`等待广告：${ad_time}秒`);
    sleep(ad_time * 1000);

    // 返回退出广告页
    closeWatchAd();

    // 检测到领奖上限，终止任务
    if (textContains("领奖上限").findOne(500)) {
        console.log("当前设备已超过领奖上限,退出");
        watch_flag = 2;
    };

    // 出现拼图验证码，说明被风控，终止任务
    if (textEndsWith("完成拼图").findOne(500)) {
        console.log("出现验证码,请过段时间再执行");
        watch_flag = 2;
    };

    // 循环尝试回到"激励任务"页面，最多尝试 5 次
    while (!text("激励任务").findOne(3000) && error_total < 5) {
        let stop_time = parseInt(random(2, 3));
        let flzx = text("福利中心").findOne(1000);

        if (flzx) {
            // 在福利页但不在任务页：等待后点进福利中心
            console.log(`检测到未在任务页，等待${stop_time}s后尝试进入任务`);
            sleep(stop_time * 1000);
            clickElementCenter(flzx, true);
        } else {
            // 还在广告页：尝试点继续观看
            let continue_ad_btn = continueWatchAd();
            if (continue_ad_btn) {
                console.log(`广告未完成，等待广告：${ad_time}秒`);
                sleep(ad_time * 1000);
                closeWatchAd();
            } else {
                console.log(`广告未完成，等待重新观看`);
                // 自调用重试（带深度保护，超过上限会返回 2 终止）
                waitAdVideo(depth + 1);
            };
        };
        error_total++;
    };

    view_video_total++;
    loop_stop_total = 0;   // 重置循环停止计数（预留，当前未参与退出判断）
    console.log(`结束看广告，已看视频：${view_video_total}个`);
    return watch_flag;
}

/**
 * 判断广告是否观看完，未完成的则点击"继续观看"类按钮
 * 说明：按钮列表按优先级从上往下，命中任意一个有效节点即点击并返回 true
 *      后续增删按钮只需改动 buttons 数组，无需修改循环逻辑
 * @param {number} [timeout=1000] 单个按钮的查找超时（毫秒）
 * @returns {boolean} 是否成功点击了继续按钮
 */
function continueWatchAd(timeout) {
    timeout = timeout || 1000;

    // 继续观看广告按钮列表：按优先级从上往下，可自由增删调序
    // 每项为一个函数，返回 findOne 的结果；用函数包裹可避免未轮到时提前执行查找
    var buttons = [
        // 去浏览按钮1（按钮上会显示"%的人已领取"）
        function () { return className("android.view.ViewGroup").depth(11).drawingOrder(5).indexInParent(4).findOne(timeout); },
        // 去浏览按钮2
        function () { return className("android.view.ViewGroup").depth(11).drawingOrder(3).indexInParent(3).findOne(timeout); },
        // 去浏览按钮3
        function () { return className("android.view.ViewGroup").depth(11).drawingOrder(6).findOne(timeout); },
        // 新增按钮示例（按需取消注释或修改条件）：
        // function () { return text("继续观看").findOne(timeout); }
    ];

    for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i]();
        if (!btn) { continue; }  // 未找到，尝试下一个按钮

        var b = btn.bounds();
        // 过滤宽高为 0 的无效/离屏节点，避免点了没反应还误判成功
        if (b && b.width() > 0 && b.height() > 0) {
            console.log(`命中第 ${i} 个继续按钮，执行点击`);
            clickElementCenter(btn);
            return true;
        };
    }

    console.log("未匹配到任何继续按钮");
    return false;
}

/**
 * 判断视频任务是否已完成
 * 原理：在"激励任务"控件的父容器范围内统计"已领取"的数量
 * @param {number} task_num 判定完成所需的"已领取"数量阈值
 * @returns {boolean} 已领取数量是否达到阈值
 * @notice 风险提示：text("激励任务").parent() 通常只是标题的直接父布局，范围很小，
 *         在其范围内统计"已领取"可能恒为 0，导致任务完成检测失效（表现为任务做完了却不退出）。
 *         若遇到该现象，可把统计范围改为整屏：
 *             let count = text("已领取").find().length;
 *             return count >= task_num;
 *         或向上多取几级父容器：jl_task_btn.parent().parent()
 */
function getTaskFlag(task_num) {
    // 先找到任意一个"激励任务"控件
    let jl_task_btn = text("激励任务").findOne(1000);
    if (!jl_task_btn) {
        console.log("未找到任何“激励任务”控件");
        return false;
    }

    // 找到其父级容器（层级可能需要根据实际布局调整 parent() 次数）
    let jl_task_parent = jl_task_btn.parent();
    if (!jl_task_parent) {
        // 父级不存在时，退化为全屏统计
        let count = text("已领取").find().length;
        console.log("“全屏”已领取数量：", count);
        return count >= task_num;
    }

    // 在父容器范围内统计"已领取"
    let b = jl_task_parent.bounds();
    let jl_elements = boundsInside(b.left, b.top, b.right, b.bottom).text("已领取").find();
    console.log(`“已领取”数量：${jl_elements.length}`);
    return jl_elements.length >= task_num;
}

/**
 * 点击指定文案的按钮，可限定只在锚点下方区域内点击
 * @param {string} text_name 目标按钮文案（如"去完成"）
 * @param {string} [anchor_name] 锚点文案（如"激励任务"）。
 *        传入后只在锚点【下方】区域查找并点击，避免误点页面上方的同名按钮
 *        （例如"广告·加点！"模块的"去完成"）
 * @returns {boolean} 是否成功点击
 * @notice 原实现中第二次赋值 jl_element 未加声明，会污染为全局变量，此处已补 let 并改名
 */
function click_to_complete(text_name, anchor_name) {
    // 优先：限定在锚点下方区域查找
    if (anchor_name) {
        let jl_task_btn = text(anchor_name).findOne(1000);
        if (jl_task_btn) {
            let b = jl_task_btn.bounds();
            // 查找区域：x 从 0 到屏幕宽度，y 从锚点【底部】到屏幕底部
            // 注意：用 b.bottom 而非 b.top - 100，确保只搜锚点下方，不误命中上方模块
            let jl_element = boundsInside(0, b.bottom, screen_width, screen_height)
                .text(text_name)
                .findOne(1000);
            if (jl_element) {
                clickElementCenter(jl_element);
                return true;
            }
            // 锚点可见但下方没有目标：绝不做全屏兜底，
            // 否则会回过头点到"激励任务"上方的"广告·加点！"按钮
            console.log(`“${anchor_name}”下方未找到“${text_name}”`);
            return false;
        }
        // 锚点不可见（已随列表滚出屏幕），此时屏幕上基本都是锚点下方的内容，
        // 全屏查找是安全的，退化为全屏查找
        console.log(`未找到锚点“${anchor_name}”，退化为全屏查找“${text_name}”`);
    }

    // 全屏兜底（无锚点，或锚点已滚出屏幕）
    let jl_element_full = text(text_name).findOne(1000);
    if (jl_element_full) {
        clickElementCenter(jl_element_full);
        return true;
    };

    return false;
}

/**
 * 滑动屏幕使目标元素进入屏幕中部区域，并可选点击
 * 滑动前隐藏控制台，避免遮挡点击区域；滑动完成后恢复显示
 *
 * @param {string} text_name 目标元素文案（如"去完成"）
 * @param {boolean} is_click 滑动到位后是否点击该元素
 * @param {string} [anchor_name] 锚点文案（如"激励任务"）。
 *        传入后只在锚点【下方】区域查找目标，且找不到时会自动下滑继续寻找。
 *        用于避免误命中页面上方的同名按钮（例如"广告·加点！"模块的"去完成"）
 * @returns {boolean} 是否找到目标；is_click 为 true 时表示是否成功点击
 */
function swipeTargetElement(text_name, is_click, anchor_name) {
    console.hide();

    let swipe_distance = 300;                        // 每次滑动的距离
    // 锚点模式下需要滚动查找，滑动次数放宽为普通模式的 3 倍
    let max_swipes = anchor_name
        ? Math.ceil(screen_height / swipe_distance) * 3
        : Math.ceil(screen_height / swipe_distance);
    let target_y_min = screen_height / 2 - 300;      // 目标区域上边界
    let target_y_max = screen_height / 2 + 300;      // 目标区域下边界
    let swipe_count = 0;
    let miss_count = 0;                              // 连续未找到目标的次数
    const MAX_MISS = 4;                              // 连续未找到达此次数，判定已到列表底部

    /**
     * 查找目标元素
     * 锚点可见时限定在锚点下方；锚点不可见时退化为全屏查找
     */
    function findTarget(timeout) {
        if (anchor_name) {
            let anchor = text(anchor_name).findOne(timeout);
            if (anchor) {
                let ab = anchor.bounds();
                // 只在锚点下方区域查找，避免命中上方的"广告·加点！"等模块
                return boundsInside(0, ab.bottom, screen_width, screen_height)
                    .text(text_name)
                    .findOne(timeout);
            }
            // 锚点已随列表滚出屏幕，此时屏幕上基本都是锚点下方的内容，全屏查找是安全的
            console.log(`锚点“${anchor_name}”不可见，退化为全屏查找“${text_name}”`);
        }
        return text(text_name).findOne(timeout);
    }

    let ele_btn = findTarget(1000);
    let clicked = false;

    while (swipe_count < max_swipes) {
        if (!ele_btn) {
            // 当前屏幕（锚点下方）没有目标，向下滑动继续寻找
            miss_count++;
            if (miss_count >= MAX_MISS) {
                // 连续多次下滑都找不到，说明激励任务的"去完成"已全部处理完，列表到底了
                console.log(`连续${miss_count}次下滑未找到“${text_name}”，判定已到列表底部`);
                break;
            }
            console.log(`未找到“${text_name}”，第${swipe_count + 1}次下滑查找`);
            // 手指向上划 -> 内容上移 -> 露出列表下方的内容
            let y1 = screen_height * 0.75;
            swipe(screen_width / 2, y1, screen_width / 2, y1 - swipe_distance, random(400, 1000));
            sleep(800);
            ele_btn = findTarget(1000);
            swipe_count++;
            continue;
        }

        miss_count = 0;   // 找到目标，重置连续未命中计数
        let b = ele_btn.bounds();
        let fully_visible = (b.top >= 0 && b.bottom <= screen_height);        // 完整可见
        let in_middle = (b.top >= target_y_min && b.bottom <= target_y_max);  // 位于中部安全区

        if (fully_visible && in_middle) {
            // 位置合适，直接点击
            if (is_click) {
                clicked = click_to_complete(text_name, anchor_name);
            } else {
                clicked = true;
            }
            break;
        }

        // 位置不合适，滑动调整
        let swipe_y1, swipe_y2;
        if (b.top < 0 || (fully_visible && b.top < target_y_min)) {
            // 控件偏上或顶部被截断：内容需要下移 -> 手指从上往下划
            swipe_y1 = screen_height * 0.4;
            swipe_y2 = swipe_y1 + swipe_distance;
        } else {
            // 控件偏下或底部被截断：内容需要上移 -> 手指从下往上划
            swipe_y1 = screen_height * 0.75;
            swipe_y2 = swipe_y1 - swipe_distance;
        }

        console.log(`开始第${swipe_count + 1}次滑动调整`);
        swipe(screen_width / 2, swipe_y1, screen_width / 2, swipe_y2, random(400, 1000));
        sleep(800);

        ele_btn = findTarget(1000);
        swipe_count++;
    };

    // 达到最大滑动次数后仍未进入中部，但只要完整可见就尝试点击，避免漏点
    if (!clicked && is_click && ele_btn) {
        let b = ele_btn.bounds();
        if (b.top >= 0 && b.bottom <= screen_height) {
            console.log(`滑动已达上限，“${text_name}”完整可见，直接点击`);
            clicked = click_to_complete(text_name, anchor_name);
        }
    }

    if (!clicked) {
        console.log(`未能找到或点击“${text_name}”`);
    }

    console.show();
    return clicked;
}

/**
 * 获取元素的中心坐标
 * @param {UiObject} element 目标控件
 * @returns {{center_x:number, center_y:number}|null} 中心坐标，元素为空时返回 null
 */
function getCenterXy(element) {
    if (!element) {
        return null;
    };
    let bounds = element.bounds();
    return { center_x: bounds.centerX(), center_y: bounds.centerY() };
}

/**
 * 获取"激励视频任务"所在的 Y 轴范围（用于限定查找区域）
 * @returns {{y_top:number, y_bottom:number}} Y 轴上下边界
 * @notice 当前脚本主流程未调用此函数，作为定位辅助工具保留
 */
function getJlVideoXy() {
    let js_video = getCenterXy(text("激励视频任务").findOne(3000));
    if (!js_video) {
        // 没找到就全屏搜索
        return { y_top: 0, y_bottom: screen_height };
    } else {
        // 以"激励视频任务"的 Y 坐标为中心，上下各扩展 200px
        return {
            y_top: Math.max(0, js_video.center_y - 200),
            y_bottom: Math.min(screen_height, js_video.center_y + 200)
        };
    };
}

/**
 * 递归点击元素：当前元素不可点击时，逐级向上点击父元素
 * 常用于只有父布局响应点击事件的场景（如 ImageView / TextView）
 * @param {UiObject} element 目标控件
 * @returns {boolean} 是否点击成功
 * @notice 递归深度受控件层级限制（通常不超过 15 层），不会栈溢出
 */
function clickElementLoop(element) {
    try {
        if (!element) { return false; }

        // 尝试点击当前元素
        if (element.click()) { return true; }

        // 当前元素不可点击，获取父元素
        let parent_element = element.parent();

        // 没有父元素，退化为点击中心坐标
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
}

/**
 * 点击元素中心坐标
 * @param {UiObject} element 目标控件
 * @param {boolean} [is_hide=false] 是否先隐藏控制台（防止控制台遮挡点击区域）
 * @returns {boolean} 是否执行了点击
 * @notice 中心点坐标加了 ±2px 随机偏移，降低被风控识别为脚本的概率
 *         原实现中 center 未加声明会污染全局变量，此处已补 let
 */
function clickElementCenter(element, is_hide) {
    try {
        let center = getCenterXy(element);
        if (!center) { return false; };

        // 隐藏点击，防止控制台遮挡点击区域
        if (is_hide) {
            console.hide();
            sleep(1000);
        } else {
            sleep(500);
        };

        let flag = false;
        if (center.center_x > 0 && center.center_y > 0) {
            flag = click(
                random(center.center_x - 2, center.center_x + 2),
                random(center.center_y - 2, center.center_y + 2)
            );
        };

        sleep(500);
        console.show();
        return flag;
    } catch (e) {
        console.error("点击坐标中心出错：", e);
        return false;
    }
}

/**
 * 点击广告关闭按钮
 * 策略：优先点右上角 ViewGroup 类型的关闭按钮，其次点内置广告左上角 ImageView 关闭按钮
 * @notice 只要命中任一按钮即置 close_flag = true，未校验 clickElementCenter 的返回值
 *         若发现"点了没反应"，可改为 if (clickElementCenter(...)) close_flag = true;
 */
function clickElementClose() {
    let try_count = 0;
    const max_try = 2;
    let close_flag = false;
    let btn_type = "";   // 记录命中的按钮位置，当前仅用于调试（已声明，避免隐式全局）

    while (try_count < max_try && !close_flag) {
        console.log(`开始第${try_count + 1}次尝试获取关闭按钮`);

        // 右上角关闭按钮：取区域内最后一个 ViewGroup（通常是最靠右上角的那个）
        let close_btn_close = className("android.view.ViewGroup")
            .boundsInside(screen_width * 2 / 3, 0, screen_width, screen_height / 4)
            .find();
        if (close_btn_close && close_btn_close.length > 0) {
            clickElementCenter(close_btn_close[close_btn_close.length - 1]);
            close_flag = true;
            btn_type = "右上角";
            break;
        };

        // 内置广告左上角的关闭按钮
        if (!close_flag) {
            let inside_close_btn = className("android.widget.ImageView")
                .depth(6)
                .drawingOrder(2)
                .boundsInside(0, 0, screen_width / 2, screen_height / 3)
                .findOne(1000);
            if (inside_close_btn) {
                close_flag = true;
                btn_type = "内置广告左上角";
                clickElementCenter(inside_close_btn);
                break;
            }
        };

        // 已经回到任务页，无需再找关闭按钮
        if (text("激励任务").findOne(1000)) {
            return;
        };

        // 等待页面刷新
        sleep(1000);
        try_count++;
    };

    if (!close_flag) {
        console.log(`尝试${max_try}次后仍未找到关闭按钮`);
    }
    // else {
    //     console.log(`退出按钮位置：${btn_type}`);
    // }
}

/**
 * 关闭视频广告并返回任务页
 * 关键设计：先 home() 回到桌面，可有效阻断"双应用打开 / 允许跳转"类系统拦截导致的广告跳转
 *          再重新启动起点读书 + back()，回到激励任务页
 */
function closeWatchAd() {
    // 先回到桌面，阻断系统跳转拦截
    home();
    sleep(1000);

    startApp("起点读书");
    sleep(1000);

    // 返回键尝试退出广告页
    back();

    let try_count = 0;
    while (try_count < 2) {
        // 查找"知道了"按钮（广告结束后的奖励弹窗）
        let close_btn_zdl = text("知道了").findOne(1000);
        if (close_btn_zdl) {
            clickElementCenter(close_btn_zdl);
            return;   // 找到即退出
        } else {
            // 没找到，说明还在视频里，尝试点关闭按钮
            try_count++;
            clickElementClose();
        };

        // 已回到任务页，退出
        if (text("激励任务").findOne(1000)) {
            return;
        };
    }
}

/**
 * 检测数字密码键盘是否可见
 * 原理：数字 0~9 全部能在界面上找到，则认为键盘已弹出
 * @returns {boolean} 键盘是否可见
 * @notice 要求 0~9 全部命中较为严格，个别 ROM 键盘布局差异可能导致漏检而跳过输码。
 *         若发现密码没输进去，可放宽为"任意 3 个数字命中即认为键盘存在"，或直接省略该检测。
 */
function isPwdKeyboardVisible() {
    for (let i = 0; i < 10; i++) {
        if (!(desc(i).findOne(500) || text(i).findOne(500))) {
            return false;   // 任一数字不存在，判定键盘未弹出
        };
    };
    return true;   // 0~9 全部存在
}

/**
 * 点击密码键盘上的指定字符
 * @param {string|number} selector 要点击的数字或字符
 */
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
}

/**
 * 唤醒并解锁手机（支持数字密码）
 * 流程：唤醒 -> 判断锁屏 -> 上滑进入解锁页 -> 逐个点击密码 -> 回桌面 -> 校验是否解锁
 * @returns {boolean} 是否解锁成功
 */
function unlockScreen() {
    try {
        device.wakeUpIfNeeded();   // 唤醒设备
        sleep(1000);               // 等待屏幕亮起

        // 仅在锁屏状态下才进行密码验证
        if (isActuallyLocked()) {
            // 向上滑动进入解锁页面
            gesture(1000, [screen_width / 2, screen_height * 2 / 3], [screen_width / 2, 100]);
            sleep(1000);

            // 配置了密码且键盘已弹出时，逐个输入
            if (unlock_pwd && unlock_pwd.length > 0 && isPwdKeyboardVisible()) {
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

        if (isActuallyLocked()) {
            return false;
        } else {
            return true;
        };
    } catch (e) {
        console.log("解锁出现屏幕异常");
        return false;
    };
}

/**
 * 获取屏幕宽度
 * @returns {number} 屏幕宽度像素值
 * @notice 原实现用 width > default_width 判断，在低于 1080 宽的设备上会误返回 1080，
 *         导致后续所有按屏幕比例计算的坐标偏移，此处改为 width > 0 判断
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
    }
    return width;
}

/**
 * 获取屏幕高度
 * @returns {number} 屏幕高度像素值
 * @notice 同 getDeviceWidth，修正低分辨率设备上的误判
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
    }
    return height;
}

/**
 * 安全获取系统服务
 * 依次尝试多种获取方式，任一成功即返回；全部失败返回 null
 * @param {string} service_name 系统服务名（如 "keyguard" / "power"）
 * @returns {Object|null} 系统服务对象，失败返回 null
 * @notice 不使用 importClass / importPackage，避免环境不支持时报 "xxx is not defined"。
 *         getSystemService 只需要服务名字符串，返回对象上调用的是实例方法，无需引用类型。
 */
function getSystemServiceSafe(service_name) {
    var svc = null;

    // 方式1：用全局 context + 服务名字符串（最常见，兼容性最好）
    try {
        svc = context.getSystemService(service_name);
        if (svc) { return svc; }
    } catch (e) {}

    // 方式2：用全局 activity 再取一次（部分 ROM 上 context 拿不到服务时可行）
    try {
        if (typeof activity !== "undefined" && activity) {
            svc = activity.getSystemService(service_name);
            if (svc) { return svc; }
        }
    } catch (e) {}

    // 方式3：通过 android.content.Context 常量取值（不使用 importClass）
    try {
        svc = context.getSystemService(android.content.Context[
            service_name === "keyguard" ? "KEYGUARD_SERVICE" : "POWER_SERVICE"
        ]);
        if (svc) { return svc; }
    } catch (e) {}

    return null;
}

/**
 * 安全判断屏幕是否点亮
 * 优先用 device.isScreenOn()，失败再用 PowerManager 兜底
 * @returns {boolean} 屏幕是否点亮（取不到时保守返回 false，即按"需要解锁"处理）
 */
function isScreenOnSafe() {
    // 方式1：device.isScreenOn()（Auto.js / Hamibot 内置，最简单可靠）
    try {
        if (typeof device.isScreenOn === "function") {
            return device.isScreenOn();
        }
    } catch (e) {}

    // 方式2：PowerManager.isInteractive()
    try {
        var pm = getSystemServiceSafe("power");
        if (pm) { return pm.isInteractive(); }
    } catch (e) {}

    // 取不到任何信息时，保守按"屏幕未亮"处理，避免脚本在锁屏下空跑
    return false;
}

/**
 * 判断系统是否处于锁屏状态（Keyguard）
 * @returns {boolean} 是否锁屏
 * @notice 关键点：必须做 null 判断。若直接写 sp.isKeyguardLocked()，
 *         当 getSystemService 返回 null 时会抛 "无法调用 null 的方法"，
 *         且该异常发生在脚本最开头，会导致整个脚本启动即崩溃。
 *         取不到 KeyguardManager 时退化为屏幕亮灭判断，保证脚本不中断。
 */
function isDeviceLocked() {
    try {
        var km = getSystemServiceSafe("keyguard");
        if (km) {
            return km.isKeyguardLocked();
        }
    } catch (e) {
        console.error("isKeyguardLocked 调用失败：", e);
    }

    // 兜底：取不到 KeyguardManager，用屏幕亮灭近似替代
    // 屏灭 => 一定需要解锁；屏亮 => 无法确认是否锁屏，按未锁定处理
    console.warn("KeyguardManager 获取失败，锁屏判断退化为屏幕亮灭检测");
    return !isScreenOnSafe();
}

/**
 * 判断屏幕是否处于熄灭状态
 * @returns {boolean} 是否熄屏
 */
function isScreenOff() {
    return !isScreenOnSafe();
}

/**
 * 综合判断设备是否需要解锁（锁屏或熄屏均视为需要解锁）
 * @returns {boolean} 是否需要解锁
 */
function isActuallyLocked() {
    return isDeviceLocked() || isScreenOff();
}

/*** hamibot 配置
[
  {
    "name": "unlock_pwd",
    "type": "text",
    "label": "锁屏密码",
    "help": "向上滑动解锁,可为空"
  }
]
***/
