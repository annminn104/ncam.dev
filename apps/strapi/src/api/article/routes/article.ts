import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::article.article', {
  config: {
    find: { middlewares: ['api::article.force-published'] },
    findOne: { middlewares: ['api::article.force-published'] },
  },
});
