import "./test.scss";
import cp437_9x16Url from "./cp437_9x16.png";
import { loadTexture, createShader, createProgram } from "./util";
import { TerminalRenderer } from "./TerminalRenderer";

(async () => {
  const canvas = document.getElementById("c") as HTMLCanvasElement;
  const gl = canvas.getContext("webgl2");

  if (!gl) return;

  const tr = new TerminalRenderer(gl);
  await tr.init();

  const render = () => {
    tr.render();
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
})();
