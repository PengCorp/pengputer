import { loadFont9x16 } from "../Screen/font9x16";
import { Screen } from "../Screen";
import { Keyboard } from "../Keyboard";

(async () => {
  await loadFont9x16();

  const screen = new Screen();
  await screen.init(document.getElementById("screen-container")!);

  const keyboard = new Keyboard();

  screen.clear();
  screen.drawSomeText();
  screen.displayString({ x: 1, y: 15 }, "Get scrolled, nerd :P");

  let lastTime = performance.now();
  const cb = () => {
    const dt = performance.now() - lastTime;
    lastTime = performance.now();
    screen.draw(dt);
    keyboard.update(dt);
    requestAnimationFrame(cb);
  };
  requestAnimationFrame(cb);

  const readLine = async () => {
    let unsubType;
    const onType = (char: string, key: string) => {
      if (char) {
        screen.printChar(char);
      }
      if (key === "ArrowUp") {
        screen.setCursorPositionDelta({ x: 0, y: -1 });
      } else if (key === "ArrowDown") {
        screen.setCursorPositionDelta({ x: 0, y: 1 });
      } else if (key === "ArrowLeft") {
        screen.setCursorPositionDelta({ x: -1, y: 0 });
      } else if (key === "ArrowRight") {
        screen.setCursorPositionDelta({ x: 1, y: 0 });
      } else if (key === "F1") {
        screen.scrollUpRect({ x: 1, y: 1, h: 4, w: 4 }, 1);
      } else if (key === "F2") {
        screen.scrollUp(1);
      } else if (key === "F3") {
        screen.scrollDownRect({ x: 1, y: 1, h: 4, w: 4 }, 1);
      } else if (key === "F4") {
        screen.scrollDown(1);
      }
      // unsubType();
    };
    unsubType = keyboard.addTypeListener(onType);
  };

  await readLine();
})();
