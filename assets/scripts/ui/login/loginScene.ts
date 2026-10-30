import { _decorator, Component, Node, find, director, profiler, game, Game, Animation, Prefab } from 'cc';
import { AudioManager } from '../../frameworks/audioManager';
import { playerData } from '../../frameworks/playerData';
import { uiManager } from '../../frameworks/uiManager';
import { SceneManager } from '../loading/sceneManager';
import { clientEvent } from '../../frameworks/clientEvent';
import { GameLogic } from '../../frameworks/gameLogic';
import * as i18n from '../../../../extensions/i18n/assets/LanguageData';
import { constants } from '../../shared/constants';
import { localConfig } from '../../frameworks/localConfig';
import { StorageManager } from '../../frameworks/storageManager';
import { resourceUtil } from '../../frameworks/resourceUtil';
const { ccclass, property } = _decorator;

@ccclass('LoginScene')
export class LoginScene extends Component {
    currentStep: any = null!;
    isLoadCsvFinishd: any = false;

    onLoad () {
        i18n.init('zh');

        profiler.hideStats();

        // 登录前就注册微信分享，使登录页和后续所有场景都能使用右上角分享。
        GameLogic.instance.initShare();

        //初始化音频
        AudioManager.instance.init();
        AudioManager.instance.playMusic(constants.AUDIO_MUSIC.BACKGROUND, true);

        // 初始化玩家数据；独立预览其他场景时也会调用同一入口。
        playerData.instance.initializeFromLocalCache();

        //记录离线时间
        game.on(Game.EVENT_HIDE, () => {
            if (!playerData.instance.settings) {
                playerData.instance.settings = {};
            }

            playerData.instance.settings.hideTime = Date.now();
            playerData.instance.saveAll();
            StorageManager.instance.save();
        })

        //加载CSV相关配置
        localConfig.instance.loadConfig(() => {
            this.isLoadCsvFinishd = true;
        })
    }

    showLoadingUI () {
        var _this = this;
        this.currentStep = 0;
        var loginTimeOut = function () {
            uiManager.instance.showTips(i18n.t("login/timeout"), function () {
                _this.showLoadingUI();
            })
        };
        this.scheduleOnce(loginTimeOut, 30);

        uiManager.instance.showDialog('common/loading');

        SceneManager.instance.load([
            function (cb: any) {
                _this.currentStep = 1;
                _this.loadSubPackage(cb);
            },
            function (cb: any) {
                _this.currentStep = 2;
                _this.loadGameSubPackage(cb);
            },
            function (cb: any) {
                _this.currentStep = 3;
                _this.unschedule(loginTimeOut);
                _this.enterMainScene(cb);
            }
        ], function (err: any, result: any) {
            if (err) {
                console.error(err.message || err);
                return;
            }
        });
    }

    loadSubPackage (cb: any) {
        cb();
    }

    loadGameSubPackage (cb: any) {
        cb();
    }

    enterMainScene (cb: any) {
        var _this = this;
        let targetScene = playerData.instance.isNewBee ? 'fight' : 'pve';
        var onSceneLoaded = function () {
            _this.currentStep = 4;
            cb();

            director.preloadScene(targetScene, function () {
                director.loadScene(targetScene, function () {
                    _this.currentStep = 5;
                    clientEvent.dispatchEvent("onSceneChanged");
                    GameLogic.instance.afterLogin();
                });
            })
        };
        director.preloadScene(targetScene, onSceneLoaded);
    }

    onBtnVisitorLoginClick () {
        if (!this.isLoadCsvFinishd) return;
        this.showLoadingUI();
    }
}
