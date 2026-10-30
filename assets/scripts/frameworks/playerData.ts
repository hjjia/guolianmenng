import { _decorator, Component } from "cc";
import { constants } from "../shared/constants";
import { constant } from "./constant";
import { StorageManager } from "./storageManager";
import { utils } from "../shared/utils";
import { localConfig } from "./localConfig";
import { SceneManager } from "../ui/loading/sceneManager";
import { clientEvent } from "./clientEvent";
import { gameBrand } from "../shared/gameBrand";

const { ccclass, property } = _decorator;

export interface LevelRunConfig {
    runId: string;
    levelId: number;
    failCount: number;
    assistTier: number;
    levelSeed: number;
    boardSeed: number;
    initialTargetRatio: number;
    refillTargetMin: number;
    friendlyBoard: boolean;
    levelInfo: any;
}

@ccclass("playerData")
export class playerData extends Component {
    public static _instance: playerData;

    public serverTime: number = 0;
    public localTime: number = 0;
    public spareStep: any;
    public curLevelInfo: any;
    public dictTargets: any;
    public score: any;
    public arrStars: any;
    public level: any = 1;
    public dataVersion: any;
    public isFirst: any;
    public balanceOverAdTimes: any;

    public static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new playerData();
        return this._instance;
    }

    private _bag: any = null;
    private _userId: string = '';
    private _playerInfo: any = null;
    private _history: any = null;
    private _settings: any = null;
    private _isNewBee: boolean = false;    //默认非新手
    private _dataVersion: string = '';
    private _preparedLevelRun: LevelRunConfig | null = null;
    private _activeLevelRun: LevelRunConfig | null = null;

    public get bag() {
        return this._bag;
    }

    public get userId() {
        return this._userId;
    }

    public set userId(v: string) {
        this._userId = v;
    }

    public get settings() {
        return this._settings;
    }

    public set settings(v: any) {
        this._settings = v;
    }

    public get playerInfo() {
        return this._playerInfo;
    }

    public get history() {
        return this._history;
    }

    public get isNewBee() {
        return this._isNewBee;
    }

    public set isNewBee(v: boolean) {
        this._isNewBee = v;
    }

    /**
     * 加上用户数据
     */
    public loadGlobalCache() {
        let userId: string = StorageManager.instance.getUserId();
        if (userId) {
            this._userId = userId;
        }
    }

    /**
     * 加载本地存储数据
     */
    public loadFromCache() {
        //读取玩家基础数据
        this._playerInfo = this._loadDataByKey(constant.LOCAL_CACHE.PLAYER);
        this._history = this._loadDataByKey(constant.LOCAL_CACHE.HISTORY);
        this._settings = this._loadDataByKey(constant.LOCAL_CACHE.SETTINGS);
        this._bag = this._loadDataByKey(constant.LOCAL_CACHE.BAG);
    }

    /**
     * 获取本地存储数据
     * @param {string}keyName 
     * @returns 
     */
    private _loadDataByKey(keyName: any) {
        let ret = {};
        let str = StorageManager.instance.getConfigData(keyName);
        if (str) {
            try {
                ret = JSON.parse(str);
            } catch (e) {
                ret = {};
            }
        }

        return ret;
    }

    /**
     * 创建角色数据
     * @param loginData 
     */
    public createPlayerInfo(loginData?: any) {
        this._playerInfo = {
            diamond: 0, //钻石总数
            key: 0, //钥匙数量
            level: 1,  //当前关卡
            createDate: new Date(), //记录创建时间
        };

        this._isNewBee = true; //区分新老玩家

        if (loginData) {
            for (let key in loginData) {
                this._playerInfo[key] = loginData[key];
            }
        }

        this.savePlayerInfoToLocalCache();
    }

    /**
     * 生成随机账户
     * @returns
     */
    public generateRandomAccount() {
        this.userId = `${Date.now()}${utils.getRandomInt(0, 1000)}`;
        StorageManager.instance.setUserId(this._userId);
    }

    /**
     * 存用户数据
     * @param userId 
     */
    public saveAccount(userId: any) {
        this._userId = userId;
        StorageManager.instance.setUserId(userId);
    }

    /**
     * 保存玩家数据
     */
    public savePlayerInfoToLocalCache() {
        StorageManager.instance.setConfigData(constant.LOCAL_CACHE.PLAYER, JSON.stringify(this._playerInfo));
    }

    /**
     * 保存玩家设置相关信息
     */
    public saveSettingsToLocalCache() {
        StorageManager.instance.setConfigData(constant.LOCAL_CACHE.SETTINGS, JSON.stringify(this._settings));
    }

    /**
     * 当数据同步完毕，即被覆盖的情况下，需要将数据写入到本地缓存，以免数据丢失
     */
    public saveAll() {
        StorageManager.instance.setConfigDataWithoutSave(constant.LOCAL_CACHE.PLAYER, JSON.stringify(this._playerInfo));
        StorageManager.instance.setConfigDataWithoutSave(constant.LOCAL_CACHE.HISTORY, JSON.stringify(this._history));
        StorageManager.instance.setConfigDataWithoutSave(constant.LOCAL_CACHE.SETTINGS, JSON.stringify(this._settings));
        StorageManager.instance.setConfigDataWithoutSave(constant.LOCAL_CACHE.BAG, JSON.stringify(this.bag));
        StorageManager.instance.setConfigData(constant.LOCAL_CACHE.DATA_VERSION, this._dataVersion);
    }

    /**
     * 更新用户信息
     * 例如钻石、金币、道具
     * @param {String} key
     * @param {Number} value
     */
    public updatePlayerInfo(key: string, value: any) {
        let isChanged: boolean = false;
        if (this._playerInfo.hasOwnProperty(key)) {
            if (typeof value === 'number') {
                isChanged = true;
                this._playerInfo[key] += value;
                if (this._playerInfo[key] < 0) {
                    this._playerInfo[key] = 0;
                }
                //return;
            } else if (typeof value === 'boolean' || typeof value === 'string') {
                isChanged = true;
                this._playerInfo[key] = value;
            }
        } else {
            this._playerInfo[key] = value;
        }
        if (isChanged) {
            //有修改就保存到localcache
            StorageManager.instance.setConfigData(constant.LOCAL_CACHE.PLAYER, JSON.stringify(this._playerInfo));
        }
    }

    /**
     * 获取玩家杂项值
     * @param {string} key 
     */
    public getSetting(key: string) {
        if (!this._settings) {
            return null;
        }

        if (!this._settings.hasOwnProperty(key)) {
            return null;
        }

        return this._settings[key];
    }

    /**
     * 设置玩家杂项值
     * @param {string} key 
     * @param {*} value 
     */
    public setSetting(key: string, value: any) {
        if (!this._settings) {
            this._settings = {};
        }

        this._settings[key] = value;

        this.saveSettingsToLocalCache();
    }

    /**
     * 清除用户信息
     */
    public clear() {
        this._playerInfo = {};
        this._settings = {};
        this.saveAll();
    }

    /**
     * 与上次登录时间超过一定分钟，就可以再次领取离线奖励。
     * @param checkRewardTime 
     * @returns 
     */
    public isOpenOffLineReward(checkRewardTime: any) {
        let now = Date.now();
        let isOpen = false;
        if (!this.playerInfo.loginDate) {
            this.playerInfo.loginDate = Date.now();
        } else {
            isOpen = now - this.playerInfo.loginDate >= checkRewardTime;
            if (isOpen) {
                this.playerInfo.loginDate = now;
            }
        }

        this.savePlayerInfoToLocalCache();
        return isOpen;
    }

    /**
    * 获取在线奖励信息 
    */
    getOnlineRewardInfo() {
        if (!this.playerInfo.hasOwnProperty('onlineRewardInfo')) {
            this.resetOnlineRewardInfo();
        } else {
            let isNeedRefreshReward = utils.getDeltaDays(this.playerInfo.onlineRewardInfo['loginTime'], Date.now()); //新的一天            
            if (isNeedRefreshReward > 0) {
                this.resetOnlineRewardInfo();
            }
        }
        return this.playerInfo.onlineRewardInfo;
    }

    /**
     * 重置在线奖励信息
     * value:{times: 当前已领取到了第几次奖励, receiveStatus: 领取状态(0不可领取1可领取)}
     * loginTime: 在线开始时间
     * used: 倒计时消耗时间
     */
    resetOnlineRewardInfo() {
        this.playerInfo.onlineRewardInfo = {};
        this.playerInfo.onlineRewardInfo['value'] = { times: 0, receiveStatus: constants.REWARD_STATUS.UNRECEIVABLE };
        this.playerInfo.onlineRewardInfo['loginTime'] = Date.now();
        this.playerInfo.onlineRewardInfo['usedTime'] = 0;
        this.savePlayerInfoToLocalCache();
    }

    /**
    * 刷新商城随机道具的信息
    */
    resetShopPropInfo() {
        this.playerInfo.shopPropInfo = {};

        let dictProp = localConfig.instance.getTable('prop');
        if (!dictProp) {
            return false;
        }
        let arrPropKey = Object.keys(dictProp);
        let arrRandom = arrPropKey.filter(element => {
            return Number(element) !== constants.PROP_ID.INFINITE;
        });

        let randomVal = arrRandom[Math.floor(Math.random() * arrRandom.length)];

        this.playerInfo.shopPropInfo['createDate'] = Date.now();
        this.playerInfo.shopPropInfo['prop'] = randomVal;
        this.playerInfo.shopPropInfo['receiveStatus'] = constants.REWARD_STATUS.UNRECEIVABLE; //可领取或不可领取，用来切换状态
        this.savePlayerInfoToLocalCache();
    }

    /**
    * 更新商城随机道具的状态
    */
    updateShopPropInfo(isReceived: any) {
        if (!this.playerInfo.shopPropInfo) {
            return;
        }

        if (isReceived) {
            this.resetShopPropInfo();
        } else { //时间到设置为可领取
            this.playerInfo.shopPropInfo['receiveStatus'] = constants.REWARD_STATUS.RECEIVABLE;
        }

        this.savePlayerInfoToLocalCache();
    }

    /**
 * 签到：更新签到领取日期，补签状态，如果超过7天则轮回
 */
    updateSignInCurrentDay() {
        if (!this.playerInfo['signInInfo'] || this.isNeedRecycleSignInInfo()) {
            this.createNewSignInInfo();
        } else {
            let offectDays = utils.getDeltaDays(this.playerInfo['signInInfo']['signInDate'], Date.now()); //比较两个时间，为0则今天更新过
            if (offectDays === 0) {
                return;
            }

            //将昨天“补签后”但是没领取奖励重置为“补签”状态
            this.updateSignInFillSignInDays(0, true);

            //更新领取今日签到信息
            this.playerInfo['signInInfo'].currentDay += offectDays;
            //当测试时间差异的时候将当前的时间设置为第一天
            if (this.playerInfo['signInInfo'].currentDay <= 0) {
                this.createNewSignInInfo();
            }
            this.playerInfo['signInInfo'].currentDay > constants.MAX_SIGN_IN_REWARDS_DAY ? constants.MAX_SIGN_IN_REWARDS_DAY : this.playerInfo['signInInfo'].currentDay;
            this.playerInfo['signInInfo'].signInDate = Date.now();
        }
        this.savePlayerInfoToLocalCache();
    }

    /**
    * 签到：是否需要重新开始一个新的签到周期
    */
    isNeedRecycleSignInInfo() {
        if (!this.playerInfo['signInInfo']) {
            this.createNewSignInInfo();
        }
        let isNeedRecycled = false;
        let diffTime = utils.getDeltaDays(this.playerInfo['signInInfo'].createDate, Date.now());
        if (diffTime >= constants.MAX_SIGN_IN_REWARDS_DAY) { //当前日期与创建日期超过七天，1号7号相差6天，第8天进行更新
            isNeedRecycled = true;
        }
        return isNeedRecycled;
    }

    /**
     * 签到：创建新的签到信息
     * signInInfo: {
     *  createDate： 签到创建时间, 
     *  signInDate: 记录当前打开签到界面是第几天，用于更新今日签到日期
     *  currentDay： 当前日期，
     *  receivedDays： 已经领取的日期数组,
     *  afterFillSignInDays： 补签完了之后可领取的日期数组
     * } 
     */
    createNewSignInInfo() {
        if (!this.playerInfo['signInInfo']) {
            this.playerInfo['signInInfo'] = {};
        }
        this.playerInfo['signInInfo'].createDate = Date.now();
        this.playerInfo['signInInfo'].signInDate = Date.now();
        this.playerInfo['signInInfo'].currentDay = 1;
        this.playerInfo['signInInfo'].receivedDays = [];
        this.playerInfo['signInInfo'].afterFillSignInDays = [];

        this.savePlayerInfoToLocalCache();
    }

    /**
     * 签到：更新补签后变为可领取的日期数组
     * @param {number} day 
     * @param {boolean} isClear 是否清空昨天补签完后还未领取的数组
     */
    updateSignInFillSignInDays(day: any, isClear: any) {
        let afterFillSignInDays = this.playerInfo['signInInfo']['afterFillSignInDays'];
        if (!isClear) {
            if (Array.isArray(afterFillSignInDays) && afterFillSignInDays.includes(day)) {
                return;
            }
            //记录领取天数
            afterFillSignInDays.push(Number(day));
        } else {
            afterFillSignInDays.length = 0;
        }
        this.savePlayerInfoToLocalCache();
    }

    /**
     * 签到：返回“当天”还有“全部”的签到奖励领取情况
     * 用来判断“领取按钮显示”，“登陆自动显示签到界面”和“红点提示”
     * @returns {boolean, boolean} isAllReceived是否全部领取， isTodayReceived是否当天已领取
     */
    getSignInReceivedInfo() {
        if (!this.playerInfo['signInInfo']) {
            this.createNewSignInInfo();
        }
        let signInInfo = this.playerInfo['signInInfo'];
        let isAllReceived = false;
        let isTodayReceived = false;
        if (signInInfo.receivedDays.length < signInInfo.currentDay) {
            isAllReceived = false;
        } else {
            isAllReceived = true;
        }

        if (signInInfo.receivedDays.includes(signInInfo.currentDay)) {
            isTodayReceived = true;
        } else {
            isTodayReceived = false;
        }

        return { isAllReceived, isTodayReceived };
    }

    /**
     * 获取当前在线奖励时间间隔
     */
    getCountdownTime() {
        let onlineCurrentTimes = this.playerInfo['onlineRewardInfo'].value.times;
        let arrInterval = constants.ONLINE_REWARD_INTERVAL;
        let maxInterval = arrInterval.length - 1;
        onlineCurrentTimes = onlineCurrentTimes > maxInterval ? maxInterval : onlineCurrentTimes; //限制最大时间间隔
        let curInterval = arrInterval[onlineCurrentTimes];
        return curInterval;
    }

    /**
     * 更新在线奖励次数,状态,时间信息
     * 时间到了和点击领取时候调用
     */
    updateOnlineRewardInfo(isReceive: any) {
        if (!this.playerInfo.onlineRewardInfo) {
            return;
        }

        let onlineRewardValue = this.playerInfo.onlineRewardInfo['value'];

        if (isReceive) { //如果是点击领取则更新新的在线奖励内容
            onlineRewardValue.times += 1;
            onlineRewardValue.receiveStatus = constants.REWARD_STATUS.UNRECEIVABLE;
        } else { //倒计时结束，设置为可领取，并将倒计时消耗置为0
            onlineRewardValue.receiveStatus = constants.REWARD_STATUS.RECEIVABLE;
            this.playerInfo.onlineRewardInfo['usedTime'] = 0;
        }

        this.savePlayerInfoToLocalCache();
    }

    /**
     * 设置已经消耗过的时间
     */
    addUsedTime() {
        if (!this.playerInfo.onlineRewardInfo || SceneManager.instance.isStop) {
            return;
        }

        this.playerInfo.onlineRewardInfo['usedTime'] += 1; //秒
        this.savePlayerInfoToLocalCache();
    }

    /**
     * 签到：转化签到数据格式,新版本数据结构不一样
     */
    convertSignInDataFormat(info: any) {
        let arrValue = info.value.split('#');
        let arrReceivedDays = arrValue[1].split('|');
        arrReceivedDays.splice(arrReceivedDays.length - 1, 1);

        this.playerInfo['signInInfo'].createDate = info.signInDate - (24 * 60 * 60 * 1000) * (Number(arrValue[0] - 1));
        this.playerInfo['signInInfo'].signInDate = info.signInDate;
        this.playerInfo['signInInfo'].currentDay = Number(arrValue[0]);
        this.playerInfo['signInInfo'].receivedDays = arrReceivedDays.map(Number);
        this.playerInfo['signInInfo'].afterFillSignInDays = [];

        delete info.value;
        this.savePlayerInfoToLocalCache();
    }

    /**
     * 完成连接
     * @param {String} cake 
     * @param {Number} finishValue 
     */
    finishLink(cake: any, finishValue: any) {
        this.reduceStep();

        this.finishTarget(cake, finishValue);
    }

    reduceStep() {
        if (this.curLevelInfo.infinite) {
            return;
        }

        this.spareStep--;

        if (this.spareStep < 0) {
            this.spareStep = 0;
        }
    }

    finishTarget(cake: any, finishValue: any) {
        if (this.dictTargets.hasOwnProperty(cake)) {
            this.dictTargets[cake] -= finishValue;
            if (this.dictTargets[cake] < 0) {
                this.dictTargets[cake] = 0;
            }
        }
    }

    /**
     * 检查关卡是否已经完成
     */
    isLevelFinish() {
        let isFinish = true;

        for (let target in this.dictTargets) {
            if (this.dictTargets.hasOwnProperty(target)) {
                if (this.dictTargets[target] > 0) {
                    isFinish = false;
                    break;
                }
            }
        }

        return isFinish;
    }

    /**
     * 是否游戏结束
     */
    isGameOver() {
        return this.spareStep <= 0;
    }

    startNewLevel(runConfig?: LevelRunConfig) {
        let run = runConfig || this._preparedLevelRun;
        if (!run || run.levelId !== Number(this.level)) {
            run = this.prepareLevelRun(Number(this.level));
        }
        this.level = run.levelId;
        this._preparedLevelRun = run;
        this._activeLevelRun = run;
        let levelInfo = run.levelInfo;
        this.score = 0;
        this.spareStep = 0;
        this.curLevelInfo = {};
        this.curLevelInfo.startTime = Date.now();
        this.curLevelInfo.infinite = false;
        this.curLevelInfo.runId = run.runId;
        this.curLevelInfo.failureRecorded = false;
        if (levelInfo) {
            this.spareStep = levelInfo.limit;
        }

        this.dictTargets = {};
        let arrTargets = levelInfo.targets.split('|');
        for (let idx = 0; idx < arrTargets.length; idx++) {
            let arrTargetObj = arrTargets[idx].split('-');

            this.dictTargets[arrTargetObj[0]] = Number(arrTargetObj[1]);
        }

        this.arrStars = levelInfo.stars.split('|');
        console.log('[LevelRun] start', run.runId, 'targets=' + levelInfo.targets, 'cakes=' + levelInfo.cakes);
    }

    // CSV中定义的最大关卡ID
    static CSV_MAX_LEVEL = 50;

    // 当前主题参与随机关卡的棋子种类（与 icons/cakes 目录对应）。
    static ALL_CAKES = Array.from({ length: gameBrand.pieceCount }, (_, index) =>
        `cake${String(index + 1).padStart(2, '0')}`);

    // 动态生成关卡的缓存（key: levelId，value: 生成的关卡数据）
    // 避免每次调用getCurrentLevelInfo都重新生成导致targets和cakes不一致
    private _generatedLevelCache: { [key: number]: any } = {};

    getCurrentLevelInfo() {
        return this.getLevelInfoById(this.level);
    }

    getActiveLevelInfo() {
        if (this._activeLevelRun && this._activeLevelRun.levelId === Number(this.level)) {
            return this._activeLevelRun.levelInfo;
        }
        return this.getCurrentLevelInfo();
    }

    getActiveLevelRun() {
        return this._activeLevelRun;
    }

    /**
     * 根据 levelId 获取关卡信息（CSV 或动态生成 + 缓存）
     * 所有外部需要获取动态关卡数据的地方都必须走这个方法，保证一致性
     */
    getLevelInfoById(levelId: any) {
        let level = localConfig.instance.queryByID('level', levelId);

        if (level) {
            return Object.assign({}, level, { level: Number(levelId) });
        }

        // 超过CSV定义的关卡，动态生成（同一关卡只生成一次，缓存复用）
        let numId = Number(levelId);
        if (!this._generatedLevelCache[numId]) {
            this._generatedLevelCache[numId] = this.generateLevelInfo(numId);
        }
        return Object.assign({}, this._generatedLevelCache[numId], { level: numId });
    }

    /** 清除动态关卡缓存；主题热切换或调试关卡生成参数时使用。 */
    clearGeneratedLevelCache(levelId?: number) {
        if (levelId !== undefined) {
            delete this._generatedLevelCache[levelId];
        } else {
            this._generatedLevelCache = {};
        }
    }

    /**
     * 动态生成超过CSV范围的关卡参数。
     * 水果种类保持7~8种，长期难度缓慢上升，并在每10关内形成有回落点的节奏波形。
     */
    generateLevelInfo(levelId: number) {
        let n = Math.max(1, levelId - playerData.CSV_MAX_LEVEL);
        let chapter = Math.floor((n - 1) / 10);
        let phase = (n - 1) % 10;
        // 每10关形成一组：前段舒缓、中段上升、第6关回落、最后一关形成小高峰。
        let phaseScale = [0.84, 0.89, 0.94, 0.99, 1.04, 0.91, 0.99, 1.06, 1.13, 1.19][phase];
        let longTermScale = 1 + Math.min(0.16, chapter * 0.012);
        let difficultyScale = phaseScale * longTermScale;
        let cakeCount = chapter >= 2 ? 8 : 7;
        let levelSeed = this.hashString(gameBrand.id + ':level:' + levelId);
        let random = this.createSeededRandom(levelSeed);
        let shuffled = playerData.ALL_CAKES.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            let j = Math.floor(random() * (i + 1));
            let tmp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = tmp;
        }
        let cakes = shuffled.slice(0, cakeCount).join('|');

        let targetCakes = shuffled.slice(0, 3);
        let targets = targetCakes.map((cake: string) => {
            let baseTarget = 18 + Math.min(5, Math.floor(chapter / 3));
            let count = Math.max(15, Math.min(30, Math.round((baseTarget + random() * 2) * difficultyScale)));
            return cake + '-' + count;
        }).join('|');

        let limit = Math.max(18, Math.min(24, Math.round(22 - (difficultyScale - 1) * 6)));

        // 星级分数线：随关卡递增（基础值随关卡增大）
        let baseStar = 5400 + n * 100;
        let stars = baseStar + '|' + (baseStar * 2) + '|' + (baseStar * 3);

        let golds = '75|75|150';

        return {
            ID: String(levelId),
            name: String(levelId),
            cakes: cakes,
            targets: targets,
            limit: limit,
            stars: stars,
            golds: golds,
            levelSeed: levelSeed,
            difficultyScale: difficultyScale
        };
    }

    /**
     * 为关卡弹窗和实际战斗生成同一份本局快照。
     * 连续失败2/3/4/5次时依次开启：友好开局、目标占比+5%、补充保底+1、步数+2。
     */
    prepareLevelRun(levelId: number, force: boolean = false) {
        let failCount = this.getLevelFailureCount(levelId);
        if (!force && this._preparedLevelRun &&
            this._preparedLevelRun.levelId === levelId &&
            this._preparedLevelRun.failCount === failCount) {
            return this._preparedLevelRun;
        }

        let baseInfo = this.getLevelInfoById(levelId);
        let assistTier = failCount >= 5 ? 4 : failCount >= 4 ? 3 : failCount >= 3 ? 2 : failCount >= 2 ? 1 : 0;
        let difficulty = this.getLevelDifficultyDefaults(levelId, baseInfo.difficultyScale);
        let levelSeed = baseInfo.levelSeed || this.hashString(gameBrand.id + ':level:' + levelId);
        let boardSeed = this.hashString(gameBrand.id + ':board:' + levelId + ':failure:' + failCount);
        let levelInfo = Object.assign({}, baseInfo, {
            limit: Number(baseInfo.limit) + difficulty.extraSteps + (assistTier >= 4 ? 2 : 0)
        });
        let run: LevelRunConfig = {
            runId: levelId + '-' + failCount + '-' + boardSeed,
            levelId: levelId,
            failCount: failCount,
            assistTier: assistTier,
            levelSeed: levelSeed,
            boardSeed: boardSeed,
            initialTargetRatio: Math.min(0.65, difficulty.initialTargetRatio + (assistTier >= 2 ? 0.05 : 0)),
            refillTargetMin: difficulty.refillTargetMin + (assistTier >= 3 ? 1 : 0),
            friendlyBoard: assistTier >= 1,
            levelInfo: levelInfo
        };
        this.validateLevelRun(run);
        this._preparedLevelRun = run;
        console.log('[LevelRun] prepare', run.runId, 'assist=' + assistTier, 'limit=' + levelInfo.limit);
        return run;
    }

    recordCurrentLevelFailure() {
        if (!this._activeLevelRun || (this.curLevelInfo && this.curLevelInfo.failureRecorded)) {
            return this.getLevelFailureCount(Number(this.level));
        }
        let state = this.ensureDifficultyState();
        let key = String(this._activeLevelRun.levelId);
        let previous = state.failures[key];
        state.failures[key] = {
            count: Math.min(99, (previous && Number(previous.count) || 0) + 1),
            lastFailedAt: Date.now()
        };
        this.curLevelInfo.failureRecorded = true;
        this._preparedLevelRun = null;
        this.pruneFailureRecords(state.failures);
        this.savePlayerInfoToLocalCache();
        return state.failures[key].count;
    }

    clearLevelFailures(levelId: number) {
        let state = this.ensureDifficultyState();
        let key = String(levelId);
        if (state.failures.hasOwnProperty(key)) {
            delete state.failures[key];
            this.savePlayerInfoToLocalCache();
        }
        this._preparedLevelRun = null;
    }

    getLevelFailureCount(levelId: number) {
        let state = this.ensureDifficultyState();
        let record = state.failures[String(levelId)];
        return record ? Math.max(0, Number(record.count) || 0) : 0;
    }

    private getLevelDifficultyDefaults(levelId: number, difficultyScale?: number) {
        if (levelId <= 10) {
            return { initialTargetRatio: 0.55, refillTargetMin: 7, extraSteps: 2 };
        }
        if (levelId <= 20) {
            return { initialTargetRatio: 0.50, refillTargetMin: 6, extraSteps: 1 };
        }
        if (levelId <= 35) {
            return { initialTargetRatio: 0.45, refillTargetMin: 5, extraSteps: 0 };
        }
        if (levelId <= playerData.CSV_MAX_LEVEL) {
            return { initialTargetRatio: 0.40, refillTargetMin: 4, extraSteps: 0 };
        }
        let scale = Number(difficultyScale) || 1;
        if (scale <= 0.94) {
            return { initialTargetRatio: 0.48, refillTargetMin: 6, extraSteps: 0 };
        }
        if (scale <= 1.04) {
            return { initialTargetRatio: 0.44, refillTargetMin: 5, extraSteps: 0 };
        }
        return { initialTargetRatio: 0.40, refillTargetMin: 4, extraSteps: 0 };
    }

    private ensureDifficultyState() {
        if (!this._playerInfo) {
            this._playerInfo = {};
        }
        if (!this._playerInfo.difficultyState || this._playerInfo.difficultyState.version !== 1) {
            this._playerInfo.difficultyState = { version: 1, failures: {} };
        }
        if (!this._playerInfo.difficultyState.failures) {
            this._playerInfo.difficultyState.failures = {};
        }
        return this._playerInfo.difficultyState;
    }

    private pruneFailureRecords(failures: any) {
        let keys = Object.keys(failures);
        if (keys.length <= 20) {
            return;
        }
        keys.sort((a: string, b: string) => (failures[b].lastFailedAt || 0) - (failures[a].lastFailedAt || 0));
        for (let i = 20; i < keys.length; i++) {
            delete failures[keys[i]];
        }
    }

    private validateLevelRun(run: LevelRunConfig) {
        let cakes = String(run.levelInfo.cakes || '').split('|');
        let targets = String(run.levelInfo.targets || '').split('|');
        if (!cakes.length || cakes[0] === '' || !targets.length || targets[0] === '') {
            throw new Error('关卡 ' + run.levelId + ' 缺少 cakes 或 targets');
        }
        targets.forEach((target: string) => {
            let parts = target.split('-');
            if (cakes.indexOf(parts[0]) === -1 || !(Number(parts[1]) > 0)) {
                throw new Error('关卡 ' + run.levelId + ' 的目标配置无效：' + target);
            }
        });
    }

    private hashString(value: string) {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    private createSeededRandom(seed: number) {
        let state = seed >>> 0;
        return () => {
            state += 0x6D2B79F5;
            let value = state;
            value = Math.imul(value ^ value >>> 15, value | 1);
            value ^= value + Math.imul(value ^ value >>> 7, value | 61);
            return ((value ^ value >>> 14) >>> 0) / 4294967296;
        };
    }

    /**
     * 增加钻石数量
     *
     * @param {Number} num
     */
    addDiamond(num: any) {
        this.updatePlayerInfo('diamond', num);
    }

    /**
     * 增加金币数量
     *
     * @param {Number} num
     */
    addGold(num: any) {
        this.updatePlayerInfo('gold', Number(num));
    }

    /**
     * 获得道具
     *
     * @param {number} propId
     * @param {number} num
     */
    addProp(propId: any, num: any) {
        if (this._bag.hasOwnProperty(propId)) {
            let prop = this._bag[propId];
            prop.amount += num;
        } else {
            let prop = { amount: num };

            this._bag[propId] = prop;
        }

        this.addDataVersion();

        StorageManager.instance.setConfigData(constant.LOCAL_CACHE.BAG, JSON.stringify(this._bag));

        return true;
    }

    /**
     * 新增数据版本
     */
    addDataVersion() {
        let today = new Date().toLocaleDateString();
        let isAdd = false;
        if (this.dataVersion && typeof (this.dataVersion) === 'string') {
            var arrVersion = this.dataVersion.split('@');
            if (arrVersion.length >= 2) {
                if (arrVersion[0] === today) {
                    this.dataVersion = today + '@' + (Number(arrVersion[1]) + 1);
                    isAdd = true;
                }
            }
        }
        if (!isAdd) {
            this.dataVersion = today + '@1';
        }
        StorageManager.instance.setConfigDataWithoutSave(constants.LOCAL_CACHE.DATA_VERSION, this.dataVersion);
    }

    /**
     * 是否第一次点击更多游戏按钮
     * @param {boolean} isFirstClick 
     */
    isFirstClickMoreGame(isFirstClick?: any) {
        if (isFirstClick) {
            this.isFirst = isFirstClick;
        }
        return this.isFirst;
    }

    /**
     * 获得抽奖次数
     *
     * @param {Boolean} isMore
     */
    getLotterySpareTimes(isMore: any) {
        let maxTimes = constants.LOTTERY_MAX_TIMES;
        if (isMore) {
            maxTimes = constants.LOTTERY_AD_MAX_TIMES;
        }

        let now = utils.getDay();
        let lottery = this.getSetting(constants.SETTINGS_KEY.LOTTERY);

        if (!lottery) {
            lottery = {};
        }

        if (!lottery.today || lottery.today !== now) {
            lottery = {};
            lottery.today = {};
            this.setSetting(constants.SETTINGS_KEY.LOTTERY, lottery);
            return maxTimes;
        }

        let currentTimes = lottery.times;
        if (isMore) {
            currentTimes = lottery.moreTimes;
        }

        if (!currentTimes) {
            currentTimes = 0;
        }
        let spareTimes = maxTimes - currentTimes;
        return spareTimes > 0 ? spareTimes : 0;
    }

    /**
     * 是否有完成任务但是还未领取奖励，用于红点切换
     */
    isFinishTaskAndNoReceive() {
        if (!this.playerInfo || !this.playerInfo.dictTask) {
            return false;
        }

        for (let key in this.playerInfo.dictTask) {
            let task = this.playerInfo.dictTask[key];
            let taskInfo = localConfig.instance.queryByID('task', key);
            let taskStatus = this.getTaskStatusById(key);
            if (taskStatus.taskFinishCount >= taskInfo.count && taskStatus.taskState === constants.TASK_STATE.RECEIVABLE) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取当前每个任务的情况
     *
     * @param {String} id
     * @returns
     */
    getTaskStatusById(id: any) {
        if (!this.playerInfo || !this.playerInfo.hasOwnProperty('taskDate')) {
            return null;
        }
        let taskStatus = this.playerInfo.dictTask[id];
        return taskStatus = !taskStatus ? null : taskStatus;
    }

    getGold() {
        if (!this.playerInfo.hasOwnProperty('gold')) {
            return 0;
        }
        return this.playerInfo.gold;
    }

    /**
     * 解析礼包结构，返回礼包内容
     *
     * @param {number} 礼包奖励子类型id
     */
    parseGift(giftId: any) {
        let objGift = localConfig.instance.queryByID('gift', giftId);

        if (!objGift) {
            return null;
        }
        let arrType = objGift.type.split('|').map(Number); //奖励类型
        let arrSubType = objGift.subType.split('|').map(Number); //奖励子类型
        let arrAmount = objGift.amount.split('|').map(Number); //类型对应数量
        let arrGift: any = [];
        arrType.forEach((val: any, idx: any, arr: any) => {
            arrGift.push({ type: val, subType: arrSubType[idx], amount: arrAmount[idx] });
        });
        return arrGift;
    }

    /**
     * 签到：更新领取奖励后已领取日期数组
     * @param {Number} day
     */
    updateSignInReceivedDays(day: any) {
        let receivedDays = this.playerInfo['signInInfo']['receivedDays'];
        if (Array.isArray(receivedDays) && receivedDays.includes(day)) {
            return;
        }
        //记录领取天数
        receivedDays.push(Number(day));
        this.savePlayerInfoToLocalCache();
    }

    /**
     * 增加抽奖次数
     *
     * @param {Boolean} isMore
     * @param {Number} Times
     */
    addLotteryTimes(isMore: any, times?: any) {
        if (!times) {
            times = 1;
        }

        let now = utils.getDay();
        let lottery = this.getSetting(constants.SETTINGS_KEY.LOTTERY);
        if (!lottery) {
            lottery = {};
        }

        if (!lottery.today || lottery.today !== now) {
            lottery = {};
            lottery.today = now;
        }

        if (!isMore) {
            if (lottery.times) {
                lottery.times += times; //普通领奖次数累加
            } else {
                lottery.times = times;
            }
        } else {
            if (lottery.moreTimes) {
                lottery.moreTimes += times; //看广告领奖次数累加
            } else {
                lottery.moreTimes = times;
            }
        }

        this.setSetting(constants.SETTINGS_KEY.LOTTERY, lottery);
    }

    //获得无限道具的分享/广告次数
    getInfiniteTimes() {
        if (this.playerInfo.infiniteShareTimes) {
            return this.playerInfo.infiniteShareTimes;
        }

        return 0;
    }

    exchangeInfiniteProp() {
        if (this.playerInfo.infiniteShareTimes >= constants.MAX_INFINITE_TIMES) {
            this.playerInfo.infiniteShareTimes -= constants.MAX_INFINITE_TIMES;
        } else {
            this.playerInfo.infiniteShareTimes = 0;
        }
        clientEvent.dispatchEvent('updateInfiniteShareTimes');

        this.savePlayerInfoToLocalCache();
    }

    /**
     * 获取玩家当前玩到的关卡
     */
    getCurrentLevel() {
        var history = utils.objectToArray(this.history);
        var length = history.length;
        if (length === 0) {
            return localConfig.instance.queryOne('level', 'name', '1');
        }

        history.sort(function (a, b) {
            return Number(a.levelId) - Number(b.levelId);
        });

        var last = history[length - 1];
        var curLevelId = parseInt(last.levelId);
        // 走缓存方法，保证一致性
        var curLevel = playerData.instance.getLevelInfoById(curLevelId);

        if (last.star === 0) {
            return curLevel;
        }

        var nextLevelId = curLevelId + 1;
        return playerData.instance.getLevelInfoById(nextLevelId);
    }

    /**
     * 获得关卡最高分
     *
     * @param {Number} level
     * @returns
     */
    getHighestScoreByLevel(level: any) {
        if (this.history.hasOwnProperty(level)) {
            return this.history[level].score;
        }

        return 0;
    }

    /**
     * 获取道具剩余数量
     * 
     * @param {Number} propId 道具id
     */
    getPropAmount(propId: any) {
        if (this.bag.hasOwnProperty(propId)) {
            return this.bag[propId].amount || 0; //考虑undefined所以加或0
        }

        return 0;
    }

    /**
     * 道具是否解锁 (控制道具的显示隐藏)
     * @param {number} propId 
     */
    isPropUnlock(propId: any) {
        let higestLevel = this.getCurrentLevel().ID;
        if (!this.playerInfo.hasOwnProperty('unLockInfo')) {
            this.getUnLockInfo();
        }
        return higestLevel > 1 && this.playerInfo.unLockInfo.includes(propId);
    }

    //获得解锁道具信息
    getUnLockInfo() {
        if (!this.playerInfo.hasOwnProperty('unLockInfo')) {
            let higestLevel = this.getCurrentLevel().ID;
            let arrUnlockProp = constants.UNLOCK_PROP_ID;
            let [start, end] = [0, higestLevel - 1];
            this.playerInfo.unLockInfo = arrUnlockProp.slice(start, end);
            this.savePlayerInfoToLocalCache();
        }
        return this.playerInfo.unLockInfo;
    }

    addStep(addValue: any) {
        this.spareStep += addValue;
    }

    /**
     * 是否需要打开解锁界面
     */
    isNeedOpenUnlockPanel() {
        //当前关卡的等级,不一定是最高的那一关
        let curLevel = this.getCurrentLevelInfo().ID;
        if (curLevel > 1 && curLevel <= constants.UNLOCK_HIGEST_LEVEl) {
            //关卡对应的道具
            let curProp = constants.UNLOCK_PROP_ID[curLevel - 2];
            if (!this.playerInfo.hasOwnProperty('unLockInfo')) {
                this.getUnLockInfo();
            }
            let isPropUnlock = this.isPropUnlock(curProp);
            if (!isPropUnlock) {
                return true
            }
        }
        return false;
    }

    hasSeenGuide() {
        return this.playerInfo.hasSeenGuide;
    }

    finishSeenGuide() {
        this.playerInfo.hasSeenGuide = true;
        this.updatePlayerInfo('hasSeenGuide', true);
    }

    /**
     * 消耗道具
     *
     * @param {number} propId
     */
    costProp(propId: any) {
        if (!this.bag.hasOwnProperty(propId)) {
            return false;
        }

        let prop = this.bag[propId];
        if (prop <= 0) {
            return false; //数量不足
        }

        prop.amount--;
        this.addDataVersion();
        StorageManager.instance.setConfigData(constant.LOCAL_CACHE.BAG, JSON.stringify(this.bag));

        return true;
    }

    /**
     * 增加分数
     * @param {Number} score 
     */
    addScore(score: any) {
        this.score += score;
    }

    /**
     * 通过目标类型获得目标值
     * @param {String} cake 
     */
    getTargetValue(cake: any) {
        if (this.dictTargets.hasOwnProperty(cake)) {
            return this.dictTargets[cake];
        }

        return 0;
    }

    /**
     * 更新已解锁道具
     */
    updateUnLockInfo(propId: any) {
        let arrUnLockProp = this.playerInfo.unLockInfo;
        if (!arrUnLockProp.includes(propId)) {
            arrUnLockProp.push(propId);
            this.savePlayerInfoToLocalCache();
        } else {
            return;
        }
    }
    finishLevel(level: any, score: any) {
        let star = 0;
        let levelInfo = this._activeLevelRun && this._activeLevelRun.levelId === Number(level)
            ? this._activeLevelRun.levelInfo
            : this.getLevelInfoById(level);

        let costTime = (Date.now() - this.curLevelInfo.startTime) / 1000;

        let arrStars = levelInfo.stars.split('|');
        if (score >= arrStars[2]) {
            star = 3;
        } else if (score >= arrStars[1]) {
            star = 2;
        } else if (score >= arrStars[0]) {
            star = 1;
        }

        let preStar = 0;
        if (this.history.hasOwnProperty(level)) {
            preStar = this.history[level].star;
            if (this.history[level].score < score) {
                this.history[level].score = score;
                this.history[level].star = star;
                this.history[level].costTime = costTime;
            }
        } else {
            this.history[level] = { levelId: level, score: score, star: star, costTime: costTime };
        }

        StorageManager.instance.setConfigData(constant.LOCAL_CACHE.HISTORY, JSON.stringify(this.history));

        //加金币
        let arrGolds = levelInfo.golds.split('|');
        let gold = 0;
        for (let idxStar = preStar; idxStar < star; idxStar++) {
            gold += Number(arrGolds[idxStar]);
        }

        if (gold > 0) {
            this.addGold(gold);
            clientEvent.dispatchEvent('updateGold');
        }

        this.clearLevelFailures(Number(level));

        return { levelId: level, score: score, star: star, gold: gold, costTime: costTime, spareStep: this.spareStep };
    }

    nextLevel() {
        this.level++;
        let run = this.prepareLevelRun(Number(this.level), true);
        this.startNewLevel(run);
    }
}
