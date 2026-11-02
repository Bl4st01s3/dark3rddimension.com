/**
 * Hologram 3D Model Registry
 *
 * Works just like the image counts in `js/projects.js`:
 *
 * 1. `logo_emblem` (Default front-facing emblem on page load - does NOT spin, tilts in 3D with mouse):
 *    - Drop your model of the 2D logo into `assets/models/emblem/` (e.g. `1.stl`, `1.step`, `1.glb`)
 *      and set its count to `1` in `logo_emblem.counts`.
 *    - If all counts are 0, it falls back to the 2D PNG logo.
 *
 * 2. `logo_cube` (Shown on 1st click - spinning 3D logo cube):
 *    - If all counts are 0, it uses the built-in stylized 3D hologram cube wrapped with your Cyan logo.
 *    - Or drop a model into `assets/models/logo/` and set its count to `1`.
 *
 * 3. `wireframe_models` (Cycled through on subsequent clicks in wireframe/shaded-hologram mode):
 *    - Drop numbered models (`1.step`, `2.step`, `1.stl`, `2.stl`, `1.3mf`, `1.glb`, etc.) into `assets/models/`
 *      and set the count for each file type in `wireframe_models.counts`.
 *    - Use `orientations` to set per-model `[X, Y, Z]` rotation in degrees.
 *      (Tip: Press `O` on your keyboard while viewing any 3D model on the site to open the live
 *      Orientation Tuner, rotate it in 90°/15° steps until it looks right, and copy the `[X, Y, Z]` values!)
 */

const holoModelData = {
  "logo_emblem": {
    "title": "D3D EMBLEM",
    "model_folder": "assets/models/emblem",
    // Optional [x, y, z] rotation adjustment in degrees if your CAD export needs flipping
    "rotation_offset": [0, 0, 0],
    "counts": {
      "step": 0,
      "stp": 0,
      "stl": 1,
      "glb": 0,
      "gltf": 0,
      "obj": 0,
      "3mf": 0,
      "fbx": 0
    }
  },

  "logo_cube": {
    "title": "D3D CORE // 3D LOGO",
    "model_folder": "assets/models/logo",
    "spin_speed": 1.0,
    "rotation_offset": [0, 0, 0],
    "counts": {
      "step": 0,
      "stp": 0,
      "stl": 0,
      "glb": 1,
      "gltf": 0,
      "obj": 0,
      "3mf": 0,
      "fbx": 0
    }
  },

  "wireframe_models": {
    "model_folder": "assets/models",
    "spin_speed": 0.85,
    // Default orientation if a file isn't listed in `orientations` below
    "rotation_offset": [0, 0, 0],
    "counts": {
      "step": 0,
      "stp": 0,
      "stl": 0,
      "glb": 0,
      "gltf": 0,
      "obj": 0,
      "3mf": 2,
      "fbx": 0
    },
    // Per-model HUD titles (remember to put a comma `,` at the end of each line except the last!):
    "labels": {
      "1.3mf": "GRILLS JUST WANNA HAVE FUN STEALTHBURNER FRONT FACE MOD",
      "2.3mf": "CYBERSYNK COMMAND CONSOLE"
    },
    // Per-model [X, Y, Z] orientation in degrees (put a comma `,` at the end of each line except the last!):
    "orientations": {
      "1.3mf": [0, 0, 90],
      "2.3mf": [-90, 0, 0]
    }
  }
};
