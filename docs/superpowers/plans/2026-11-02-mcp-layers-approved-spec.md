# Mejora del MCP de ambos forks — diseño v1

Fecha: 2026-11-02. Estado: propuesta revisada, pendiente de aprobación de esta versión. No se ha modificado ni instalado código.

## Resultado esperado

Cambiar un titular o mover una imagen modifica únicamente ese elemento. El fondo y los recursos ajenos a la operación conservan sus referencias y bytes. ImageGen solo interviene al solicitar un recurso raster nuevo o una modificación raster. La vista previa y la exportación reflejan el maestro editable.

## Evidencia del código actual

- Base digital d391b3f1e; base impresión 605e85caee; ambos checkouts limpios al inspeccionar.
- apps/daemon/src/mcp.ts ofrece herramientas de archivos y ejecuciones; no expone generación/espera de medios ni operaciones de capas.
- routes/media.ts ya ofrece generación por proyecto, historial persistido de tareas y espera con cursor y límite de 25 segundos. Reutilizar estas rutas y su autorización; no lanzar Electron desde PowerShell para capturar resultados.
- La edición de impresión ya tiene SceneObject (texto, imagen, rectángulo, elipse, path y grupo), orden por arrays, IDs, opacidad y visibilidad. PrintStore.save valida y aplica expectedRevision; reutilizar este modelo.
- Su MCP print_document permite guardar el documento completo y consultar recursos, pero no importar recursos ni modificar objetos concretos.
- La edición digital admite fuentes HTML/CSS/SVG arbitrarias. No existe una representación universal de capas que permita editar cualquier proyecto automáticamente.

## Alternativas

1. Solo mejorar instrucciones: bajo coste, pero no garantiza conservación ni ofrece operaciones verificables.
2. Añadir operaciones a los contratos existentes y un formato digital gestionado optativo (recomendada): edición real, pruebas de conservación y compatibilidad con proyectos anteriores.
3. Crear un editor universal nuevo: alcance innecesario para este objetivo.

## Contrato propuesto

### Compartido

Exponer herramientas para listar tareas de medios por proyecto, consultar una tarea y esperar con cursor. La respuesta conserva estado, progreso, error y archivos reales. Una espera agotada sigue pendiente; nunca se convierte en fallo ni provoca una repetición automática de generación.

Exponer generación de imagen que retorne taskId inmediatamente, con proveedor nativo de suscripción por defecto y sin fallback silencioso. Operación de escritura no reintentable automáticamente. Nuevos resultados se guardan con nombres versionados, sin sobrescribir originales ni actualizar la composición hasta completar y validar el recurso.

Propagar el contexto de workspace a todas las llamadas por proyecto. Consultar primero autorización del proyecto; tareas de otro proyecto no pueden leerse ni asociarse. Usar resolución y validación de rutas existentes; no aceptar rutas arbitrarias del sistema.

### Composición digital gestionada

Formato versionado optativo con tamaño del lienzo, revisión, IDs estables, roles (fondo, texto, imagen, forma), referencias de recursos y orden. El mismo modelo genera la vista HTML/SVG; no mantener un mapa desvinculado del diseño real. Textos y atributos se serializan con escape seguro; no admitir scripts ni markup arbitrario como contenido de una capa.

Operaciones: crear composición; obtener composición/capas; agregar, actualizar, eliminar y reordenar un elemento. Toda escritura exige revisión esperada y devuelve conflicto ante modificaciones concurrentes. Confirmar con pruebas que la transacción no altera capas hermanas ni originales. Los proyectos digitales arbitrarios siguen accesibles por sus herramientas actuales; se informa claramente que no están gestionados. No convertir automáticamente archivos existentes ni prometer reconstrucción de imágenes aplanadas.

### Edición de impresión

Reutilizar PrintDocument y SceneObject. Agregar operaciones por página/objeto para inserción, modificación, eliminación y orden, con expectedRevision obligatorio y validación del documento completo antes de guardar. No permitir modificar IDs ni sustituir perfiles, páginas o recursos mediante un parche de objeto.

Importar al almacén inmutable recursos existentes del proyecto mediante rutas autorizadas y el validador real de imágenes; exponer la referencia resultante. Conservar ICC, medidas físicas, fuentes, preflight y exportación actuales. Transparencia no supone aprobación para imprenta.

### Transparencia e iteración

Admitir PNG con alpha como recurso superpuesto. Informar dimensiones, hash y evidencia de alpha del archivo decodificado; distinguir canal alpha de presencia efectiva de píxeles transparentes. No prometer que el proveedor genere transparencia si su ruta no permite solicitarla/verificarla. Un cambio de texto o geometría no llama a ImageGen. La generación completa sigue siendo una operación explícita separada.

## Pruebas y aceptación

- Pruebas primero: edición de texto conserva hashes del fondo y hermanos; sustitución de una imagen conserva las demás; orden y grupos se mantienen.
- Conflictos de revisión, IDs inexistentes/duplicados, escape de rutas, recursos ausentes, contenido inseguro y autorización entre proyectos se rechazan sin cambios parciales.
- Espera pendiente, completada, fallida e interrumpida; cursor incremental y recuperación tras reinicio desde historial persistido.
- PNG opaco y transparente decodificados; ninguna afirmación de transparencia basada solo en extensión.
- Pruebas focalizadas, guard y typecheck en ambos repositorios antes de publicar.
- Validación MCP mediante cliente nuevo contra cada runtime: listado, creación de una composición diagnóstica, edición parcial, reapertura y comparación de recursos. Verificación visual del resultado y PDF diagnóstico de impresión conservando sus limitaciones declaradas.
- Una generación nativa real de diagnóstico si la interfaz de generación cambia; no regenerar trabajos del usuario.

## Entrega e instalación

Mantener ambos forks en 0.26.1 con incremento de revisión propio. Backup coherente y comprobación de operaciones activas antes de sustituir cada instalación. Si hay trabajo activo, dejar el paquete preparado sin interrumpirlo. Conservar configuración global, instrucciones por capas, aislamiento de impresión y actualizador oficial desactivado. Publicar commits en los forks autorizados, sin force-push ni PR upstream. Informar capacidades realmente probadas, herramientas añadidas y límites.

## Revisión del diseño

No requiere un nuevo editor generalista, no migra proyectos previos y no confunde metadatos con composición real. Resuelve tanto conservación de assets como edición renderizada y seguimiento de generación. La aprobación de este diseño autoriza implementar, probar y actualizar ambos forks dentro de este alcance.
