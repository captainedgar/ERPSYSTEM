# Comercia ERP

ERP/POS web modular y multiempresa para pequeños y medianos negocios de República Dominicana.

## Requisitos

- Node.js 20.9+
- npm 10+
- Docker con Docker Compose

## Configuración local

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d
npm run db:migrate
npm run db:generate
npm run dev
```

La web estará en `http://localhost:3000`, la API en `http://localhost:3001` y
el health check en `http://localhost:3001/health`.

Los scripts Prisma cargan explícitamente el `.env` de la raíz. No se necesita
un archivo `packages/database/.env`.

## Validación

```powershell
npm run db:validate
npm run db:generate
npm run build
npm run lint
npm run test
npm run format:check
```

Las pruebas E2E requieren PostgreSQL activo y se pueden ejecutar por separado:

```powershell
docker compose up -d
npm run test:e2e
```

La suite usa `TEST_DATABASE_URL` si está definida; de lo contrario usa la
instancia local de Docker. En ambos casos crea un esquema aislado con prefijo
`e2e_`, aplica el esquema Prisma y lo elimina al terminar. No limpia ni modifica
el esquema de desarrollo.

La Fase 2 cubre autenticación, empresas, sucursales, usuarios, roles, permisos,
sesiones, configuración básica y auditoría. No incluye productos, inventario,
POS, caja, ventas ni integración fiscal.
