/*
 * References: 
 * https://lodev.org/cgtutor/raycasting.html
 * https://stackoverflow.com/questions/47239797/ray-casting-with-different-height-size 
 */ 

import _, { random } from "lodash";
import {
  Vector,
  vectorAdd,
  vectorClone,
  vectorEqual,
  vectorScale,
  vectorMultiplyComponents,
  vectorNormalized,
  vectorMagnitude,
  zeroVector,
} from "../Toolbox/Vector";

import { classicColors, namedColors, uniqueColors } from "../Color/ansi";
import { Color, ColorType } from "../Color/Color";
import { Executable } from "./FileSystem";
import { PC } from "./PC";
import { char, Size } from "../types";
import { ScreenMode } from "../Std";

const MAP_WIDTH:  number = 10;
const MAP_HEIGHT: number = 10;
const MAX_STEPS:  number = 15;

enum MapIndexType {
  DEFAULT,
  TEXT,
  DOOR,
}

class MapIndex {
  fgColor!: Color;
  height!: number;
  type!: MapIndexType;
  displayStr?: string;

  constructor(fgColor: Color, height: number, type: MapIndexType, displayStr?: string){
    this.fgColor = fgColor;
    this.height  = height;
    this.type    = type;

    if (displayStr) this.displayStr = displayStr;
  }
}

type MapDictionary = Record<number, MapIndex>;
const MAP_ENTRIES: MapDictionary = {
  1 : new MapIndex(classicColors["white"],     1,   MapIndexType.DEFAULT),
  2 : new MapIndex(classicColors["yellow"],    2,   MapIndexType.DEFAULT),
  3 : new MapIndex(classicColors["green"],     0.1, MapIndexType.DEFAULT),
  4 : new MapIndex(classicColors["red"],       4,   MapIndexType.DEFAULT),
  5 : new MapIndex(classicColors["lightBlue"], 5,   MapIndexType.DEFAULT),
}

const MAP: Array<number> = [
  1,1,5,0,0,0,0,5,1,1,
  1,0,0,0,0,0,0,0,0,2,
  1,0,0,0,0,0,0,0,0,1,
  5,1,3,3,0,0,0,0,0,1,
  1,0,0,0,0,0,0,5,0,2,
  1,0,0,0,0,0,0,4,0,2,
  1,0,0,0,0,0,0,4,0,1,
  1,0,1,3,0,0,0,0,0,1,
  1,0,0,3,0,0,0,0,0,2,
  5,1,2,2,1,1,2,2,1,1,
];

interface GameState {
  Enter:  () => void;
  Update: (dt: number) => void;
  Exit:   () => void;
}

class Sprite {
    width:  number;
    height: number;
    sprite: Array<char>;

    constructor(w: number, h: number, arr: Array<char>) {
        this.width  = w;
        this.height = h;
        this.sprite = arr;
    }
}

const penger8x8: Sprite = {
  width:  8,
  height: 8,
  sprite: [
    ' ',' ','#','#','#',' ',' ',' ',
    ' ',' ','#','g','g','#',' ',' ',
    ' ','#','#','#','g','#',' ',' ',
    ' ','#','g','g','#','o','#',' ',
    ' ','#','g','g','w','#',' ',' ',
    ' ','#','g','w','w','w','#',' ',
    ' ','#','g','#','#','w','#',' ',
    '#','o','#',' ',' ','#','o','#',
  ],
};

const penger5x5: Sprite = {
  width:  5,
  height: 5,
  sprite: [
    ' ', 'g', 'g', ' ', ' ', 
    'g', '#', 'g', 'o', ' ', 
    'g', 'g', 'g', 'o', 'o', 
    'g', 'w', 'w', 'w', ' ', 
    'o', 'o', 'w', 'o', 'o', 
  ],
};

const penger3x3: Sprite = {
  width:  3,
  height: 3,
  sprite: [
    ' ', 'g', 'o', 
    'g', 'w', 'g', 
    'o', 'w', 'o', 
  ],
};


class Entity {
  position!: Vector;
  z!:        number;
  sprite!:   Sprite;

