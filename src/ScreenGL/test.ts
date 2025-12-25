import "./test.scss";
import { TerminalRenderer } from "./TerminalRenderer";

(async () => {
  const canvas = document.getElementById("c") as HTMLCanvasElement;
  const gl = canvas.getContext("webgl2");

  if (!gl) {
    throw new Error("Failed to get webgl2 context.");
  }

  const tr = await TerminalRenderer.create(canvas, gl);

  const render = () => {
    tr.render();
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
})();
