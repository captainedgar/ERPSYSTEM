# Branding e imágenes de productos

## Logo empresarial

Los usuarios con `companies.update` pueden administrar el logo desde **Configuración > Negocio > Branding de la empresa**. Se permiten PNG, JPG y WebP de hasta 2 MB. Se recomienda una imagen cuadrada de 512 × 512 con fondo transparente.

El logo pertenece exclusivamente a la empresa autenticada. Se muestra en la vista imprimible de documentos internos cuando la opción **Imprimir logo** está activa. No se utiliza en facturas SaaS de Platform Admin.

## Imágenes de productos

El formulario de productos acepta una subida local o una URL HTTP/HTTPS. Las subidas admiten PNG, JPG y WebP de hasta 3 MB y se muestran en catálogo, resultados del POS y carrito. Si no existe imagen o la carga falla, se presenta un placeholder con iniciales.

Los archivos locales se guardan bajo `apps/api/uploads/companies/{companyId}/products/`. La base de datos conserva una URL relativa, nunca una ruta absoluta del sistema operativo. `apps/api/uploads/` está excluido de Git.

## Seguridad y operación

- El `companyId` procede de la sesión autenticada.
- SVG, PDF, ejecutables y MIME no permitidos se rechazan.
- Se comprueban extensión, MIME, tamaño y firma binaria básica.
- Los logos e imágenes de catálogo se sirven como recursos públicos controlados; no deben contener información privada.
- El almacenamiento local es apropiado para desarrollo y una instalación única, pero no ofrece replicación, CDN ni respaldo automático.

Para producción se recomienda mover el mismo contrato de URL a almacenamiento administrado como S3, Cloudinary, Supabase Storage o un servicio compatible con S3, aplicando límites, antivirus, CDN y política de retención.
