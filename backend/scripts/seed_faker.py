"""
Database seed script -- populates the dev DB with realistic fake data.

Usage (from the backend/ directory):
    python scripts/seed_faker.py

All seed users share the password:  SocietyFood@2025
"""

import os
import random
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from faker import Faker
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import (
    Delivery,
    DishSuggestion,
    Menu,
    Order,
    PartnerProfile,
    Payment,
    Rating,
    User,
)
from app.db.models.enums import (
    DeliveryStatus,
    DeliveryType,
    MenuCategory,
    OrderStatus,
    PartnerApplicationStatus,
    PartnerStatus,
    PaymentStatus,
    ReviewStatus,
    SuggestionStatus,
    UserRole,
    UserStatus,
)
from app.db.session import SessionLocal, engine

fake = Faker("en_IN")

SEED_PASSWORD = "SocietyFood@2025"
NUM_RESIDENTS = 30
NUM_PARTNERS = 10
MENUS_PER_PARTNER = 8
ORDERS_PER_RESIDENT = 4
PLATFORM_FEE_PERCENT = Decimal(str(settings.PLATFORM_FEE_PERCENT)) / 100
MAINTENANCE_FEE = Decimal("5.00")

FLAT_FORMATS = [
    lambda: f"TowerA-{random.randint(1,20)}0{random.randint(1,9)}",
    lambda: f"BlockB-{random.randint(1,20)}0{random.randint(1,9)}",
    lambda: f"MHB-T{random.randint(1,5)}-{random.randint(1,30)}0{random.randint(1,9)}",
]

HYD_BIOS = [
    "Authentic Hyderabadi home-cooked meals.",
    "Specializing in spicy Andhra meals.",
    "Pure veg Jain and South Indian meals.",
]

MENU_ITEMS = {
    MenuCategory.veg: [
        "Bagara Baingan",
        "Paneer Butter Masala",
        "Vegetable Dum Biryani",
    ],
    MenuCategory.non_veg: [
        "Hyderabadi Chicken Dum Biryani",
        "Mutton Haleem",
        "Chicken 65",
    ],
    MenuCategory.snacks: ["Mirchi Bajji", "Punugulu", "Samosa"],
    MenuCategory.desserts: ["Double ka Meetha", "Qubani ka Meetha", "Jalebi"],
    MenuCategory.beverages: ["Irani Chai", "Sweet Lassi", "Filter Coffee"],
    MenuCategory.other: ["Roti", "Bagara Rice", "Mirchi ka Salan"],
}

PRICE_RANGES = {
    MenuCategory.veg: (60, 180),
    MenuCategory.non_veg: (150, 350),
    MenuCategory.snacks: (30, 80),
    MenuCategory.desserts: (50, 150),
    MenuCategory.beverages: (20, 60),
    MenuCategory.other: (20, 60),
}

# 6 states: draft, pending, under_review, approved, rejected, withdrawn
APP_STATUS_WEIGHTS = [5, 10, 15, 60, 7, 3]

# 12 states: draft, placed, accepted, rejected, preparing, ready, dispatched, in_transit, delivered, cancelled, refund_pending, refunded
ORDER_STATUS_WEIGHTS = [2, 5, 5, 3, 8, 8, 5, 5, 40, 12, 4, 3]

# 4 states: open, claimed_by_chef, fulfilled, closed
SUGGESTION_WEIGHTS = [40, 30, 20, 10]


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _past(days: int, hours: int = 0, minutes: int = 0) -> datetime:
    return _utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


def _phone() -> str:
    return f"{random.choice([6, 7, 8, 9])}{random.randint(100000000, 999999999)}"


def _flat() -> str:
    return random.choice(FLAT_FORMATS)()


def _price(category: MenuCategory) -> Decimal:
    lo, hi = PRICE_RANGES.get(category, (50, 150))
    return Decimal(str(random.randrange(lo, hi, 5)))


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    print("[OK] Tables verified / created")


def seed_admin(db: Session) -> User:
    for email, role, name in [
        ("admin@societyfood.local", UserRole.admin, "Aditya Reddy"),
        ("superadmin@societyfood.local", UserRole.super_admin, "Priya Sharma"),
    ]:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            continue
        user = User(
            name=name,
            email=email,
            phone=_phone(),
            flat_number="ADMIN-001",
            role=role,
            status=UserStatus.active,
            is_active=True,
            hashed_password=hash_password(SEED_PASSWORD),
        )
        db.add(user)
        print(f"  [OK] {role.value}: {email}")
    db.commit()
    return db.query(User).filter(User.email == "admin@societyfood.local").first()


