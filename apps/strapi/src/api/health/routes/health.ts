/**
 * `GET /api/health`, public: no role permission needed, since `auth: false`
 * skips Strapi's users-permissions check for this route.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: 'api::health.health.check',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