  constructor(position: Vector, sprite: Sprite, z: number) {
    this.position = position;
    this.sprite   = sprite;

    this.z = z;
  }
}

class Player implements Entity {
  position:  Vector;
  direction: Vector;
  z:         number = 0;
  plane:     Vector;
  sprite:    Sprite;

  moveSpeed:   number = 25;
  rotateSpeed: number = 10;

  constructor(position: Vector,  direction: Vector, plane: Vector = { x:0, y:0.7 }) {
    this.position  = position;
    this.sprite    = penger8x8;
    this.direction = direction;
    this.plane     = plane;
  }

  public Move(left: boolean, dT: number) {
    let scaledDir = vectorScale(this.direction, (left ? 1 : -1) * dT * this.moveSpeed);

    let newPos = vectorAdd(this.position, scaledDir);
    let newMapPos = {x: Math.floor(newPos.x), y: Math.floor(newPos.y)};

    if (newMapPos.x >= 0 && newMapPos.x < MAP_WIDTH && newMapPos.y >= 0 && newMapPos.y <= MAP_HEIGHT){
      if (MAP[(newMapPos.y * MAP_WIDTH) + Math.floor(this.position.x)] > 0) {
          newPos.y = this.position.y;
      }

      if (MAP[(Math.floor(this.position.y) * MAP_WIDTH) + newMapPos.x] > 0) {
          newPos.x = this.position.x;
      }
    }

    this.position = newPos;
  }

  public Look(left: boolean, dT: number) {
      let oldDir:   Vector = this.direction;
      let oldPlane: Vector = this.plane;

      let rotSpeed: number = this.rotateSpeed * (left ? 1 : -1) * dT;

      this.direction = {
        x: oldDir.x * Math.cos(rotSpeed) - oldDir.y * Math.sin(rotSpeed),
        y: oldDir.x * Math.sin(rotSpeed) + oldDir.y * Math.cos(rotSpeed),
      };

      this.direction = vectorNormalized(this.direction);
      
      this.plane = {
        x: oldPlane.x * Math.cos(rotSpeed) - oldPlane.y * Math.sin(rotSpeed),
        y: oldPlane.x * Math.sin(rotSpeed) + oldPlane.y * Math.cos(rotSpeed),
      };
  }
}

class Raycaster implements GameState {
  private pc: PC;
  private player: Player;
  private entities: Array<Entity>;
  private time: number;

  zBuffer: number[];
  
  constructor(pc:PC){
    this.pc = pc;
    this.player = new Player({x: 5, y: 5}, {x: -1, y: 0});

    let size = pc.std.getConsoleSize();
    this.zBuffer = new Array(size.h * size.w).fill(1000);

    this.entities = new Array(
      this.player,
      new Entity({x:6, y:6}, penger8x8, 0), 
      new Entity({x:4.5, y:6}, penger5x5, 0),
      new Entity({x:3, y:6}, penger3x3, 5),
    );

    this.time = 0;
  }

  private HandleMovement(dt: number){
    const { std } = this.pc;
    const ev = std.getNextKeyboardEvent();
    if (ev) {
      if (ev.isModifier || !ev.pressed) return;

      if (ev.code === "KeyW") {
        this.player.Move(true,dt);
      }

      if (ev.code === "KeyS") {
        this.player.Move(false,dt);
      }

      if (ev.code === "KeyA") {
        this.player.Look(true,dt);
      }

      if (ev.code === "KeyD") {
        this.player.Look(false,dt);
      }
    }
  }

  public Enter() {

  }

