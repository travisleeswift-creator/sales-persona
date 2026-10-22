export function StatusNote({ loading, error }: { loading?: boolean; error?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="rounded-2xl border border-line bg-elev px-4 py-3 text-sm text-bad">
        {error}
      </p>
    );
  }
  if (loading) return <p className="text-sm text-muted">Loading the floor…</p>;
  return null;
}
