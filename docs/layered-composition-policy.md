# Default layered composition policy

User preference recorded on 2026-10-21, shared by both Local Codex forks.

## Distinguish the background and iterate only affected elements

Before composition or iteration, inspect the editable source and assets. Maintain
a project composition map with stable element IDs, role, asset/source reference
and stacking order: background (image, color or gradient), text/typography,
logos, shapes and every overlaid image. A flattened preview is not the background.
If only a flattened raster exists, identify baked elements and the limits of
editing; do not claim separate layers or reconstruct them without authorization.

For each iteration classify elements as **preserve**, **edit** or **generate**.
Reuse unchanged assets. Edit typography, copy, prices, positions, sizes, layout
and vector shapes in the composition without ImageGen. Generate/edit only the
specific raster asset that needs it; never send the entire artwork to ImageGen
as a shortcut for editing a layer. A changed overlay preserves the background
and sibling layers; a changed background preserves overlays. Verify unchanged
asset references/content and stacking. Whole-design regeneration requires the
user's explicit request and the project's approved scope. Flattened exports
never replace the editable master.

- Generate clean base images. Keep editable headlines, prices, calls to action,
  supplied logos and graphic overlays outside the raster image.
- Compose text, logos, shapes and graphics as independently editable elements:
  HTML/CSS/SVG for digital work and document objects/resources for print work.
- Preserve original generated files and reuse them across iterations. A text,
  typography, position, size or overlay-color revision does not authorize
  regenerating or replacing unchanged images. Change only the requested asset.
- Consider additional generated transparent images as independent layers when
  useful. Request real transparency when supported; inspect alpha and edges.
  White backgrounds or baked checkerboards are not transparency. Report missing
  capabilities rather than claiming a successful transparent cutout.
- Keep the editable source and asset references as the master; flattened exports
  are derivatives. Preserve stacking order and aspect ratios. Extra layers must
  serve the composition, not increase asset count without purpose.
- Print work retains original RGB resources, actual resolution and ICC evidence.
  Output conversion follows the approved job; no proprietary editor is required.
- Explicit user exceptions and the project's approvals/scope still apply.
  This is a forward-looking default, not permission to reconstruct old designs.

The complete Spanish rule is stored in each installed application's persistent
user-level `customInstructions`, appended without deleting previous instructions.
The daemon forwards that setting to both legacy and OD Next prompt composition.
No binary rebuild is needed to activate this existing settings path. Preserve
the setting and this policy during future fork upgrades. Project-level explicit
instructions may override the user-level default by the application's contract.
