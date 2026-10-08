"""
End-to-end Alembic migration test against a real PostgreSQL database.

SQLite-based unit tests cannot exercise native enum types or the role-refactor
data migration, so this module runs the full chain on Postgres:

    base -> pre-refactor (seed legacy data) -> head -> pre-refactor -> head -> base -> head

It is skipped unless ``MIGRATION_DATABASE_URL`` points at a disposable database
(its ``public`` schema is dropped and recreated).
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import Enum as SAEnum
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

MIGRATION_DB_URL = os.environ.get("MIGRATION_DATABASE_URL")
BACKEND_DIR = Path(__file__).resolve().parents[1]
PRE_REFACTOR = "fc89012ab345"

pytestmark = pytest.mark.skipif(
    not MIGRATION_DB_URL, reason="MIGRATION_DATABASE_URL not set (PostgreSQL required)"
)


def _alembic(*args: str) -> None:
    env = {
        **os.environ,
        "DATABASE_URL": MIGRATION_DB_URL,
        "PYTHONPATH": str(BACKEND_DIR),
    }
    result = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def _schema_drift(engine) -> list[str]:
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    import app.db.models  # noqa: F401
    from app.db.base import Base

    problems: list[str] = []
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn, opts={"compare_type": True})
        problems += [repr(d) for d in compare_metadata(ctx, Base.metadata)]
        db_enums: dict[str, set[str]] = {}
        rows = conn.execute(
            text(
                "SELECT t.typname, e.enumlabel FROM pg_type t "
                "JOIN pg_enum e ON e.enumtypid = t.oid"
            )
        )
        for type_name, label in rows:
            db_enums.setdefault(type_name, set()).add(label)
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, SAEnum):
                expected = set(column.type.enums)
                actual = db_enums.get(column.type.name, set())
                if expected != actual:
                    problems.append(
                        f"enum {column.type.name} ({table.name}.{column.name}): "
                        f"expected {sorted(expected)}, found {sorted(actual)}"
                    )
    return problems


SEED_SQL = """
INSERT INTO users (id, name, email, role, verification_status, is_active, otp_attempts,
                   flat_number, created_at, updated_at) VALUES
  (1, 'Buyer',    'buyer@x.io',    'buyer',  'verified', true,  0, 'A-101', now(), now()),
  (2, 'Seller',   'seller@x.io',   'seller', 'verified', true,  0, 'B-201', now(), now()),
  (3, 'Applicant','pending@x.io',  'seller', 'pending',  true,  0, 'C-301', now(), now()),
  (4, 'Rejected', 'rejected@x.io', 'seller', 'rejected', true,  0, 'D-401', now(), now()),
  (5, 'Admin',    'admin@x.io',    'admin',  'verified', true,  0, NULL,    now(), now()),
  (6, 'Tester',   'tester@x.io',   'tester', 'pending',  false, 0, NULL,    now(), now());
INSERT INTO seller_profiles (id, rating, review_count, approval_status, created_at, updated_at)
VALUES (2, 4.5, 3, 'approved', now(), now()),
       (3, 0, 0, 'pending', now(), now()),
       (4, 0, 0, 'rejected', now(), now());
INSERT INTO menus (id, seller_id, name, category, price, is_available, quantity,
                   created_at, updated_at)
VALUES (1, 2, 'Dosa', 'veg', 80, true, 10, now(), now());
INSERT INTO orders (id, buyer_id, seller_id, status, items, total_price, created_at, updated_at)
VALUES (1, 1, 2, 'pending',   '[]', 80, now(), now()),
       (2, 1, 2, 'completed', '[]', 80, now(), now());
INSERT INTO payments (id, order_id, buyer_id, seller_id, amount, currency, status, provider,
                      seller_confirmed_at, created_at, updated_at)
VALUES (1, 1, 1, 2, 80, 'INR', 'submitted', 'upi', NULL, now(), now()),
       (2, 2, 1, 2, 80, 'INR', 'captured',  'upi', now(), now(), now());
INSERT INTO deliveries (id, order_id, seller_id, buyer_id, status, seller_flat, buyer_flat,
                        created_at, updated_at)
