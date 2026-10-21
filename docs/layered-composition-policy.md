# Default layered composition policy

User preference recorded on 2026-10-21, shared by both Local Codex forks.

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
