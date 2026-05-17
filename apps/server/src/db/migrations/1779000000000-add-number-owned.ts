import { MigrationInterface, QueryRunner } from "typeorm";

// Spec 018 / FR-023 — `cards.number_owned` records how many physical copies
// of a printing the user owns. Additive non-breaking column: existing rows
// backfill to 1 (default). The CHECK invariant (>= 1) is the schema-level
// expression of the rule "a row with number_owned = 0 must not appear in the
// binder" — a row that would decrement to 0 is deleted inside the same
// transaction (FR-026), never persisted at 0.
export class AddNumberOwned1779000000000 implements MigrationInterface {
    name = 'AddNumberOwned1779000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "cards" ADD COLUMN "number_owned" integer NOT NULL DEFAULT 1`,
        );
        await queryRunner.query(
            `ALTER TABLE "cards" ADD CONSTRAINT "CHK_cards_number_owned_positive" CHECK ("number_owned" >= 1)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "cards" DROP CONSTRAINT "CHK_cards_number_owned_positive"`,
        );
        await queryRunner.query(`ALTER TABLE "cards" DROP COLUMN "number_owned"`);
    }
}
