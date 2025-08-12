/*
 * References: 
 * https://lodev.org/cgtutor/raycasting.html
 * https://stackoverflow.com/questions/47239797/ray-casting-with-different-height-size 
 */ 

import _, { last, random } from "lodash";
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

import { classicColors, getDirectColor } from "../Color/ansi";
import { Color, ColorType, DirectColor } from "../Color/Color";
import { Executable } from "./FileSystem";
import { PC } from "./PC";
import { char, Size } from "../types";
import { ScreenMode, Std } from "../Std";

const MAP_WIDTH:  number = 12;
const MAP_HEIGHT: number = 16;
const MAX_STEPS:  number = 100;

class MapIndex {
  public fgColor!: Color;
  public height!:  number;
  public z!:       number;

  public displayStr?: string;
  
  constructor(fgColor: Color, height: number, z: number, displayStr?: string){
    this.fgColor = fgColor;
    this.height  = height;
    this.z       = z;

    if (displayStr) this.displayStr = displayStr;
  }
}

type MapDictionary = Record<number, MapIndex>;
const MAP_ENTRIES: MapDictionary = {
  1 : new MapIndex(classicColors["white"], 1, 0),
  2 : new MapIndex(classicColors["lightChartreuse"], 2, 0),
  3 : new MapIndex(classicColors["green"], 0.1, 0.3),
  4 : new MapIndex(classicColors["red"], 4, 0),
  5 : new MapIndex(classicColors["lightBlue"], 5, 0),
  6 : new MapIndex(classicColors["lightOrange"], 2, 0),
  7 : new MapIndex(classicColors["lightRose"], 3.5, 0),
}

const MAP: Array<number> = [
  2,4,4,5,4,7,7,4,5,4,4,2,
  2,3,3,4,0,0,0,0,4,0,0,2,
  2,3,0,6,0,0,0,0,6,0,0,2,
  2,0,0,6,0,0,0,0,6,0,0,2,
  2,0,0,4,0,0,0,0,4,0,0,2,
  2,1,1,5,6,6,6,6,5,1,1,2,
  2,1,0,0,0,0,0,0,0,0,2,2,
  2,1,0,0,0,0,0,0,0,0,1,2,
  2,5,1,3,3,0,0,0,0,0,1,2,
  2,1,0,0,0,0,0,0,5,0,2,2,
  2,1,0,0,0,0,0,0,4,0,2,2,
  2,1,0,0,0,0,0,0,4,0,1,2,
  2,1,0,1,3,0,0,0,0,0,1,2,
  2,1,0,0,3,0,0,0,0,0,2,2,
  2,5,1,4,4,1,1,4,4,1,1,2,
  2,2,2,2,2,2,2,2,2,2,2,2,
];

interface GameState {
  Enter:  () => void;
  Update: (dt: number) => void;
  Exit:   () => void;
}

class Sprite {
  public width:  number;
  public height: number;
  public texture: Array<char>;

  constructor(w: number, h: number, arr: Array<char>) {
      this.width  = w;
      this.height = h;
      this.texture = arr;
  }
}

