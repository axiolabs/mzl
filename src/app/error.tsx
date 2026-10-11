"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center" role="alert">
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="mt-2 text-black/60">No pudimos cargar esta página. Intenta de nuevo.</p>
      <button onClick={reset} className="mt-6 rounded-full bg-accent px-5 py-2.5 font-semibold text-white">Reintentar</button>
    </div>
  );
}
