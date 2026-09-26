import { createContext, useContext } from 'react';
import { formatRoute, parseRoute, type Route } from './routes';
import type { RouteController } from './route-controller';

export const RouteControllerContext = createContext<RouteController | null>(null);

function useController(): RouteController {
  const controller = useContext(RouteControllerContext);
  if (!controller) throw new Error('Holodex views must render inside <App>');
  return controller;
}

/** The current route, parsed. */
export function useRoute(): Route {
  return parseRoute(useController().getRoute());
}

/** Go somewhere, expressed as a Route rather than a string. */
export function useNavigate(): (route: Route) => void {
  const controller = useController();
  return (route) => controller.navigate(formatRoute(route));
}
