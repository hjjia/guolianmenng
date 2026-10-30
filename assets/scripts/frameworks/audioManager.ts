import { util } from './util';
import { _decorator, Component, Node, AudioClip, sys, AudioSource, game, director } from "cc";
import { StorageManager } from "./storageManager";
import { resourceUtil } from "./resourceUtil";
import { loadsh } from './loadsh';
const { ccclass, property } = _decorator;

interface AudioData {
    source: AudioSource;
    isMusic: boolean;
}

interface AudioDataMap {
    [name: string]: AudioData;
}

@ccclass("AudioManager")
export class AudioManager {
    private _persistRootNode: Node = null!;
    private _audioSources: AudioSource[] = [];
    static _instance: AudioManager;
    dictWeaponSoundIndex: any = {};

    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new AudioManager();
        return this._instance;
    }

    musicVolume: number = 0.8;
    soundVolume: number = 1;
    audios: AudioDataMap = {};
    arrSound: AudioData[] = [];

    init(): boolean {
        if (this._persistRootNode?.isValid) return true; // 避免切换场景重复初始化

        const scene = director.getScene();
        if (!scene) {
            return false;
        }

        // 支持直接预览 fight/pve 场景，也兼容脚本热重载后已经存在的持久音频节点。
        const existingAudioNode = scene.getChildByName('audio');
        if (existingAudioNode) {
            this._persistRootNode = existingAudioNode;
        } else {
            this._persistRootNode = new Node('audio');
            scene.addChild(this._persistRootNode);
            game.addPersistRootNode(this._persistRootNode);
        }

        this._audioSources = this._persistRootNode.getComponents(AudioSource);
        this.audios = {};
        this.arrSound = [];

        this.musicVolume = this.getAudioSetting(true) ? 0.8 : 0;
        this.soundVolume = this.getAudioSetting(false) ? 1 : 0;
        return true;
    }

    private _getAudioSource(clip: AudioClip): AudioSource | null {
        if (!clip || !this.init()) {
            return null;
        }

        let result: AudioSource | undefined;
        for (let i = 0; i < this._audioSources.length; ++i) {
            let audioSource = this._audioSources[i];
            if (!audioSource.playing) {
                result = audioSource;
                break;
            }
        }
        if (!result) {
            result = this._persistRootNode.addComponent(AudioSource);
            this._audioSources.push(result);
        }
        result.node.off(AudioSource.EventType.ENDED);
        result.clip = clip;
        result.currentTime = 0;
        return result;
    }

    getAudioSetting(isMusic: boolean) {
        let state;
        if (isMusic) {
            state = StorageManager.instance.getGlobalData('music');
        } else {
            state = StorageManager.instance.getGlobalData('sound');
        }

        // console.log('Config for [' + (isMusic ? 'Music' : 'Sound') + '] is ' + state);

        return !state || state === 'true' ? true : false;
    }

    /**
     * 播放音乐
     * @param {String} name 音乐名称可通过constants.AUDIO_MUSIC 获取
     * @param {Boolean} loop 是否循环播放
     */
    playMusic(name: string, loop: boolean) {
        let path = 'audio/music/' + name;
        //微信特殊处理，除一开场的音乐，其余的放在子包里头
        // if (name !== 'click') {
        //     path =  path; //微信特殊处理，除一开场的音乐，其余的放在子包里头
        // }


        resourceUtil.loadRes(path, AudioClip, (err: any, clip: any) => {
            if (err || !clip) {
                console.warn(`[AudioManager] 音乐加载失败：${path}`, err);
                return;
            }
            let source = this._getAudioSource(clip);
            if (!source) return;
            let tmp: AudioData = {
                source,
                isMusic: true,
            };
            this.audios[name] = tmp;
            source.volume = this.musicVolume;
            source.loop = loop;
            source.play();
        });
    }

    /**
     * 播放音效
     * @param {String} name 音效名称可通过constants.AUDIO_SOUND 获取
     * @param {Boolean} loop 是否循环播放
     */
    playSound(name: string, loop: boolean = false) {
        if (!this.soundVolume) {
            return;
        }

        //音效一般是多个的，不会只有一个
        let path = 'audio/sound/';
        // if (name !== 'click') {
        //     path = path; //微信特殊处理，除一开场的音乐，其余的放在子包里头
        // }

        resourceUtil.loadRes(path + name, AudioClip, (err: any, clip: any) => {
            if (err || !clip) {
                console.warn(`[AudioManager] 音效加载失败：${path + name}`, err);
                return;
            }
            let source = this._getAudioSource(clip);
            if (!source) return;
            let tmp: AudioData = {
                source,
                isMusic: false,
            };
            this.arrSound.push(tmp);

            if (loop) {
                this.audios[name] = tmp;
            }

            source.volume = this.soundVolume;
            source.loop = loop;
            source.play();

            source.node.on(AudioSource.EventType.ENDED, () => {
                loadsh.remove(this.arrSound, (obj: AudioData) => {
                    return obj.source === tmp.source;
                });
            });
        });
    }

    stop(name: string) {
        if (this.audios.hasOwnProperty(name)) {
            let audio = this.audios[name];
            audio.source.stop();
        }
    }

    stopAll() {
        for (const i in this.audios) {
            if (this.audios.hasOwnProperty(i)) {
                let audio = this.audios[i];
                audio.source.stop();
            }
        }
    }
    getMusicVolume() {
        return this.musicVolume;
    }

    setMusic(flag: number) {
        this.musicVolume = flag;
        for (let item in this.audios) {
            if (this.audios.hasOwnProperty(item) && this.audios[item].isMusic) {
                // this.changeState(item, flag);
                let audio = this.audios[item];
                audio.source.volume = this.musicVolume;
            }
        }
    }

    //看广告时先将音乐暂停
    pauseAll() {
        console.log("pause all music!!!");

        for (let item in this.audios) {
            if (this.audios.hasOwnProperty(item)) {
                let audio = this.audios[item];
                audio.source.pause();
            }
        }
    }

    resumeAll() {
        for (let item in this.audios) {
            if (this.audios.hasOwnProperty(item)) {
                let audio = this.audios[item];
                audio.source.play();
            }
        }
    }

    openMusic() {
        this.setMusic(0.8);
        StorageManager.instance.setGlobalData('music', 'true');
    }

    closeMusic() {
        this.setMusic(0);
        StorageManager.instance.setGlobalData('music', 'false');
    }

    openSound() {
        this.setSound(1);
        StorageManager.instance.setGlobalData('sound', 'true');
    }

    closeSound() {
        this.setSound(0);
        StorageManager.instance.setGlobalData('sound', 'false');
    }

    setSound(flag: number) {
        this.soundVolume = flag;
        for (let item in this.audios) {
            if (this.audios.hasOwnProperty(item) && !this.audios[item].isMusic) {
                // this.changeState(item, flag);
                let audio = this.audios[item];
                audio.source.volume = this.soundVolume;
            }
        }

        for (let idx = 0; idx < this.arrSound.length; idx++) {
            let audio = this.arrSound[idx];
            audio.source.volume = this.soundVolume;
        }
    }

    stopSingleSound(name: string) {
        if (this.audios.hasOwnProperty(name) && !this.audios[name].isMusic) {
            let audio = this.audios[name];
            audio.source.stop();
        }
    }
}
