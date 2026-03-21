import { Card, CardList, CreateCardBody, UpdateCardBody } from '@my-binder/core';
import * as repo from '@src/repositories/cardRepository';

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Card with id "${id}" not found`);
    this.name = 'NotFoundError';
  }
}

export async function getCards(): Promise<CardList> {
  const cards = await repo.findAll();
  return { cards, total: cards.length };
}

export async function getCard(id: string): Promise<Card> {
  const card = await repo.findById(id);
  if (card === null) throw new NotFoundError(id);
  return card;
}

export async function createCard(body: CreateCardBody): Promise<Card> {
  return repo.create(body);
}

export async function updateCard(id: string, body: UpdateCardBody): Promise<Card> {
  const card = await repo.update(id, body);
  if (card === null) throw new NotFoundError(id);
  return card;
}

export async function deleteCard(id: string): Promise<void> {
  const deleted = await repo.remove(id);
  if (!deleted) throw new NotFoundError(id);
}
