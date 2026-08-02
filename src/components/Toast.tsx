/**
 * The lime pill that confirms a submitted rating. Always mounted as a live
 * region so screen readers hear the result even though the visible pill
 * only exists while there is a message.
 */
export function Toast({ message }: { message: string }) {
  return (
    <>
      <div className="srOnly" role="status" aria-live="polite">
        {message}
      </div>
      {message ? <div className="toast">{message}</div> : null}
    </>
  );
}
