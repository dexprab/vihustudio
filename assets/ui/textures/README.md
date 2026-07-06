# Textures

## Purpose

Shared paper-grain / watercolor wash textures reused across UI surfaces.
The current implementation generates a paper-grain texture inline as an
SVG data URI in CSS (`.creation-scene-paper` in `css/style.css`) — a
hand-painted replacement belongs here.


## Ownership

VihuStudio product/design.


## Expected Asset Types

- texture-paper-grain.webp
- texture-watercolor-wash.webp

## Naming Convention

`texture-<name>.webp`.


## Example Usage

Swapping `.creation-scene-paper`'s inline SVG `feTurbulence` filter for `background-image:url('assets/ui/textures/texture-paper-grain.webp')`.

