import { Button } from '@comercia/ui';

const foundations = [
  {
    index: '01',
    title: 'Operación simple',
    description:
      'Una base preparada para ventas y caja, sin ruido innecesario.',
  },
  {
    index: '02',
    title: 'Arquitectura modular',
    description: 'Cada capacidad podrá crecer sin acoplar todo el negocio.',
  },
  {
    index: '03',
    title: 'Decisiones claras',
    description: 'Información útil para entender y dirigir mejor tu comercio.',
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_38%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.10),transparent_32%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-400 font-black text-slate-950">
              C
            </span>
            <div>
              <p className="font-semibold tracking-tight">Comercia ERP</p>
              <p className="text-xs text-slate-400">Base técnica · Fase 1</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            En construcción
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-24">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold tracking-[0.24em] text-emerald-400 uppercase">
              Hecho para negocios dominicanos
            </p>
            <h1 className="text-5xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-7xl">
              Tu negocio, más claro. Tu operación, más ligera.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-pretty text-slate-300">
              Comercia ERP será una plataforma modular para organizar, vender y
              crecer desde un solo lugar. Hoy estamos construyendo sus
              cimientos.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button>
                Explorar la base
                <span className="ml-2" aria-hidden="true">
                  →
                </span>
              </Button>
              <Button variant="secondary">Estado del proyecto: listo</Button>
            </div>
          </div>

          <div className="mt-20 grid gap-4 md:grid-cols-3">
            {foundations.map(({ description, index, title }) => (
              <article
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-sm"
              >
                <span className="text-xs font-bold tracking-widest text-emerald-400">
                  {index}
                </span>
                <h2 className="mt-8 font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-6 text-xs text-slate-500">
          <p>Comercia ERP · República Dominicana</p>
          <p>Next.js · NestJS · PostgreSQL</p>
        </footer>
      </div>
    </main>
  );
}
