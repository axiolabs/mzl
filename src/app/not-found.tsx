import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-accent">404</p>
      <h1 className="mt-3 text-2xl font-bold">Este parche no existe (o ya no está disponible)</h1>
      <Link href="/explorar" className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 font-semibold text-white">Explorar planes</Link>
    </div>
  );
}
