import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { UserEntity } from './UserEntity';

@Entity('cards')
export class CardEntity {
  // Composite PK (id, user_id): id is the MTGJSON printing UUID, supplied by the
  // caller; user_id scopes ownership so different users can own the same printing.
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id!: string;

  @Column({ name: 'name', type: 'varchar', length: 500 })
  name!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // Spec 018 / FR-023 — the user owns this many physical copies of this
  // printing. Always >= 1 while the row exists (DB-level CHECK >= 1); a
  // decrement to 0 deletes the row inside the same transaction. The default
  // applies on first insert; subsequent inserts for the same (id, user_id)
  // are upserts that increment instead.
  @Column({ name: 'number_owned', type: 'integer', default: 1 })
  numberOwned!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('UserEntity', 'cards', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;
}
