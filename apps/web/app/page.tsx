import Link from 'next/link';

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="max-w-2xl text-center">
        <span className="text-sm font-semibold tracking-[0.2em] text-blue-600 uppercase">
          Comercia ERP
        </span>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight">
          Tu negocio, organizado desde el primer día.
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-500">
          Base segura y multiempresa para administrar usuarios, sucursales y la
          configuración inicial de tu comercio.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <Link
            className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white"
            href="/login"
          >
            Iniciar sesión
          </Link>
          <Link
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold"
            href="/register"
          >
            Registrar empresa
          </Link>
        </div>
      </section>
    </main>
  );
}
