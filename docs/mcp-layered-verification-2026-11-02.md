# Mejora del MCP de ambos forks

Verificada e instalada el 2026-11-02. Base oficial conservada:0.26.1. Esta es una mejora propia de Local Codex, no una nueva versión oficial.

| Edición | Versión instalada | Herramientas MCP | Skills leídas después de reabrir |
|---|---|---:|---:|
| Digital | 0.26.1-codex.2 | 27 (antes22) | 169 |
| Impresión | 0.26.1-print.2 | 28 (antes23) | 170 |

## Capacidades añadidas

- Composición digital gestionada opcional: fondo, texto editable, formas e imágenes superpuestas con IDs, orden, opacidad y visibilidad. Crear, consultar, insertar, editar, eliminar y reordenar. Un maestro HTML guarda modelo y vista renderizada de forma atómica.
- Edición parcial con revisión obligatoria. Un cambio de texto no llama a ImageGen; los fondos y recursos ajenos se conservan. Se rechazan revisiones antiguas, recursos ausentes y campos no admitidos.
- Generación nativa de una imagen con nombre único; consultar/listar/esperar tareas por proyecto con cursor. Una espera sin novedades no se interpreta como fallo ni repite la generación. Los resultados persistidos se consultan tras reiniciar.
- Inspección de PNG/JPEG: dimensiones, bytes, SHA256, canal alpha y transparencia efectiva.
- Impresión: operar sobre objetos concretos, incluidos grupos y orden de hermanos; importar una imagen de proyecto al almacén inmutable conservando el original.
- Corregida la raíz de generación en proyectos importados y bloqueadas referencias/salidas que escapan por symlinks o junctions.

## Verificación

- 84 pruebas focalizadas digitales y112 de impresión, sin fallos. Son suites seleccionadas por el cambio; no la suite completa.
- guard y typecheck de ambos repositorios aprobados; revisión independiente del código sin bloqueos.
- Ambos builds finalizaron con código0; instalador digital aplicado con código0; impresión usa su distribución independiente sin instalador. Arranque por los accesos normales, ventana visible, versión correcta y actualizador oficial desactivado.
- MCP real mediante clientes stdio nuevos en ambas instalaciones: herramientas descubiertas, proyectos diagnósticos, generación real Codex, edición parcial, reordenado, transparencia y rechazo de revisión antigua.
- Cierre y reapertura de ambas aplicaciones: el maestro conserva su revisión y el resultado de ImageGen vuelve a consultarse como done, con proveedor codex y los mismos hashes.
- Inspección visual de ambas composiciones en la aplicación y del editor nativo de impresión. PDF abierto/renderizado independientemente con Poppler; texto independiente y fondo presentes.
- Conservados los27 proyectos/9638 archivos originales digitales y3 proyectos/64 archivos originales de impresión del respaldo. Instrucciones persistentes por capas y configuración global Codex sin cambios.
- Revisión final de actividad:28 proyectos digitales y4 de impresión, cero ejecuciones y cero tareas de medios activas.

## Evidencia nativa

- digital: proyecto `mcp-layers-20261102-digital`; tarea `5743aa89-5058-4b51-8e51-8b3bf0fadad0`; archivo `mcp-image-fa495755-955d-4d62-9008-c58c8b2e7bb9.png`; 1152934 bytes; proveedor `codex`, fallback `False`, stub intencional `False`. SHA256 `3b190f147aaba66642392600a0629a82622740b74634bab491ed974f8905e7ae`.
- print: proyecto `mcp-layers-20261102-print`; tarea `db962f46-4ff5-4d95-9c9b-0763a2966416`; archivo `mcp-image-50150f31-db46-43f2-b981-960763ce89b4.png`; 1158766 bytes; proveedor `codex`, fallback `False`, stub intencional `False`. SHA256 `85ecbbe4bf6050acd6686cb597b1d610a6aa331787743ccaf638985857d2da25`.

PDF diagnóstico:1 página, 1409794 bytes, 1 fuente incrustada y 2 imágenes. SHA256 `692391aace0e319c607b5d069062609365063490e87380e3cbba32192739bccf`.

## Límites

- No convierte automáticamente proyectos HTML arbitrarios ni reconstruye capas de una imagen aplanada. Las garantías transaccionales corresponden a la API gestionada; las herramientas genéricas de archivos siguen disponibles.
- Texto plano, sin maquetación tipográfica avanzada/ajuste automático de líneas; forma digital inicial rectangular con radio opcional. La impresión conserva sus primitivas existentes.
- Se pueden superponer PNG transparentes y verificar sus píxeles. La interfaz nativa actual de generación no garantiza un fondo transparente: no se añadió un parámetro ficticio.
- PDF de revisión ordinario con ICC, no PDF/X certificado ni listo para imprenta. El diagnóstico advierte PPI y sangrado insuficientes, además de verificaciones no realizadas. No se han suprimido estas advertencias ni convertido los colores.
- El modelo backend real de ImageGen no se identifica independientemente.
- Los clientes MCP abiertos pueden conservar la lista antigua: reconectar el MCP o abrir un chat nuevo para descubrir las nuevas herramientas.

## Recuperación y trazabilidad

- Backups coherentes de4 bases SQLite digitales y10 de impresión (integrity_check aprobado), configuración, originales e instalador anterior en `K:/od-fork/backups/2026-11-02-mcp-layers` y `K:/local-codex-print-runtime/backups/2026-11-02-mcp-layers`. No se sobrescribió el checkout original de impresión con cambios del usuario.
- Código digital compilado:`0321626a4`; impresión:`6608f0160f`. Repositorios autorizados TAVCR/open-design y TAVCR/local-codex-print.
- Instalador digital SHA256:`b81e468bda44d1ede4f3a58cbef8d5796c969c61181c5f7c32948060b7a1525d`.
- Ejecutable de impresión SHA256:`32a4e09701d8ca0011c20f04a6bbeb3e012447b22312c9060b7c9025327f7669`.
- Las capturas y resultados detallados de diagnóstico están en work del proyecto de mantenimiento; no son entregables gráficos de cliente.
