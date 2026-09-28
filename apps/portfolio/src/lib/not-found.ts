/**
 * The head of a page that answers 404: a title of its own, and `noindex`
 * beside the status for a crawler that keeps the page anyway.
 *
 * A path no route matches settles on the root route, and so does a notFound()
 * thrown by a route with no notFoundComponent of its own (an unknown project
 * id, an unknown post). TanStack then runs the root's head() alone, so the root
 * route answers with this for all of them; projectHead() does too, for an id
 * the registry does not know.
 */
export const NOT_FOUND_TITLE = 'Page not found · ncam.dev';

export const NOT_FOUND_META = [{ title: NOT_FOUND_TITLE }, { name: 'robots', content: 'noindex' }];
