/**
 * Where the manual lives.
 *
 * Built from the base the app was compiled with rather than written
 * relative, because a relative URL resolves against the *document*: at
 * `/computer/` it lands on `/computer/BASIC.html`, and at `/computer`
 * -- the same page without the trailing slash -- it lands on
 * `/BASIC.html` instead. In production nginx redirects the slashless
 * form and hides the problem; the dev server does not, which is where
 * it showed up.
 */
const BASE = import.meta.env.BASE_URL;

/** Always exactly one slash between the base and the file. */
export const MANUAL_PATH = `${BASE.endsWith("/") ? BASE : `${BASE}/`}BASIC.html`;

/**
 * The manual, at one entry.
 *
 * Topics become fragments, which is why every entry in the page carries
 * an `id`. Anything that is not one simply opens the page at the top.
 */
export function manualUrl(topic: string | null): string {
    return topic === null
        ? MANUAL_PATH
        : `${MANUAL_PATH}#${topic.toLowerCase()}`;
}