VALUES (1, 2, 2, 1, 'delivered', 'B-201', 'A-101', now(), now());
INSERT INTO ratings (id, order_id, seller_id, rater_id, score, created_at, updated_at)
VALUES (1, 2, 2, 1, 5, now(), now());
"""


@pytest.fixture(scope="module")
def engine():
    eng = create_engine(MIGRATION_DB_URL)
    with eng.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    yield eng
    eng.dispose()


def _scalar_map(engine, sql: str) -> dict:
    with engine.connect() as conn:
        return {row[0]: row[1] for row in conn.execute(text(sql))}


def test_full_migration_cycle_preserves_data(engine):
    _alembic("upgrade", PRE_REFACTOR)
    with engine.begin() as conn:
        for statement in SEED_SQL.split(";"):
            if statement.strip():
                conn.execute(text(statement))

    _alembic("upgrade", "head")
    assert _schema_drift(engine) == []

    assert _scalar_map(engine, "SELECT id, role::text FROM users") == {
        1: "resident",
        2: "partner",
        3: "partner",
        4: "partner",
        5: "admin",
        6: "resident",
    }
    assert _scalar_map(engine, "SELECT id, status::text FROM users") == {
        1: "active",
        2: "active",
        3: "pending_verification",
        4: "suspended",
        5: "active",
        6: "pending_verification",
    }
    assert _scalar_map(
        engine,
        "SELECT id, application_status::text || '/' || partner_status::text "
        "FROM partner_profiles",
    ) == {2: "approved/active", 3: "pending/pending", 4: "rejected/inactive"}
    assert _scalar_map(engine, "SELECT id, status::text FROM orders") == {
        1: "placed",
        2: "delivered",
    }
    assert _scalar_map(engine, "SELECT id, status::text FROM payments") == {
        1: "pending",
        2: "captured",
    }
    assert _scalar_map(engine, "SELECT id, review_status::text FROM ratings") == {1: "published"}
    assert _scalar_map(
        engine,
        "SELECT id, partner_id || ':' || resident_id || ':' || partner_flat FROM deliveries",
    ) == {1: "2:1:B-201"}

    from app.db.models import Delivery, Menu, Order, PartnerProfile, Payment, Rating, User

    with Session(engine) as session:
        assert session.get(User, 2).partner_profile.application_status.value == "approved"
        assert session.get(Menu, 1).partner_id == 2
        assert {o.status.value for o in session.query(Order)} == {"placed", "delivered"}
        assert session.query(Payment).count() == 2
        assert session.query(Rating).one().partner_id == 2
        assert session.query(Delivery).one().resident_id == 1
        assert session.query(PartnerProfile).filter_by(partner_status="active").count() == 1

    _alembic("downgrade", PRE_REFACTOR)
    assert _scalar_map(engine, "SELECT id, role::text FROM users") == {
        1: "buyer",
        2: "seller",
        3: "seller",
        4: "seller",
        5: "admin",
        6: "buyer",
    }
    assert _scalar_map(engine, "SELECT id, approval_status::text FROM seller_profiles") == {
        2: "approved",
        3: "pending",
        4: "rejected",
    }
    assert _scalar_map(engine, "SELECT id, status::text FROM orders") == {
        1: "pending",
        2: "completed",
    }
    assert _scalar_map(engine, "SELECT id, seller_id FROM menus") == {1: 2}

    _alembic("upgrade", "head")
    assert _schema_drift(engine) == []


def test_downgrade_to_base_and_fresh_install(engine):
    _alembic("downgrade", "base")
    with engine.connect() as conn:
        leftovers = conn.execute(
            text(
                "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' "
                "AND tablename <> 'alembic_version'"
            )
        ).scalar()
        enum_types = conn.execute(
            text(
                "SELECT count(*) FROM pg_type t WHERE EXISTS (SELECT 1 FROM pg_enum e WHERE e.enumtypid = t.oid)"
            )
        ).scalar()
    assert leftovers == 0
    assert enum_types == 0

    _alembic("upgrade", "head")
    assert _schema_drift(engine) == []
