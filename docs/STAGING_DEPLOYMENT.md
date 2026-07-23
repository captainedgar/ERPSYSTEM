# Despliegue de staging

## Objetivo

Preparar una instancia pública y aislada de Comercia ERP para QA con Next.js,
NestJS, PostgreSQL y PayPal Sandbox. Este documento no autoriza producción.

## Arquitectura staging

- Web Next.js y API NestJS públicas por HTTPS.
- PostgreSQL exclusivo de staging.
- Disco persistente para uploads locales.
- PayPal Sandbox con webhook HTTPS hacia la API.

El backend se compila con `npm run build --workspace=apps/api` y arranca con
`npm run start --workspace=apps/api`. La web usa los comandos equivalentes del
workspace `apps/web`. `npm run build` construye todo el monorepo.

## URLs esperadas

```text
APP_PUBLIC_URL=https://staging.example.com
API_PUBLIC_URL=https://api-staging.example.com
CORS_ORIGIN=https://staging.example.com
NEXT_PUBLIC_API_URL=https://api-staging.example.com
```

PayPal retorna a `APP_PUBLIC_URL`; el webhook es
`POST {API_PUBLIC_URL}/billing/webhooks/paypal`; el health público es
`GET {API_PUBLIC_URL}/health`. La web consume `NEXT_PUBLIC_API_URL`.

## Variables de entorno API

| Variable | Uso en staging |
| --- | --- |
| `NODE_ENV=staging` | Activa validación estricta. |
| `DATABASE_URL` | PostgreSQL staging; secreto del backend. |
| `API_PORT` | Puerto, usualmente `3001`. |
| `JWT_SECRET` | Secreto de access token, mínimo 32 caracteres. |
| `JWT_REFRESH_SECRET` | Secreto distinto de refresh, mínimo 32 caracteres. |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Vigencias; defaults `15m` / `7d`. |
| `APP_PUBLIC_URL` / `API_PUBLIC_URL` | URLs HTTPS públicas. |
| `CORS_ORIGIN` | Origen web exacto; nunca `*`. |
| `PAYPAL_ENV=sandbox` | Staging rechaza PayPal Live. |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | Credenciales Sandbox solo del backend. |
| `PAYPAL_WEBHOOK_ID` | Obligatorio en staging y producción. |
| `PAYPAL_CHECKOUT_CURRENCY=USD` | Moneda de checkout. |
| `PAYPAL_DOP_USD_RATE` | Tasa manual, por ejemplo `58.50`. |
| `UPLOADS_DIR` | Ruta absoluta o relativa a `apps/api`; default `uploads`. |
| `BCRYPT_ROUNDS` | Coste de hash; default `12`. |

El código usa `JWT_SECRET`, no `JWT_ACCESS_SECRET`. La carga de imágenes tiene
límite fijo de 3 MB; no se inventa `MAX_UPLOAD_SIZE_MB`. Nunca registrar valores
ni copiar secretos a archivos versionados.

## Variables de entorno Web

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API pública usada por el navegador. |
| `NEXT_PUBLIC_APP_URL` | URL pública informativa para el hosting. |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | ID público solo si se usa PayPal JS SDK. |

El checkout actual es server-side, por lo que el ID PayPal público no es necesario.
Nunca exponer `PAYPAL_CLIENT_SECRET`, DB o JWT como `NEXT_PUBLIC_*`. La autenticación
actual usa Bearer tokens en `localStorage`, no cookies; CORS no usa credenciales.

## Build backend

```powershell
npm install
npm run build --workspace=apps/api
npm run start --workspace=apps/api
```

## Build frontend

`NEXT_PUBLIC_API_URL` debe existir durante el build.

```powershell
npm run build --workspace=apps/web
npm run start --workspace=apps/web
```

## Migraciones Prisma

Con `DATABASE_URL` inyectada por la plataforma:

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
```

El último comando usa `prisma migrate deploy`. No usar `migrate dev` en staging.

## Seeds seguros

Planes y Platform Admin rechazan hosts remotos salvo autorización explícita. Para
staging configure también email, nombre y una contraseña fuerte no predeterminada.

```powershell
$env:ALLOW_SEED_NON_LOCAL_DB="true"
$env:PLATFORM_ADMIN_EMAIL="admin@staging.example.com"
$env:PLATFORM_ADMIN_NAME="Platform Admin Staging"
$env:PLATFORM_ADMIN_PASSWORD="use-el-gestor-de-secretos"
npm run db:seed-saas-plans
npm run db:seed-platform-admin
```

Demo opcional, idempotente, con dos confirmaciones y bloqueado en producción:

```powershell
$env:ALLOW_SEED_NON_LOCAL_DB="true"
$env:CONFIRM_SEED_DEMO="true"
npm run db:seed-demo
```

No dejar banderas activas tras sembrar ni ejecutar demo en producción.

## PayPal Sandbox

La factura sigue en DOP y la sesión congela su conversión a USD. La captura al
retorno es el flujo principal; el webhook completa el pago si el usuario cierra
la ventana. Las credenciales permanecen exclusivamente en la API.

## Webhook PayPal

1. Abrir PayPal Developer Dashboard y elegir la Sandbox App.
2. Crear `https://api-staging.example.com/billing/webhooks/paypal`.
3. Seleccionar `PAYMENT.CAPTURE.COMPLETED`.
4. Guardar el Webhook ID como `PAYPAL_WEBHOOK_ID`.
5. Reiniciar API, revisar provider status y probar un pago Personal Sandbox.

