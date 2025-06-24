import { Keyboard } from "../Keyboard";
import { Screen } from "../Screen";

export class Std {
  private screen: Screen;

  private keyboard: Keyboard;

  constructor(screen: Screen, keyboard: Keyboard) {
    this.screen = screen;
    this.keyboard = keyboard;
  }

  clearScreen() {
    return this.screen.clear();
  }

  getScreenSizeInCharacters() {
    return this.screen.getSizeInCharacters();
  }

  getScreenSizeInPixels() {
    return this.screen.getSizeInPixels();
  }

  getScreenCharacterSize() {
    return this.screen.getCharacterSize();
  }
}
