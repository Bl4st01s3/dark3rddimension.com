# Hologram 3D Models Directory

1. 3D EMBLEM OF YOUR 2D LOGO (`assets/models/emblem/`)
   - Drop your 3D model of the 2D emblem logo into `assets/models/emblem/` named `1.stl`, `1.step`, `1.glb`, `1.obj`, etc.
   - Update `logo_emblem.counts` in `js/holo-models.js` (e.g., set `"stl": 1` or `"step": 1`).
   - This model loads immediately on page startup, stays facing forward (does not spin), gently sways and tilts in 3D when you move your mouse over it, and uses the glowing hologram shader + cyan feature edges.
   - If all counts in `logo_emblem.counts` are `0`, it falls back to the 2D PNG logo.

2. 3D SPINNING LOGO CUBE (`assets/models/logo/`)
   -Shown on the 1st click.
   - If all counts in `logo_cube.counts` are `0`, the site automatically displays the built-in stylized 3D hologram cube wrapped with your Cyan logo.
   - Or drop a custom model (`1.glb`, `1.stl`, `1.step`, etc.) into `assets/models/logo/` and set its count to `1` in `js/holo-models.js`.

3. WIREFRAME MODELS (`assets/models/`)
   - Drop your 3D models into `assets/models/` numbered sequentially by file type:
     - `1.step`, `2.step`, ...
     - `1.stl`, `2.stl`, ...
     - `1.glb`, `2.glb`, ...
     - `1.obj`, `2.obj`, ...
   - Update `wireframe_models.counts` in `js/holo-models.js` with how many files of each type you have.
   - Clicking the hologram on the website cycles:
     3D Emblem Logo -> 3D Spinning Logo Cube -> Each Wireframe Model -> back to 3D Emblem Logo.
