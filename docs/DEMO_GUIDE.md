# Guía de demo comercial

Esta guía prepara una demostración local de Comercia ERP usando datos ficticios de una tienda de repuestos, gomas, lubricantes y accesorios. Ningún dato debe presentarse como real o fiscalmente válido.

## Preparación

La base debe ser local y tener las migraciones aplicadas. El seed exige confirmación explícita y nunca elimina información:

```powershell
$env:CONFIRM_SEED_DEMO="true"
npm run db:seed-demo
```

Puede ejecutarse varias veces: actualiza los registros demo identificados y no los duplica. Está bloqueado con `NODE_ENV=production` y para hosts de base de datos que no sean `localhost`, `127.0.0.1` o `::1`.

## Credenciales

Todos los usuarios de empresa usan la contraseña local `Demo12345!`.

| Perfil | Usuario |
| --- | --- |
| Dueño | `owner@demo.local` |
| Administrador | `admin@demo.local` |
| Cajero | `cajero@demo.local` |
| Vendedor | `vendedor@demo.local` |
| Almacén | `almacen@demo.local` |
| Contabilidad | `contabilidad@demo.local` |

Platform Admin conserva su seed independiente: `admin@platform.local` / `Admin12345!` en entorno local.

## Empresa y sucursales

- Repuestos El Capitán SRL, RNC ficticio `131999999`, moneda DOP e ITBIS 18 %.
- Sucursal Principal — Santo Domingo (`SDQ`).
- Sucursal Santiago (`STI`).
- Sucursal La Vega (`LAV`).

Los perfiles Dueño, Administrador, Almacén y Contabilidad acceden a todas. Vendedor accede a SDQ y STI; Cajero solamente a SDQ.

## Flujo recomendado

1. Iniciar en `/login` como `owner@demo.local` y presentar el dashboard.
2. Cambiar la sucursal activa desde la cabecera y comparar el inventario en `/inventory`.
3. Mostrar productos sin stock, bajo mínimo y con disponibilidad suficiente.
4. Abrir `/pos`, buscar `BKR6E` o escanear `890100000001`: en SDQ la bujía NGK no tiene stock.
5. Abrir sus compatibilidades y elegir Denso K20PR-U o Bosch FR7DC con stock.
6. Agregar la alternativa al carrito y completar una venta usando la caja abierta del día.
7. Revisar `/cash`, `/sales` y el documento interno imprimible.
8. Abrir `/financial-dashboard` y comparar ventas por fecha, sucursal y método de pago.
9. Recorrer `/reports` y sus reportes de ventas, caja, inventario, clientes y documentos.
10. En `/data-export`, exportar productos o inventario y generar el backup XLSX multihoja.
11. Mostrar las transferencias SDQ → STI y STI → LAV en `/inventory/transfers`.
12. Revisar `/fiscal/settings` y `/fiscal/electronic-invoices`; remarcar el aviso de ambiente mock.
13. Mostrar usuarios, permisos reales y asignación de sucursales en `/settings/users` y `/settings/branches`.
14. Cerrar sesión y entrar a `/platform/login` para enseñar Platform Admin, planes y billing SaaS ya existentes.

## Datos destacados

- 14 productos, un servicio, 9 categorías, 10 marcas y 6 unidades.
- Existencias diferentes para los 14 productos en cada una de las 3 sucursales.
- Grupo de equivalencias BKR6E, cuatro códigos OEM y dos sustitutos bidireccionales.
- 6 clientes ficticios.
- 8 ventas distribuidas entre hoy, la última semana y el mes; incluye efectivo, tarjeta, transferencia, crédito y una cancelación.
- Una caja abierta y dos cajas históricas cerradas.
- 2 transferencias, 4 documentos internos y 2 documentos fiscales mock.

## Limitaciones conocidas

- El proveedor fiscal es una simulación sandbox. No envía datos a DGII y no genera e-CF productivo.
- Los pagos SaaS y links públicos son flujos internos/manuales existentes; no hay pasarela real ni webhooks.
- El backup es una exportación XLSX básica. No existe restauración ni automatización de backups.
- El seed actualiza el stock demo a valores de presentación determinísticos. Use una nueva base local o vuelva a ejecutar el seed antes de cada demo si durante la sesión se realizaron ventas.
- Las credenciales son deliberadamente memorables y solo deben usarse en desarrollo/demo local.