const penger8x8: Sprite = {
  width:  8,
  height: 8,
  texture: [
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
  texture: [
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
  texture: [
    ' ', 'g', 'o', 
    'g', 'w', 'g', 
    'o', 'w', 'o', 
  ],
};


class Entity {
  public position!: Vector;
  public z!:        number;
  public sprite!:   Sprite;

  constructor(position: Vector, sprite: Sprite, z: number) {
    this.position = position;
    this.sprite   = sprite;

    this.z = z;
  }
}

class Player implements Entity {
  public position:  Vector;
  public direction: Vector;
  public z: number = 0;
  public plane:     Vector;
  public sprite:    Sprite;

  protected moveSpeed:   number = 25;
  protected rotateSpeed: number = 10;

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
      const entryY = MAP[(newMapPos.y * MAP_WIDTH) + Math.floor(this.position.x)];
      if (entryY > 0 && Math.abs(MAP_ENTRIES[entryY].z) <= 0.5) {
          newPos.y = this.position.y;
      }

      const entryX = MAP[(Math.floor(this.position.y) * MAP_WIDTH) + newMapPos.x];
      if (entryX > 0 && Math.abs(MAP_ENTRIES[entryX].z) <= 0.5) {
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
  private openDoor: boolean = false;
  private time: number;

  private zBuffer: number[] = [];
  private size: Size = {w: 0, h: 0};
  
  constructor(pc:PC){
    this.pc      = pc;
    this.time    = 0;
    this.player  = new Player({x: 5, y: 12}, {x: -1, y: 0});

    this.entities = new Array(
      this.player,
      new Entity({x:6,   y:10}, penger8x8, 0), 
      new Entity({x:4.5, y:10}, penger5x5, 0),
      new Entity({x:3,   y:10}, penger3x3, 5),
    );

    this.ClearScreen(pc.std);
  }

  private ClearScreen(std: Std) {
    std.clearConsole();
    if (this.zBuffer) this.zBuffer.fill(1000);
  }

  private HandleInputs(dt: number){
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

      if (ev.code === "KeyE") this.openDoor = !this.openDoor;
    }
  }

  private Lerp(a: number, b: number, t: number) {
    return a + t * (b - a);
  }

  private RenderBackground(std: Std) {
    for (let posY: number = 0; posY < this.size.h; posY++) {
      for (let posX: number = 0; posX < this.size.w; posX++) {
        let col: DirectColor = {type: ColorType.Direct, r: 0, g: 0, b: 0};

        // Start: 50, 190, 255
        // End:   23, 33, 145
        const t: number = posY / (this.size.h / 2);
        col.r = this.Lerp(50,  23,  t);
        col.g = this.Lerp(190, 33,  t);
        col.b = this.Lerp(255, 145, t);
        
        std.setConsoleCursorPosition({x: posX, y: posY});
        std.writeConsole("█", {
          fgColor: col,
        });
      }
    }
  }

  private RenderFloorAndCeiling(std: Std) {
    for (let posY: number = 0; posY <= this.size.h; posY++){
      const p: number = posY - this.size.h / 2;

      if (p <= 0) continue;

      const camPosY: number = this.size.h / 2;
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
        x: rowDist * (rayDir1.x - rayDir0.x) / this.size.w,
        y: rowDist * (rayDir1.y - rayDir0.y) / this.size.w,
      }

      let floorPos: Vector = {
        x: this.player.position.x + rowDist * rayDir0.x,
        y: this.player.position.y + rowDist * rayDir0.y,
      }

      // Floor
      let interpPos: number = Math.floor(posY - 1);
      if (interpPos < 0) interpPos = 0;
      if (interpPos >= this.size.h) interpPos = this.size.h - 1;

      for (let posX: number = 0; posX < this.size.w; posX++) {
        const mapPos: Vector = {
          x: Math.floor(floorPos.x),
          y: Math.floor(floorPos.y),
        }

        floorPos = vectorAdd(floorPos, floorStep);

        if (mapPos.x < 0 || mapPos.x >= MAP_WIDTH || mapPos.y < 0 || mapPos.y >= MAP_HEIGHT) continue;

        if (rowDist > MAX_STEPS) break;

        this.zBuffer[(posX * this.size.h) + interpPos] = rowDist;

        std.setConsoleCursorPosition({x: posX, y: interpPos}); // Here
        std.writeConsole("█", {
            fgColor: mapPos.x % 2 == mapPos.y % 2 ? classicColors["violet"] : classicColors["lightMagenta"],
        }); 

        // Ceiling, its been turned off due to no real usecase atm haha :)
        // If you ever did want to use it, comment out Math.ceil(1 / entry.height), as that only allows for ceilings to go farther upward.
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
  }

  private RenderSprites(std: Std) {
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

      const spriteXPos:   number = Math.ceil((this.size.w / 2) * (1 + transform.x / transform.y));
      const spriteHeight: number = Math.abs(Math.ceil(this.size.h / (transform.y)));
      const spriteWidth:  number = Math.abs(Math.ceil(this.size.w / (transform.y)));

      const scaledZ = (entity.z * (this.size.h / 2)) / dist;

      const drawStart: Vector = { 
        x: Math.ceil(Math.max(-spriteWidth / 2 + spriteXPos, 0)), 
        y: Math.ceil(Math.max(-spriteHeight / 2 + this.size.h / 2 - scaledZ, 0)), 
      };

      const drawEnd: Vector = { 
        x: Math.ceil(Math.min(spriteWidth / 2 + spriteXPos,  this.size.w)),
        y: Math.ceil(Math.min(spriteHeight / 2 + this.size.h / 2 - scaledZ, this.size.h)),
      };

      for (let posX: number = drawStart.x; posX < drawEnd.x; ++posX) {
        const spriteScreenXOffset: number = posX - (spriteXPos - spriteWidth / 2);
        const u:                   number = spriteScreenXOffset / spriteWidth;
        const texX:                number = Math.ceil(u * entity.sprite.width) - 1;

        if (texX < 0 || texX >= entity.sprite.width) continue;

        if (transform.y > 0 && posX >= 0 && posX < this.size.w) // && transform.y < this.zBuffer[posX * size.h] 
        {
          for (let posY: number = drawStart.y; posY < drawEnd.y; ++posY) {
            const bufIndex: number = (posX * this.size.h) + posY;
            if (this.zBuffer[bufIndex] < dist) continue;

            const spriteScreenYOffset: number = posY + scaledZ - (this.size.h / 2 - spriteHeight / 2);
            const v:                   number = spriteScreenYOffset / spriteHeight;
            const texY:                number = Math.ceil(v * entity.sprite.height) - 1;

            if (texY < 0 || texY >= entity.sprite.height) continue;

            const char: char = entity.sprite.texture[(texY * entity.sprite.width) + texX];
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
  }

  private RenderCubes(std: Std) {
 // Wall drawing
    for (let posX: number = 0; posX < this.size.w; posX++){
      const camX = 2.0 * posX / this.size.w - 1.0;

      const rayDir: Vector = {
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

      let side:         boolean = false;
      let boundStep:    number  = 0;
      let lastIndex:    number  = -1;
      let lastStart:    number  = -1;
      let lastEnd:      number  = -1;
      let lastDist:     number  = -1;

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

        if (lastIndex != -1) {
          const entry = MAP_ENTRIES[lastIndex];
          const perpWallDist: number = side ? (sideDist.y - deltaDist.y) : (sideDist.x - deltaDist.x);

          const lineHeight:   number = Math.floor(this.size.h / perpWallDist);
          const pixelHeight:  number = Math.floor(lineHeight * entry.height);
          const baseY:        number = Math.floor(this.size.h/2 + lineHeight/2 - lineHeight * entry.z);

          let drawEnd:        number = baseY;
          let drawStart:      number = drawEnd - pixelHeight;

          if (drawStart < 0)     drawStart = 0;
          if (drawEnd >= this.size.h) drawEnd = this.size.h - 1;

          // Backwall
          for (let posY: number = drawStart; posY <= drawEnd; posY++) {
            const z = this.zBuffer[(posX * this.size.h) + posY];
            if (z <= perpWallDist) continue;

            this.zBuffer[(posX * this.size.h) + posY] = perpWallDist;

            std.setConsoleCursorPosition({x: posX, y: posY});
            std.writeConsole(side ? "█" : "░", {
              fgColor: entry.fgColor,
            });
          }

          // Bottom
          if (drawEnd > lastEnd) {
              for (let posY: number = drawEnd; posY >= Math.max(lastEnd, 0); posY--) {
              const z = this.zBuffer[(posX * this.size.h) + posY];
              if (z <= lastDist) continue;

              this.zBuffer[(posX * this.size.h) + posY] = lastDist;

              std.setConsoleCursorPosition({x: posX, y: posY});
              std.writeConsole("░", {
                fgColor: entry.fgColor,
              });
            }
          }

        // Top
          if (lastStart > drawStart && entry.z >= -entry.height) {
            for (let posY: number = drawStart; posY <= Math.min(lastStart, this.size.h - 1); posY++) {
              const z = this.zBuffer[(posX * this.size.h) + posY];
              if (z <= lastDist) continue;

              this.zBuffer[(posX * this.size.h) + posY] = lastDist;

              std.setConsoleCursorPosition({x: posX, y: posY});
              std.writeConsole("▓", {
                fgColor: entry.fgColor,
              });
            }
          }

          lastIndex = lastStart = lastEnd = -1;
        }

        if (mapPos.x < 0 || mapPos.x >= MAP_WIDTH || mapPos.y < 0 || mapPos.y >= MAP_HEIGHT) {
          boundStep++;
          continue;
        }

        const mapIndex: number = MAP[(mapPos.y * MAP_WIDTH) + mapPos.x];
        if (mapIndex <= 0) continue;

        const entry = MAP_ENTRIES[mapIndex];
        const perpWallDist: number = side ? (sideDist.y - deltaDist.y) : (sideDist.x - deltaDist.x);
        const lineHeight:   number = Math.floor(this.size.h / perpWallDist);
        const pixelHeight:  number = Math.floor(lineHeight * entry.height);
        const baseY:        number = Math.floor(this.size.h / 2 + lineHeight / 2 - lineHeight * entry.z);

        let drawEnd:        number = baseY;
        let drawStart:      number = drawEnd - pixelHeight;

        if (drawStart < 0)     drawStart = 0;
        if (drawEnd >= this.size.h) drawEnd = this.size.h - 1;

        for (let posY: number = drawStart; posY <= drawEnd; posY++) {
          const z = this.zBuffer[(posX * this.size.h) + posY];
          if (z <= perpWallDist) continue;

          this.zBuffer[(posX * this.size.h) + posY] = perpWallDist;

          std.setConsoleCursorPosition({x: posX, y: posY});
          std.writeConsole(side ? "█" : "▒", {
            fgColor: entry.fgColor,
          });
        }

        if (entry.height < 1 || Math.abs(entry.height) >= 0.5) {
          lastStart = drawStart;
          lastEnd   = drawEnd;
          lastIndex = mapIndex;
          lastDist  = perpWallDist;
        }
      }
    }
  }

  public Enter() {
    this.size    = this.pc.std.getConsoleSize();
    this.zBuffer = new Array(this.size.h * this.size.w);

    this.ClearScreen(this.pc.std);
  }

  public Update(dt: number) {
    const { std } = this.pc;
    this.time += dt;

    this.HandleInputs(dt);

    if (this.openDoor) MAP_ENTRIES[6].z = Math.max(MAP_ENTRIES[6].z - dt, -MAP_ENTRIES[6].height - 0.1);
    else               MAP_ENTRIES[6].z = Math.min(MAP_ENTRIES[6].z + dt, 0);

    // Orbitting Penger
    this.entities[1].position.x = Math.cos(this.time) + 4.5;
    this.entities[1].position.y = Math.sin(this.time) + 10;
    this.entities[1].z = Math.sin(this.time);

    // Clearing console and Z-Buffer
    this.ClearScreen(std);

    // Render order is as follows:
    // 1. Background
    // 2. Floor and Ceiling (planes, not cubes!)
    // 3. Sprites
    // 4. Cubes (tops and bottoms included!)
    this.RenderBackground(std);
    this.RenderFloorAndCeiling(std);
    this.RenderSprites(std);
    this.RenderCubes(std);
  }

  public Exit() {
    const { std } = this.pc;
    this.ClearScreen(std);


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
    this.raycaster.Enter();

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