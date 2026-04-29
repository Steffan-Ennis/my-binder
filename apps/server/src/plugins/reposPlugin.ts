import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { getRepositories } from '@src/db/repositories';
import type { CardRepository } from '@src/repositories/cardRepository';
import type { UserRepository } from '@src/repositories/userRepository';
import type { AllowedUserRepository } from '@src/repositories/allowedUserRepository';

declare module 'fastify' {
  interface FastifyInstance {
    repos: {
      card: CardRepository;
      user: UserRepository;
      allowedUser: AllowedUserRepository;
    };
  }
}

export const reposPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorate('repos', getRepositories());
});
