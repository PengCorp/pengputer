import { first } from "lodash";

/**
 * Runs an animation loop.
 * Callback is called with delta time since last render and total time loop was running.
 * Callback should return true if it wants to end the loop.
 * Returned promise is resolved when loop ends.
 */
export const runAnimationLoop = (
  callback: (dt: number, totalTime: number) => boolean,
): Promise<void> => {
  let startTime = performance.now();
  let lastTime = startTime;

  return new Promise((resolve) => {
    const doFrame = () => {
      const currentTime = performance.now();
      const dt = currentTime - lastTime;
      const totalTime = currentTime - startTime;
      lastTime = currentTime;

      let shouldQuit = callback(dt, totalTime);

      if (shouldQuit) {
        resolve();
      } else {
        requestAnimationFrame(doFrame);
      }
    };
    requestAnimationFrame(doFrame);
  });
};
