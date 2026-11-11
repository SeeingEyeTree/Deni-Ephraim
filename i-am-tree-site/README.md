# I am Tree — project tree site

A 3D blue tree; each glowing branch is a project. Static files only, no server code.

## Run it

Everything the browser needs is in `public/`. It has to be served over http (a page opened
straight from disk cannot load the model):

    python -m http.server 8080 --directory public      # then open http://localhost:8080

To publish, upload the contents of `public/` to any static host. For GitHub Pages: put those
files in a repo (root or `docs/`) and turn Pages on.

## Add or change projects

Edit `public/projects.js`. No build step. Ten entries, one per branch. An entry with `stub: true` is an unlit branch; fill it in and delete that line to light it.
The fields are described at the top of that file. `yoursite/#slug` links straight to a project.

## Change what hangs on a branch

Each project can show its own object at the branch tip, which is what the camera zooms in on.
Drop a file into `public/assets/` and point the project at it in `projects.js`:

    leaf: { image: "assets/picture.png", size: 1.2 }                  // a picture, always faces the viewer
    leaf: { model: "assets/thing.glb", size: 1.2, spin: true, turn: 0 }  // a 3D model

Models are centred and scaled automatically so the longest side equals `size` (metres).
Leaves and twigs between the camera and the object are hidden while a project is open.
Without `leaf`, the branch gets the default glowing leaf.

`assets/builder_bot.glb` is an original placeholder robot (source: `tools/build_bot.py`).
Beyond All Reason's own unit models are licensed CC-BY-NC-ND and their licence file rules out
use outside the game, so they are not included here.

## Files

    public/index.html              page, styles
    public/projects.js             your projects (edit this)
    public/app.js                  bundled script (three.js + src/main.js)
    public/assets/blue_tree.web.glb  the tree, quantized for the web (2.7 MB)
    src/main.js                    source for app.js

Change `src/main.js`, then rebuild with `npm install` once and `npm run build`.

## Performance

- Scene budget: about 133k triangles and 67 draw calls with all ten branches lit.
- Wind runs in the vertex shader; per-frame script work is about 1 ms.
- No shadow maps and no post-processing: the glow is an emissive material plus additive shells.
- Pixel ratio is capped at 2. If the page averages under ~48 fps for two seconds it steps down,
  one step at a time: pixel ratio 1.5, pixel ratio 1, no falling leaves or leaf flutter,
  then no wind and no halos.
- Press `P` (or open `#perf`) for live fps, frame time, draw calls and the current quality step.
- `prefers-reduced-motion` turns off wind, auto-rotate and camera flights.

## Which branches carry projects

`SLOT_BOUGHS` at the top of `src/main.js` lists the ten branches (of the model's fourteen) used,
in project order. They were picked from the finished model so their tips sit far apart.
