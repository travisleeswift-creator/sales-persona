import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-xl gap-3 px-4 py-16">
      <h1 className="font-serif text-5xl">Off the floor</h1>
      <p className="text-muted">That page is not part of the trainer.</p>
      <Link href="/" className="text-sm underline">Back to the counters</Link>
    </div>
  );
}
