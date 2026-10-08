import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { MessengerPage } from '../pages/messenger/MessengerPage';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const messengerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MessengerPage,
});

const routeTree = rootRoute.addChildren([messengerRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
