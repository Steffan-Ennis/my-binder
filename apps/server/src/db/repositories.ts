import type { DataSource } from 'typeorm';
import { CardRepository } from '@src/repositories/cardRepository';
import { UserRepository } from '@src/repositories/userRepository';
import { AllowedUserRepository } from '@src/repositories/allowedUserRepository';

let _card: CardRepository | undefined;
let _user: UserRepository | undefined;
let _allowedUser: AllowedUserRepository | undefined;

export function initRepositories(ds: DataSource): void {
  _card = new CardRepository(ds);
  _user = new UserRepository(ds);
  _allowedUser = new AllowedUserRepository(ds);
}

export function getRepositories(): { card: CardRepository; user: UserRepository; allowedUser: AllowedUserRepository } {
  if (!_card || !_user || !_allowedUser) {
    throw new Error('Repositories not initialised. Call initRepositories() first.');
  }
  return { card: _card, user: _user, allowedUser: _allowedUser };
}