def seed_residents(db: Session, n: int) -> list[User]:
    residents = []
    for i in range(n):
        email = f"resident{i + 1}@societyfood.local"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            residents.append(existing)
            continue

        is_active = random.random() > 0.10
        status = UserStatus.active if random.random() > 0.10 else UserStatus.pending_verification

        user = User(
            name=fake.name(),
            email=email,
            phone=_phone(),
            flat_number=_flat(),
            role=UserRole.resident,
            status=status,
            is_active=is_active,
            hashed_password=hash_password(SEED_PASSWORD),
        )
        db.add(user)
        residents.append(user)
    db.commit()
    print(f"  [OK] {len(residents)} residents seeded")
    return residents


def seed_partners(db: Session, n: int) -> list[tuple[User, PartnerProfile]]:
    pairs = []
    for i in range(n):
        email = f"partner{i + 1}@societyfood.local"
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            existing_profile = (
                db.query(PartnerProfile).filter(PartnerProfile.id == existing_user.id).first()
            )
            if existing_profile:
                pairs.append((existing_user, existing_profile))
                continue

        app_status = random.choices(list(PartnerApplicationStatus), weights=APP_STATUS_WEIGHTS)[0]
        if app_status == PartnerApplicationStatus.approved:
            op_status = random.choices(
                [PartnerStatus.active, PartnerStatus.suspended], weights=[90, 10]
            )[0]
        else:
            op_status = PartnerStatus.pending

        is_open = (
            random.random() > 0.20
            if app_status == PartnerApplicationStatus.approved and op_status == PartnerStatus.active
            else False
        )

        user = User(
            name=fake.name(),
            email=email,
            phone=_phone(),
            flat_number=_flat(),
            role=UserRole.partner,
            status=UserStatus.active,
            is_active=True,
            hashed_password=hash_password(SEED_PASSWORD),
        )
        db.add(user)
        db.flush()

        profile = PartnerProfile(
            id=user.id,
            bio=random.choice(HYD_BIOS),
            upi_id=f"partner{i + 1}@paytm",
            upi_account_name=fake.name(),
            is_upi_verified=True,
            bank_account=f"9{random.randint(10000000000, 99999999999)}",
            photo_url=f"https://picsum.photos/seed/partner{i + 1}/200",
            application_status=app_status,
            partner_status=op_status,
            is_open=is_open,
            free_orders_remaining=random.randint(0, 50),
            maintenance_balance=Decimal(str(random.randint(-50, 200))),
            rating=0.0,
            review_count=0,
            on_time_delivery_rate=round(random.uniform(80.0, 100.0), 2),
            punctuality_rating=round(random.uniform(3.5, 5.0), 2),
            avg_delivery_minutes=random.randint(10, 45),
        )
        db.add(profile)
        pairs.append((user, profile))
    db.commit()
    print(f"  [OK] {len(pairs)} partners seeded")
    return pairs


def seed_menus(
    db: Session, partner_pairs: list[tuple[User, PartnerProfile]], per_partner: int
) -> list[Menu]:
    all_items = []
    for _user, profile in partner_pairs:
        existing_count = db.query(Menu).filter(Menu.partner_id == profile.id).count()
        if existing_count >= per_partner:
            all_items.extend(db.query(Menu).filter(Menu.partner_id == profile.id).all())
            continue

        for _ in range(per_partner):
            cat = random.choice(list(MenuCategory))
            name_pool = MENU_ITEMS.get(cat, ["Special Item"])
            quantity = random.choice([0, 1, 2, 5, 10, 20, 100])
            is_available = quantity > 0 and random.random() > 0.10
            is_preorder = random.random() > 0.70

            item = Menu(
                partner_id=profile.id,
                name=random.choice(name_pool),
                description="Fresh and authentic.",
                category=cat,
                price=_price(cat),
                is_available=is_available,
                quantity=quantity,
                image_url=f"https://picsum.photos/seed/menu{random.randint(1,1000)}/300/200",
                is_preorder_only=is_preorder,
                preorder_cutoff_time="10:30" if is_preorder else None,
                available_slots=["lunch_today", "dinner_today"] if is_preorder else None,
                max_batch_quantity=20 if is_preorder else 0,
                min_lead_time_hours=2 if is_preorder else 0,
            )
            db.add(item)
            all_items.append(item)
    db.commit()
    print(f"  [OK] {len(all_items)} menu items seeded")
    return all_items


def seed_dish_suggestions(
    db: Session, residents: list[User], partner_pairs: list[tuple[User, PartnerProfile]]
) -> None:
    active_residents = [r for r in residents if r.is_active]
    approved_partners = [
        p for p in partner_pairs if p[1].application_status == PartnerApplicationStatus.approved
    ]

    if not active_residents or not approved_partners:
        return

    for title in ["Haleem", "Upma", "Samosa Batch"]:
        suggester = random.choice(active_residents)
        status = random.choices(list(SuggestionStatus), weights=SUGGESTION_WEIGHTS)[0]
        partner_profile = (
            random.choice(approved_partners)[1]
            if status in (SuggestionStatus.claimed_by_chef, SuggestionStatus.fulfilled)
            else None
        )

        suggestion = DishSuggestion(
            user_id=suggester.id,
            title=title,
            description="Anyone craving this?",
            category=random.choice(list(MenuCategory)),
            target_date=_utcnow().date() + timedelta(days=random.randint(1, 7)),
            upvotes_count=1,
            status=status,
            accepted_by_partner_id=partner_profile.id if partner_profile else None,
            created_at=_past(random.randint(1, 10)),
        )
        db.add(suggestion)
        db.flush()
    db.commit()
    print("  [OK] Dish suggestions seeded")


