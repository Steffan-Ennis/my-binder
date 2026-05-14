import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1778401889496 implements MigrationInterface {
    name = 'Migration1778401889496'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cards" DROP CONSTRAINT "PK_5f3269634705fdff4a9935860fc"`);
        await queryRunner.query(`ALTER TABLE "cards" ADD CONSTRAINT "PK_3c1862566b9abae49bb0439d6be" PRIMARY KEY ("id", "user_id")`);
        await queryRunner.query(`ALTER TABLE "cards" ALTER COLUMN "id" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cards" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "cards" DROP CONSTRAINT "PK_3c1862566b9abae49bb0439d6be"`);
        await queryRunner.query(`ALTER TABLE "cards" ADD CONSTRAINT "PK_5f3269634705fdff4a9935860fc" PRIMARY KEY ("id")`);
    }

}
