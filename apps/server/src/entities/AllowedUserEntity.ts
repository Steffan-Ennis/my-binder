import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class AllowedUserEntity {
  @PrimaryColumn({ name: 'email', type: 'varchar', length: 255 })
  email!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
