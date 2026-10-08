"""Rating model -- resident reviews for completed orders."""

from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, TimestampMixin
from app.db.models.enums import ReviewStatus

if TYPE_CHECKING:
    from app.db.models.order import Order
    from app.db.models.partner_profile import PartnerProfile
    from app.db.models.user import User


class Rating(TimestampMixin, Base):
    """A rating (1-5 stars) left by a resident after a completed order."""

    __tablename__ = "ratings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # One rating per order -- enforced by unique constraint
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), nullable=False, index=True, unique=True
    )
    partner_id: Mapped[int] = mapped_column(
        ForeignKey("partner_profiles.id"), index=True, nullable=False
    )
    rater_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)

    # Score 1-5 (validated)
    score: Mapped[int] = mapped_column(Integer, nullable=False)

    # Optional written review
    review_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Moderation status
    review_status: Mapped[ReviewStatus] = mapped_column(
        SAEnum(ReviewStatus, name="reviewstatus", create_constraint=True),
        nullable=False,
        default=ReviewStatus.pending,
    )

    # -- Relationships ---------------------------------------------------------
    partner: Mapped["PartnerProfile"] = relationship("PartnerProfile", back_populates="ratings")
    rater: Mapped["User"] = relationship("User", foreign_keys=[rater_id])
    order: Mapped["Order"] = relationship("Order")

    # -- Validators ------------------------------------------------------------
    @validates("score")
    def validate_score(self, key: str, value: int) -> int:
        """Score must be between 1 and 5."""
        if not (1 <= int(value) <= 5):
            raise ValueError("Rating score must be between 1 and 5")
        return int(value)
