import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { ArticlesPage } from '../pages/articles';
import { MessengerPage } from '../pages/messenger/MessengerPage';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const messengerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MessengerPage,
});

const articlesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/articles',
  component: ArticlesPage,
});

const routeTree = rootRoute.addChildren([messengerRoute, articlesRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
