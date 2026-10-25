/** Dev-only detailed error (spec §12). Production shows <Poster /> instead. */
export function ErrorScreen({ error }: { error: Error }) {
  return <pre className="error">{error.message}</pre>;
}
