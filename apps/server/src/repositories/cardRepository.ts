import type { DataSource, Repository } from 'typeorm';
import type { Card, CreateCardBody, UpdateCardBody } from '@my-binder/core';
import { CardEntity } from '@src/entities/CardEntity';

function toCard(entity: CardEntity): Card {
  return {
    id: entity.id,
    name: entity.name,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export class CardRepository {
  private repo: Repository<CardEntity>;

  constructor(ds: DataSource) {
    this.repo = ds.getRepository(CardEntity);
  }

  async findAll(userId: string): Promise<Card[]> {
    const entities = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return entities.map(toCard);
  }

  async findById(id: string, userId: string): Promise<Card | null> {
    const entity = await this.repo.findOne({ where: { id, userId } });
    return entity ? toCard(entity) : null;
  }

  async create(body: CreateCardBody, userId: string): Promise<Card> {
    const entity = await this.repo.save({ id: body.id, name: body.name, userId });
    return toCard(entity);
  }

  async update(id: string, body: UpdateCardBody, userId: string): Promise<Card | null> {
    const entity = await this.repo.findOne({ where: { id, userId } });
    if (!entity) return null;
    entity.name = body.name;
    const updated = await this.repo.save(entity);
    return toCard(updated);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.repo.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }
}
