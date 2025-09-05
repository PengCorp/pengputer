import { ScreenMode } from "@src/Std";

import { Ticker } from "pixi.js";
import type { Size } from "@src/types";
import * as PIXI from "pixi.js";
import { Cursor } from "@src/Screen/Cursor";

import { font9x16 } from "@src/Screen/font9x16";
import type { Font } from "@src/Screen/Font";
import type { Vector } from "@Toolbox/Vector";
import type { ScreenBufferCharacter } from "@src/Screen/types";
import { namedColors } from "@Color/ansi";
import { BOXED_NO_BOX } from "@src/TextBuffer";

export type ClickListener = (clickEvent: {
  position: Vector;
  mouseButton: number;
}) => void;

const compositeVertex = `#version 300 es
precision mediump float;

in vec2 aPosition;
out vec2 vTextureCoord;

void main() {
    vec2 screenPosition = aPosition * 2.0 - 1.0;
    gl_Position = vec4(screenPosition, 0.0, 1.0);
    vTextureCoord = aPosition * vec2(1.0, -1.0) + vec2(0.0, 1.0);
}
`;

const compositeFragment = `#version 300 es
precision mediump float;

uniform sampler2D uCharacterTexture;
in vec2 vTextureCoord;
out vec4 oColor;

void main(){
  vec4 A = texture(uCharacterTexture, vTextureCoord);
  oColor = A;
}
`;

export class PixiScreen {
  private app: PIXI.Application;
  private stage!: PIXI.Application["stage"];
  private canvas!: HTMLCanvasElement;
  private font!: Font;
  private screenBuffer!: Array<ScreenBufferCharacter>;

  private widthInCharacters: number = 0;
  private heightInCharacters: number = 0;
  private totalCharacters: number = 0;

  private characterWidth: number = 0;
  private characterHeight: number = 0;

  private widthInPixels: number = 0;
  private heightInPixels: number = 0;

  private cursor: Cursor;
  private curDisplay: boolean;
  private curBlinkState: boolean;
  private curBlinkDuration: number;
  private curBlinkCounter: number;
  /** Pixel of cell to start cursor on. */
  private curStart: number;
  /** Pixel of cell to end cursor on. Inclusive. */
  private curEnd: number;

  private charBlinkState: boolean;
  private charBlinkDuration: number;
  private charBlinkCounter: number;

  private charactersScene!: PIXI.Container;
  private renderTexture!: PIXI.RenderTexture;

  public isDirty: boolean = false;

  constructor() {
    this.app = new PIXI.Application();

    this.cursor = new Cursor({
      getSize: () => this.getSizeInCharacters(),
    });
    this.curDisplay = true;
    this.curBlinkState = true;
    this.curBlinkDuration = 600;
    this.curBlinkCounter = this.curBlinkDuration;
    this.curStart = this.characterHeight - 2;
    this.curEnd = this.characterHeight - 1;

    this.charBlinkState = true;
    this.charBlinkDuration = 600;
    this.charBlinkCounter = this.charBlinkDuration;
  }

  async init(containerEl: HTMLElement) {
    this.initCanvas(containerEl);

    await this.app.init({
      width: 1024,
      height: 768,
      background: "#000000",
      view: this.canvas,
      preference: "webgl",
    });

    this.stage = this.app.stage;

    this.setScreenMode({ w: 80, h: 25 }, font9x16);

    this.screenBuffer = new Array(this.totalCharacters);
    for (let i = 0; i < this.totalCharacters; i += 1) {
      this.screenBuffer[i] = {
        character: " ",
        attributes: {
          bgColor: namedColors[namedColors.Black],
          fgColor: namedColors[namedColors.LightGray],
          blink: false,
          bold: false,
          reverseVideo: false,
          underline: false,
          halfBright: false,
          boxed: BOXED_NO_BOX,
        },
      };
    }
  }

  initCanvas(containerEl: HTMLElement) {
    const canvasBox = document.createElement("div");
    canvasBox.setAttribute("id", "screen-box");

    const canvas = document.createElement("canvas");
    this.canvas = canvas;

    canvas.setAttribute("id", "screen");

    const scanLines = document.createElement("div");

    scanLines.setAttribute("id", "screen-scanLines");

    canvasBox.appendChild(canvas);
    canvasBox.appendChild(scanLines);
    containerEl.replaceChildren(canvasBox);
  }

  private clearStage() {
    this.stage.removeChildren();
  }

  private setUpTextMode() {
    // set resolution
    this.app.renderer.resize(this.widthInPixels, this.heightInPixels);

    const screenQuad = new PIXI.Sprite(PIXI.Texture.WHITE);

    const renderTextureOpts = {
      width: this.app.renderer.width,
      height: this.app.renderer.height,
      resolution: this.app.renderer.resolution,
    };

    this.charactersScene = new PIXI.Container();
    this.renderTexture = PIXI.RenderTexture.create(renderTextureOpts);

    screenQuad.width = this.app.renderer.width;
    screenQuad.height = this.app.renderer.height;
    const compositeFilter = new PIXI.Filter({
      glProgram: new PIXI.GlProgram({
        vertex: compositeVertex,
        fragment: compositeFragment,
      }),
      resources: {
        uCharacterTexture: this.renderTexture.source,
      },
    });
    screenQuad.filters = [compositeFilter];
    this.stage.addChild(screenQuad);

    this.charactersScene.addChild(
      new PIXI.Sprite({
        texture: PIXI.Texture.WHITE,
        width: this.widthInCharacters * this.characterWidth,
        height: this.heightInCharacters * this.characterHeight,
        x: 0,
        y: 0,
        tint: 0x000000,
      }),
    );

    for (let y = 0; y < this.heightInCharacters; y += 1) {
      for (let x = 0; x < this.widthInCharacters; x += 1) {
        this.charactersScene.addChild(
          new PIXI.Sprite({
            x: x * this.characterWidth,
            y: y * this.characterHeight,
            width: this.characterWidth,
            height: this.characterHeight,
            texture: this.font.getCharacter("G", 0)!.tile,
            tint: 0xffffff,
          }),
        );
      }
    }
  }

  setScreenMode(screenSize: Size, font: Font) {
    this.clearStage();

    this.font = font;

    this.widthInCharacters = screenSize.w;
    this.heightInCharacters = screenSize.h;
    this.totalCharacters = this.widthInCharacters * this.heightInCharacters;

    const characterSize = font.getCharacterSize();
    this.characterWidth = characterSize.w;
    this.characterHeight = characterSize.h;

    this.widthInPixels = this.widthInCharacters * this.characterWidth;
    this.heightInPixels = this.heightInCharacters * this.characterHeight;

    this.setUpTextMode();

    this.isDirty = true;
  }

  public getSizeInCharacters() {
    return {
      w: this.widthInCharacters,
      h: this.heightInCharacters,
    };
  }

  public draw(dt: number) {
    this.curBlinkCounter -= dt;
    while (this.curBlinkCounter <= 0) {
      this.curBlinkCounter += this.curBlinkDuration;
      this.curBlinkState = !this.curBlinkState;
    }

    this.charBlinkCounter -= dt;
    while (this.charBlinkCounter <= 0) {
      this.charBlinkCounter += this.charBlinkDuration;
      this.charBlinkState = !this.charBlinkState;
    }
    performance.mark("draw-start");

    this.app.renderer.render({
      container: this.charactersScene,
      target: this.renderTexture,
    });

    performance.mark("draw-end");
    performance.measure("draw", "draw-start", "draw-end");
  }
}
