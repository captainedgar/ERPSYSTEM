# Comercia ERP

Base técnica del monorepo para un ERP/POS modular orientado a pequeños y medianos negocios de República Dominicana.

## Requisitos

- Node.js 20.9 o superior
- npm 10 o superior
- Docker con Docker Compose

## Inicio rápido

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d
npm run db:validate
npm run db:generate
npm run build
npm run lint
npm run dev
```

La aplicación web se sirve en `http://localhost:3000`, la API en
`http://localhost:3001` y su health check en `http://localhost:3001/health`.

> `.env` es exclusivamente local y está ignorado por Git. No se incluye ningún
> secreto real en el repositorio.

## Variables de entorno y Prisma

La configuración local vive únicamente en el archivo `.env` de la raíz. Los
scripts de `packages/database` cargan ese archivo explícitamente con
`dotenv-cli`, incluso cuando npm ejecuta el comando desde el workspace:

```powershell
Copy-Item .env.example .env
npm run db:validate
npm run db:generate
```

No es necesario crear `packages/database/.env`. Si ambos archivos existen, las
variables cargadas desde el `.env` raíz tienen precedencia al ejecutar los
scripts del proyecto.

## Workspaces

- `apps/web`: frontend Next.js.
- `apps/api`: API NestJS.
- `packages/database`: esquema y cliente Prisma.
- `packages/shared`: tipos compartidos.
- `packages/ui`: componentes visuales reutilizables.
- `packages/config`: configuración compartida.

La integración fiscal futura se mantendrá desacoplada del POS, ventas, caja e
inventario. Esta fase no incluye módulos de negocio ni integración real con DGII.
