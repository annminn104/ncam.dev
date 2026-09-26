import { describe, expect, it, vi } from 'vitest';
import { createRouteController } from './route-controller';

describe('createRouteController', () => {
  it('starts at the configured route, defaulting to "/"', () => {
    expect(createRouteController().getRoute()).toBe('/');
    expect(createRouteController({ route: '/collection' }).getRoute()).toBe('/collection');
  });

  it('notifies subscribers when the route changes', () => {
    const controller = createRouteController();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setRoute('/collection');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.getRoute()).toBe('/collection');
  });

  it('does not notify when the route is unchanged, so React never loops', () => {
    const controller = createRouteController({ route: '/collection' });
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setRoute('/collection');
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const controller = createRouteController();
    const listener = vi.fn();
    controller.subscribe(listener)();
    controller.setRoute('/collection');
    expect(listener).not.toHaveBeenCalled();
  });

  it('delegates navigation to the host when one is wired up', () => {
    const onNavigate = vi.fn();
    const controller = createRouteController({ onNavigate });
    controller.navigate('/card/swsh3-136');
    expect(onNavigate).toHaveBeenCalledWith('/card/swsh3-136');
    // The host owns the URL, so the controller waits for it to push the route back.
    expect(controller.getRoute()).toBe('/');
  });

  it('navigates itself when running standalone', () => {
    const controller = createRouteController();
    controller.navigate('/card/swsh3-136');
    expect(controller.getRoute()).toBe('/card/swsh3-136');
  });
});