  public Update(dt: number) {
    const { std } = this.pc;

    this.time += dt;
    this.HandleMovement(dt);

    std.clearConsole();
    this.zBuffer.fill(1000);
    const size = std.getConsoleSize();

    this.entities[1].position.x = Math.cos(this.time) + 4.5;
    this.entities[1].position.y = Math.sin(this.time) + 6;
    this.entities[1].z = Math.sin(this.time);

    for (let posY: number = 0; posY <= size.h; posY++){
      const p: number = posY - size.h / 2;

      if (p <= 0) continue;

      const camPosY: number = size.h / 2;
      const rowDist: number = camPosY / p;

      const rayDir0: Vector = {
        x: this.player.direction.x - this.player.plane.x, 
        y: this.player.direction.y - this.player.plane.y
      };

      const rayDir1: Vector = {
        x: this.player.direction.x + this.player.plane.x, 
        y: this.player.direction.y + this.player.plane.y
      };

      const floorStep: Vector = {
        x: rowDist * (rayDir1.x - rayDir0.x) / size.w,
        y: rowDist * (rayDir1.y - rayDir0.y) / size.w,
      }

      let floorPos: Vector = {
        x: this.player.position.x + rowDist * rayDir0.x,
        y: this.player.position.y + rowDist * rayDir0.y,
      }

      for (let posX: number = 0; posX < size.w; posX++) {
        const mapPos: Vector = {
          x: Math.floor(floorPos.x),
          y: Math.floor(floorPos.y),
        }

        floorPos = vectorAdd(floorPos, floorStep);

        if (mapPos.x < 0 || mapPos.x >= MAP_WIDTH || mapPos.y < 0 || mapPos.y >= MAP_HEIGHT) continue;

        if (rowDist > MAX_STEPS) return;

        // Floor
        let interpPos: number = Math.floor(posY - 1);
        if (interpPos < 0) interpPos = 0;
        if (interpPos >= size.h) interpPos = size.h - 1;

        this.zBuffer[(posX * size.h) + interpPos] = rowDist;

        std.setConsoleCursorPosition({x: posX, y: interpPos}); // Here
        std.writeConsole("█", {
            fgColor: mapPos.x % 2 == mapPos.y % 2 ? classicColors["violet"] : classicColors["lightMagenta"],
        }); 

        // Ceiling
        // interpPos = size.h - posY + Math.ceil(1 / entry.height);
        // if (interpPos < size.h && interpPos >= 0) {
        //   this.zBuffer[(posX * size.h) + interpPos] = rowDist;
        //   std.setConsoleCursorPosition({x: posX, y: interpPos});
        //   std.writeConsole("█", {
        //     fgColor: entry.fgColor,
        //   }); 
        // }
      }
    }

    // Sprite Drawing
    this.entities.forEach((entity, index, array) => {
      const dist: number = Math.sqrt(
        (this.player.position.x - entity.position.x) * (this.player.position.x - entity.position.x) +
        (this.player.position.y - entity.position.y) * (this.player.position.y - entity.position.y)
      );

      if (dist > MAX_STEPS) return;

      const spritePos: Vector = {
        x: entity.position.x - this.player.position.x,
        y: entity.position.y - this.player.position.y,
      };

      const invDet:    number = 1.0 / (this.player.plane.x * this.player.direction.y - this.player.direction.x * this.player.plane.y);
      const transform: Vector = {
        x: invDet * (this.player.direction.y * spritePos.x - this.player.direction.x * spritePos.y),
        y: invDet * (-this.player.plane.y * spritePos.x + this.player.plane.x * spritePos.y),
      }

      const spriteXPos:   number = Math.ceil((size.w / 2) * (1 + transform.x / transform.y));
      const spriteHeight: number = Math.abs(Math.ceil(size.h / (transform.y)));
      const spriteWidth:  number = Math.abs(Math.ceil(size.w / (transform.y)));

      const scaledZ = (entity.z * (size.h / 2)) / dist;

      const drawStart: Vector = { 
        x: Math.ceil(Math.max(-spriteWidth / 2 + spriteXPos, 0)), 
        y: Math.ceil(Math.max(-spriteHeight / 2 + size.h / 2 - scaledZ, 0)), 
      };

      const drawEnd: Vector = { 
        x: Math.ceil(Math.min(spriteWidth / 2 + spriteXPos,  size.w)),
        y: Math.ceil(Math.min(spriteHeight / 2 + size.h / 2 - scaledZ, size.h)),
      };

      for (let posX: number = drawStart.x; posX < drawEnd.x; ++posX) {
        const spriteScreenXOffset: number = posX - (spriteXPos - spriteWidth / 2);
        const u:                   number = spriteScreenXOffset / spriteWidth;
        const texX:                number = Math.ceil(u * entity.sprite.width) - 1;

        if (texX < 0 || texX >= entity.sprite.width) continue;

        if (transform.y > 0 && posX >= 0 && posX <= size.w - 1 && transform.y < this.zBuffer[posX * size.h]){
          for (let posY: number = drawStart.y; posY < drawEnd.y; ++posY) {
            const bufIndex: number = (posX * size.h) + posY;
            if (this.zBuffer[bufIndex] < dist) continue;

            const spriteScreenYOffset: number = posY + scaledZ - (size.h / 2 - spriteHeight / 2);
            const v:                   number = spriteScreenYOffset / spriteHeight;
            const texY:                number = Math.ceil(v * entity.sprite.height) - 1;

            if (texY < 0 || texY >= entity.sprite.height) continue;

            const char: char = entity.sprite.sprite[(texY * entity.sprite.width) + texX];
            if (char === ' ' || char === '') continue;

            this.zBuffer[bufIndex] = dist;
            
            let color: Color;
            switch (char){
              case '#': color = classicColors["black"]; break;
              case 'g': color = classicColors["darkGray"]; break;
              case 'o': color = classicColors["lightOrange"]; break;
              default:  color = classicColors["white"];break;
            }

            std.setConsoleCursorPosition({x: posX, y: posY});
            std.writeConsole(char, {
              fgColor: color,
            });
          }
        }
      }
    });

    // Wall drawing
    for (let posX: number = 0; posX < size.w; posX++){
      const camX = 2.0 * posX / size.w - 1.0;

      let rayDir: Vector = {
        x: this.player.direction.x + this.player.plane.x * camX,
        y: this.player.direction.y + this.player.plane.y * camX,
      };

      const deltaDist: Vector = {
        x: (rayDir.x == 0) ? 1e30 : Math.abs(1.0 / rayDir.x),
        y: (rayDir.y == 0) ? 1e30 : Math.abs(1.0 / rayDir.y),
      };

      let mapPos: Vector = {
        x: Math.floor(this.player.position.x),
        y: Math.floor(this.player.position.y),
      };

      let sideDist:     Vector  = {x:0, y:0};
      let step:         Vector  = {x:0, y:0};
      let side:         boolean = false;
      let boundStep:    number  = 0;

      if (rayDir.x < 0) {
        step.x = -1;
        sideDist.x = (this.player.position.x - mapPos.x) * deltaDist.x;
      }
      else {
        step.x = 1;
        sideDist.x = (mapPos.x + 1.0 - this.player.position.x) * deltaDist.x;
      }

      if (rayDir.y < 0) {
        step.y = -1;
        sideDist.y = (this.player.position.y - mapPos.y) * deltaDist.y;
      } 
      else {
        step.y = 1;
        sideDist.y = (mapPos.y + 1.0 - this.player.position.y) * deltaDist.y;
      }

      while (boundStep < MAX_STEPS) {
        if (sideDist.x < sideDist.y) {
          sideDist.x += deltaDist.x;
          mapPos.x += step.x;
          mapPos.x = Math.floor(mapPos.x);
          side = false;
        }
        else {
          sideDist.y += deltaDist.y;
          mapPos.y += step.y;
          mapPos.y = Math.floor(mapPos.y);
          side = true;
        }

        if (mapPos.x < 0 || mapPos.x >= MAP_WIDTH || mapPos.y < 0 || mapPos.y >= MAP_HEIGHT) {
          boundStep++;
          continue;
        }

        const mapIndex: number = MAP[(mapPos.y * MAP_WIDTH) + mapPos.x];
        if (mapIndex <= 0) continue;

        const entry = MAP_ENTRIES[mapIndex];
        const perpWallDist: number = side ? (sideDist.y - deltaDist.y) : (sideDist.x - deltaDist.x);
        if (perpWallDist <= 0) continue;

        const lineHeight:   number = Math.floor(size.h / perpWallDist);
        const pixelHeight:  number = Math.floor(lineHeight * entry.height);
        const baseY:        number = Math.floor(size.h/2 + lineHeight/2);

        let drawEnd:        number = baseY;
        let drawStart:      number = drawEnd - pixelHeight;

        if (drawStart < 0)     drawStart = 0;
        if (drawEnd >= size.h) drawEnd = size.h - 1;

        for (let posY: number = drawStart; posY <= drawEnd; posY++) {
          const z = this.zBuffer[(posX * size.h) + posY];
          if (z <= perpWallDist) continue;

          this.zBuffer[(posX * size.h) + posY] = perpWallDist;

          std.setConsoleCursorPosition({x: posX, y: posY});
          std.writeConsole(side ? "█" : "░", {
            fgColor: entry.fgColor,
          });
        }
      }
    }
  }

