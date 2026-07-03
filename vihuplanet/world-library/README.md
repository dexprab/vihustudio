# World Library

The World Library is where hand-generated artwork for the Hero lives.
It replaces hardcoded filenames with a folder-based lookup: the Hero
asks for an object **type** (a cloud, a tree, a story-home, ...) and
renders whatever is sitting in the matching folder. If nothing is
there yet, the Hero keeps rendering its existing hand-drawn SVG
placeholder — the World Library is additive, never a hard dependency.

See `MEP-01` in `../CHANGELOG.md` and `../BUILD.md` for the sprint that
introduced this pipeline, and `shared/worldLibrary.js` for the
provider module itself.

## Structure

```
world-library/
├── companions/
├── decorations/
├── dreaming-home/
├── effects/
├── fonts/
├── nature/
│   ├── clouds/
│   ├── flowers/
│   ├── rocks/
│   ├── shrubs/
│   ├── trees/
│   └── waterfalls/
├── skies/
├── sounds/
├── story-homes/
└── textures/
```

Folder names are fixed — do not rename them. `effects/`, `sounds/`,
`fonts/`, and `textures/` are reserved for future object types; they
are not yet wired into any renderer.

## Adding artwork

1. Generate the artwork.
2. Resize it (GIMP or any image editor).
3. Export as a **transparent PNG** and copy it into the matching
   folder below.
4. Refresh the Hero. No code changes, no manifest to edit.

| Object type     | Folder                        | Used by                          |
|------------------|--------------------------------|-----------------------------------|
| `sky`            | `skies/`                       | Hero sky background               |
| `story-home`     | `story-homes/`                 | The four storyteller planets      |
| `dreaming-home`  | `dreaming-home/`                | *(reserved — see note below)*     |
| `tree`           | `nature/trees/`                 | *(no Hero landmark yet)*          |
| `flower`         | `nature/flowers/`               | Ground flowers                    |
| `cloud`          | `nature/clouds/`                | Sky clouds                        |
| `rock`           | `nature/rocks/`                 | *(no Hero landmark yet)*          |
| `shrub`          | `nature/shrubs/`                | *(no Hero landmark yet)*          |
| `waterfall`      | `nature/waterfalls/`            | *(no Hero landmark yet)*          |
| `decoration`     | `decorations/`                  | *(no Hero landmark yet)*          |
| `companion`      | `companions/`                   | *(reserved — see note below)*     |

Multiple PNGs in the same folder are all picked up — objects that
appear more than once on the Hero (clouds, flowers, story-homes) cycle
through whatever's available instead of all showing the same image.

## How discovery works

`WorldLibrary.resolve(type)` fetches the folder and reads the
directory listing the static file server returns for it. Local dev
servers (`python -m http.server`, most `serve`/`live-server` tools)
expose this automatically. If the server the Hero is deployed on
doesn't expose directory listings, `resolve()` simply finds nothing
and every object falls back to its existing SVG — the Hero keeps
working exactly as before this sprint.

## Note — Dreaming Home & Companion

`dreaming-home/` and `companions/` exist in the structure and the
provider supports both types, but the current Dreaming Planet renderer
(`dreamingPlanet/`) is **not** wired to them yet. Its sphere SVG isn't
a plain illustration — internal groups (`dp-eyes-open`,
`dp-mouth-yawn`, `dp-companion`, ...) drive the whole Companion
Awakening Sequence via CSS. Swapping it for a flat PNG would silently
break that state machine, which MEP-01 is explicitly scoped to
preserve. A future sprint can wire these types in once there's a
plan for keeping the stateful animation intact.
