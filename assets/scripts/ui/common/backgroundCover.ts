import { _decorator, Component, Sprite, UITransform, view } from 'cc';

const { ccclass, requireComponent } = _decorator;

/**
 * 让全屏插画按原始宽高比铺满父节点（等同于 CSS background-size: cover）。
 * 超出屏幕比例的部分会从四周等量裁切，图片不会被拉伸变形。
 */
@ccclass('BackgroundCover')
@requireComponent(Sprite)
@requireComponent(UITransform)
export class BackgroundCover extends Component {
    protected onEnable() {
        view.on('design-resolution-changed', this.requestResize, this);
        view.on('canvas-resize', this.requestResize, this);
        this.requestResize();
    }

    protected onDisable() {
        view.off('design-resolution-changed', this.requestResize, this);
        view.off('canvas-resize', this.requestResize, this);
        this.unschedule(this.applyCover);
    }

    private requestResize() {
        // 等 Canvas 和 Widget 在本帧完成尺寸更新后再计算。
        this.unschedule(this.applyCover);
        this.scheduleOnce(this.applyCover, 0);
    }

    private applyCover() {
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const transform = this.getComponent(UITransform);
        const sprite = this.getComponent(Sprite);
        const frame = sprite?.spriteFrame;

        if (!parentTransform || !transform || !sprite || !frame) {
            return;
        }

        const imageSize = frame.originalSize;
        const targetSize = parentTransform.contentSize;
        if (imageSize.width <= 0 || imageSize.height <= 0 ||
            targetSize.width <= 0 || targetSize.height <= 0) {
            return;
        }

        sprite.type = Sprite.Type.SIMPLE;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        transform.setContentSize(imageSize);

        const scale = Math.max(
            targetSize.width / imageSize.width,
            targetSize.height / imageSize.height
        );
        this.node.setScale(scale, scale, 1);
        this.node.setPosition(0, 0, this.node.position.z);
    }
}
