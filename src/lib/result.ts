/**
 * The engine result shape (PRD §7): resolvable errors are values, never thrown exceptions.
 *
 * It lives in `lib` so both the pure engine and the storage layer can name the same
 * contract without the engine importing storage. The persistence-specific results
 * (`WriteResult`, `ImportResult`, `CapValidationResult`) keep their own narrower
 * shapes because their error sets and success payloads differ.
 */
export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
