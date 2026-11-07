import { describe, expect, it, vi } from 'vitest';
import { createRouteController } from './route-controller';

describe('createRouteController', () => {
  it('starts at the configured route, else /', () => {
    expect(createRouteController({ route: '/album/x' }).getRoute()).toBe('/album/x');
    expect(createRouteController().getRoute()).toBe('/');
  });

  it('notifies on a new route only', () => {
    const controller = createRouteController({ route: '/' });
    const listener = vi.fn();
    const off = controller.subscribe(listener);
    controller.setRoute('/');
    controller.setRoute('/playlist/a');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    controller.setRoute('/playlist/b');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('asks the host to navigate when it can, else moves itself', () => {
    const onNavigate = vi.fn();
    const hosted = createRouteController({ route: '/', onNavigate });
    hosted.navigate('/playlist/a');
    expect(onNavigate).toHaveBeenCalledWith('/playlist/a');
    expect(hosted.getRoute()).toBe('/');

    const alone = createRouteController({ route: '/' });
    alone.navigate('/playlist/a');
    expect(alone.getRoute()).toBe('/playlist/a');
  });
});
