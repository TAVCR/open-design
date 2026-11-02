# Managed composition and media MCP

Both Local Codex editions expose five additive tools: composition, generate_image, list_media_tasks, get_media_task, wait_media_task. Existing project/file/run tools retain their contracts.

The composition tool is opt-in. Create with inputs {expectedRevision:null,composition:{width:800,height:600,layers:[]}}. Layers are back-to-front, with stable id, type image/text/shape, role background or matching type, x/y/width/height and optional opacity/hidden. Images use a project-local PNG/JPEG path. Text requires text/fontSize/fontFamily/fill; shapes use fill and optional radius. Colors use six/eight-digit hex. Insert accepts index; update uses layerId and patch; delete uses layerId; reorder requires every layer ID exactly once. Mutations require the current expectedRevision. Re-read after a conflict. Updates cannot change identity/type/role.

The editable master is composition.html, embedding the versioned scene and rendered SVG in one atomic write. The returned entryFile/previewUrl open the actual composition. No automatic conversion of existing HTML or flattened artwork is performed. Ordinary file tools can still edit arbitrary projects; revision guarantees apply to the managed API, not arbitrary external file writes. Text is plain text without automatic wrapping/advanced typography; the initial shape primitive is a rectangle with optional corner radius.

inspect_asset inputs {path} decodes PNG/JPEG to report dimensions, bytes, SHA256, declared alpha and actual transparent pixels. Limits:32MiB/16MP raster,1000 layers and2MiB scene text. The provider route does not expose a reliable transparent-background option: do not claim it does. Imported transparent PNGs can be used independently as overlays.

generate_image accepts prompt, optional aspect/quality and up to8 project-relative reference images; native subscription model selection is fixed and output uses a new UUID name. It returns taskId asynchronously, never replaces a layer automatically and never falls back silently. List tasks before repeating an ambiguous submission. get/wait require taskId and optional since; wait supports timeoutMs0..25000 and returns nextSince. Preserve pending state across empty intervals. Persisted tasks can be read after daemon restart. Actual model backend identity is not independently exposed.

Both workspace headers accompany all project requests. The daemon checks project authority and canonical project paths, including imported-folder metadata; reference symlinks cannot escape the root. Image outputs are checked before generation and before writing.

The printing edition additionally extends print_document with layers (inputs pageId optional), mutate_layer (operation,expectedRevision,pageId plus objectId/patch, object/index/parentId or order), and import_project_resource ({projectId,path}). Imported resources are validated immutable copies. Print patches cannot replace IDs/types/groups or alter unrelated profiles/pages. The complete candidate is validated and existing ICC/preflight/PDF validation limits remain in force. PNG/JPEG imports only; TIFF keeps its existing upload/color workflow.

No tool operation implies approval of a creative brief or additional deliverables. New native tools require a fresh MCP client connection; an existing chat may cache the old schema until reconnect/restart.