  public Exit() {
    const { std } = this.pc;
    std.clearConsole();
  }
};

export class RaycasterApp implements Executable {
  private pc: PC;
  private raycaster: Raycaster;
  
  constructor(pc: PC){
    this.pc = pc;
    this.raycaster = new Raycaster(pc);
  }

  private printName(str: string) {
      const { std } = this.pc;
      const size = std.getConsoleSize();

      const strArr = str.split("@n");
      
      for (let y = 0; y < strArr.length; ++y) {
        if (y >= size.h) break;  

        for (let x = 0; x < strArr[y].length; ++x) {
          if (x >= size.w) continue;  

          let attrib = std.getConsoleAttributes();

          if (y > strArr.length * 0.5) {
            attrib.fgColor = classicColors["lightOrange"];
          }
          else if (y == Math.floor(strArr.length * 0.5)) {
            attrib.fgColor = classicColors["lightCyan"];
          }
          else {
            attrib.fgColor = classicColors["cyan"];
          }

          std.setConsoleAttributes(attrib);

          std.setConsoleCursorPosition({x:x, y:y});
          std.writeConsole(strArr[y].charAt(x));
        }
      }

      std.writeConsole('\n');
  }

  async run(_: string[]){
    const { std } = this.pc;
    std.setIsConsoleCursorVisible(false);
    std.clearConsole();

    std.setConsoleScreenMode(ScreenMode.mode80x50_9x8);

    return new Promise<void>((resolve) => {
      let lastTime = performance.now();
      const doAnimationFrame: FrameRequestCallback = async () => {
        const dt = performance.now() - lastTime;
        lastTime = performance.now();

        // Convert seconds to ms
        this.raycaster.Update(dt * 0.001);

        if (std.getIsKeyPressed("KeyQ")) {
          std.setConsoleScreenMode(ScreenMode.mode80x25_9x16);
          std.setIsConsoleCursorVisible(true);

          this.printName(`
█████╗ ██████╗███╗  ██╗ █████╗  █████╗ ████╗ ██████╗██████╗██████╗█████╗ @n
██╔═██╗██╔═══╝████╗ ██║██╔═══╝ ██╔═══╝██╔═██╗██╔═══╝╚═██╔═╝██╔═══╝██╔═██╗@n
█████╔╝████╗  ██╔██╗██║██║ ███╗██║    ██████║██████╗  ██║  ████╗  █████╔╝@n
██╔══╝ ██╔═╝  ██║╚████║██║  ██║██║    ██╔═██║╚═══██║  ██║  ██╔═╝  ██╔═██╗@n
██║    ██████╗██║ ╚███║╚█████╔╝╚█████╗██║ ██║██████║  ██║  ██████╗██║ ██║@n
╚═╝    ╚═════╝╚═╝  ╚══╝ ╚════╝  ╚════╝╚═╝ ╚═╝╚═════╝  ╚═╝  ╚═════╝╚═╝ ╚═╝\n`);

          const attrib   = std.getConsoleAttributes();
          attrib.fgColor = classicColors["white"];
          std.setConsoleAttributes(attrib);

          std.writeConsole("Thank you for playing Pengcaster!\n");

          resolve();
          return;
        }

        requestAnimationFrame(doAnimationFrame);
      };
      requestAnimationFrame(doAnimationFrame);
    });
  }
}