def seed_orders_payments_deliveries(
    db: Session,
    residents: list[User],
    partner_pairs: list[tuple[User, PartnerProfile]],
    menus: list[Menu],
    orders_per_resident: int,
) -> None:
    created_orders = created_payments = created_deliveries = 0
    menu_by_partner = {}
    for m in menus:
        menu_by_partner.setdefault(m.partner_id, []).append(m)

    active_partners = [
        sp
        for sp in partner_pairs
        if sp[1].application_status == PartnerApplicationStatus.approved
        and sp[1].partner_status == PartnerStatus.active
    ]

    for resident in residents:
        if not resident.is_active:
            continue
        for _ in range(orders_per_resident):
            if not active_partners:
                break
            partner_user, partner_profile = random.choice(active_partners)
            partner_menus = menu_by_partner.get(partner_profile.id, [])
            if not partner_menus:
                continue

            selected = random.sample(partner_menus, min(random.randint(1, 2), len(partner_menus)))
            items_data = []
            total = Decimal("0.00")
            for item in selected:
                qty = random.randint(1, 2)
                items_data.append(
                    {
                        "menu_id": item.id,
                        "name": item.name,
                        "quantity": qty,
                        "price": float(item.price),
                    }
                )
                total += Decimal(str(item.price)) * qty

            order_status = random.choices(list(OrderStatus), weights=ORDER_STATUS_WEIGHTS)[0]
            created_at = _past(random.randint(1, 60), random.randint(0, 23))
            completed_at = (
                created_at + timedelta(minutes=random.randint(30, 120))
                if order_status == OrderStatus.delivered
                else None
            )

            order = Order(
                resident_id=resident.id,
                partner_id=partner_user.id,
                status=order_status,
                items=items_data,
                total_price=total,
                delivery_type=DeliveryType.doorstep,
                completed_at=completed_at,
                created_at=created_at,
                updated_at=completed_at or created_at,
            )
            db.add(order)
            db.flush()
            created_orders += 1

            if order_status != OrderStatus.draft:
                pay_status = (
                    PaymentStatus.captured
                    if order_status
                    in (
                        OrderStatus.delivered,
                        OrderStatus.preparing,
                        OrderStatus.ready,
                        OrderStatus.dispatched,
                        OrderStatus.in_transit,
                    )
                    else PaymentStatus.pending
                )
                payment = Payment(
                    order_id=order.id,
                    resident_id=resident.id,
                    partner_id=partner_user.id,
                    amount=total,
                    currency="INR",
                    status=pay_status,
                    provider="direct_upi",
                    created_at=created_at,
                )
                db.add(payment)
                db.flush()
                created_payments += 1

            if order_status in (
                OrderStatus.dispatched,
                OrderStatus.in_transit,
                OrderStatus.delivered,
                OrderStatus.ready,
            ):
                del_status = (
                    DeliveryStatus.delivered
                    if order_status == OrderStatus.delivered
                    else DeliveryStatus.pending
                )
                db.add(
                    Delivery(
                        order_id=order.id,
                        partner_id=partner_user.id,
                        resident_id=resident.id,
                        status=del_status,
                        partner_flat=partner_user.flat_number,
                        resident_flat=resident.flat_number,
                        created_at=created_at + timedelta(minutes=20),
                    )
                )
                created_deliveries += 1

            if order_status == OrderStatus.delivered and random.random() > 0.30:
                db.add(
                    Rating(
                        order_id=order.id,
                        partner_id=partner_profile.id,
                        rater_id=resident.id,
                        score=random.randint(3, 5),
                        review_status=ReviewStatus.published,
                        created_at=completed_at + timedelta(days=1),
                    )
                )

    db.commit()
    print(
        f"  [OK] {created_orders} orders, {created_payments} payments, {created_deliveries} deliveries seeded"
    )


def main() -> None:
    print("\nSociety Food Platform -- Seed Script")
    create_tables()
    db: Session = SessionLocal()
    try:
        seed_admin(db)
        residents = seed_residents(db, NUM_RESIDENTS)
        partners = seed_partners(db, NUM_PARTNERS)
        menus = seed_menus(db, partners, MENUS_PER_PARTNER)
        seed_dish_suggestions(db, residents, partners)
        seed_orders_payments_deliveries(db, residents, partners, menus, ORDERS_PER_RESIDENT)
    finally:
        db.close()
    print("\nSeed complete! Password for all is:", SEED_PASSWORD)


if __name__ == "__main__":
    main()