La API verifica firma con PayPal, registra el evento idempotente, valida importe
y moneda y comparte la aplicación transaccional con la captura al retorno.

## Flujo de prueba end-to-end

1. Login empresarial, crear solicitud y aprobarla desde Platform Admin.
2. Pagar con Personal Sandbox.
3. Confirmar retorno, factura `PAID`, solicitud aplicada y nuevo plan.
4. Confirmar webhook y recargar para comprobar que no duplica.
5. Probar logo, producto, venta, documento interno, POS y reportes.
6. Confirmar permisos y aislamiento por `companyId`.

## Uploads en staging

### Estrategia temporal de uploads para staging

`UPLOADS_DIR` puede apuntar a un volumen persistente. Una ruta relativa parte de
`apps/api`; una absoluta permite montar disco. La API sirve logos e imágenes bajo
`/uploads/company-logos` y `/uploads/companies`.

Solo es temporalmente seguro con una instancia y disco persistente. Un filesystem
efímero pierde imágenes en redeploy; varias réplicas divergen. Respaldar el volumen
y migrar antes de producción a Cloudinary, S3, Supabase Storage, Spaces o B2.

## Seguridad mínima

- [ ] JWT fuertes y distintos; secretos fuera de Git.
- [ ] DB staging separada y backups habilitados.
- [ ] HTTPS obligatorio; CORS exacto y sin wildcard.
- [ ] PayPal Sandbox, Webhook ID y firma verificada.
- [ ] Contraseña Platform Admin fuerte y rotada tras seed.
- [ ] Logs sin secretos; `.env` excluido de Git.
- [ ] Uploads de imagen limitados a 3 MB en volumen persistente.
- [ ] Rate limit y Helmet revisados antes de producción (fuera de esta fase).

## Checklist pre-deploy

- [ ] Tests/build pasan; `npm run staging:check` pasa con DB de pruebas.
- [ ] Variables están en gestor de secretos, sin `.env` real versionado.
- [ ] DB creada, migraciones revisadas y seeds autorizados.
- [ ] URLs/certificados HTTPS y PayPal Sandbox listos.
- [ ] Volumen persistente montado para `UPLOADS_DIR`.

## Checklist post-deploy

- [ ] Abrir web; login empresarial y Platform.
- [ ] Verificar `/health` con `environment: staging`.
- [ ] Revisar provider status sin secretos.
- [ ] Crear/aprobar solicitud; pagar con Personal Sandbox.
- [ ] Confirmar retorno, factura `PAID`, plan y webhook.
- [ ] Recargar y confirmar idempotencia.
- [ ] Subir logo e imagen; crear venta y documento interno.
- [ ] Revisar POS, reportes, roles y aislamiento empresarial.

## Troubleshooting

- **API no arranca:** completar solo los nombres indicados; no imprimir valores.
- **CORS:** igualar esquema, host y puerto con `CORS_ORIGIN`; nunca usar `*`.
- **PayPal:** revisar provider status, Sandbox, tasa, URLs y Webhook ID.
- **Webhook inválido:** confirmar App/ID/URL y preservación de headers PayPal.
- **Imágenes desaparecen:** revisar montaje persistente de `UPLOADS_DIR`.
- **Migración falla:** detener release; no sustituir por `migrate dev`.

## Riesgos pendientes

- Tokens en `localStorage` aumentan el impacto de XSS.
- Uploads locales no escalan horizontalmente.
- La tasa DOP/USD es manual y requiere propietario operativo.
- La compra completa requiere validación humana Personal Sandbox.
- Rate limiting/Helmet no se incorporaron.
- Health básico no consulta DB; migraciones cubren readiness inicial.

## Qué NO está incluido

No incluye cloud, CI/CD específico, producción, PayPal Live, storage externo,
tarjetas, datos reales, DGII ni facturación electrónica real.
