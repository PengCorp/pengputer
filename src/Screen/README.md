# Notes

## Sheet scale

The scale of the sheet you must use depends on the RENDER_SCALE constant. If RENDER_SCALE is set to 2 you must use 2x sheets. If you have lower scale (pixel-perfect sheets) scale them up to 2x with nearest-neighbor. If you have higher scale sheets scale them down with bilinear filtering.

Please include both original (pixel perfect 1x or higher scale, e.g. 4x) and $RENDER_SCALEx sheets in the repo for easier editing.
