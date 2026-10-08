"""
Seller service — backward-compatibility shim mapping to partner_service.
All functions and symbols from partner_service are re-exported here.
"""

from app.services.partner_service import ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_MB, UPLOAD_DIR_PARTNERS
from app.services.partner_service import approve_partner
from app.services.partner_service import approve_partner as approve_seller
from app.services.partner_service import delete_partner_photo
from app.services.partner_service import delete_partner_photo as delete_seller_photo
from app.services.partner_service import get_partner_by_id
from app.services.partner_service import get_partner_by_id as get_seller_by_id
from app.services.partner_service import get_pending_partners
from app.services.partner_service import get_pending_partners as get_pending_sellers
from app.services.partner_service import list_approved_partners
from app.services.partner_service import list_approved_partners as list_approved_sellers
from app.services.partner_service import register_partner_profile
from app.services.partner_service import register_partner_profile as register_seller_profile
from app.services.partner_service import reject_partner
from app.services.partner_service import reject_partner as reject_seller
from app.services.partner_service import update_partner_profile
from app.services.partner_service import update_partner_profile as update_seller_profile
from app.services.partner_service import upload_partner_banner
from app.services.partner_service import upload_partner_banner as upload_seller_banner
from app.services.partner_service import upload_partner_photo
from app.services.partner_service import upload_partner_photo as upload_seller_photo
from app.services.partner_service import upload_partner_photos
from app.services.partner_service import upload_partner_photos as upload_seller_photos

UPLOAD_DIR_SELLERS = UPLOAD_DIR_PARTNERS

__all__ = [
    "UPLOAD_DIR_SELLERS",
    "UPLOAD_DIR_PARTNERS",
    "ALLOWED_IMAGE_TYPES",
    "MAX_IMAGE_SIZE_MB",
    "list_approved_sellers",
    "get_seller_by_id",
    "register_seller_profile",
    "update_seller_profile",
    "get_pending_sellers",
    "approve_seller",
    "reject_seller",
    "upload_seller_photo",
    "upload_seller_banner",
    "upload_seller_photos",
    "delete_seller_photo",
    "list_approved_partners",
    "get_partner_by_id",
    "register_partner_profile",
    "update_partner_profile",
    "get_pending_partners",
    "approve_partner",
    "reject_partner",
    "upload_partner_photo",
    "upload_partner_banner",
    "upload_partner_photos",
    "delete_partner_photo",
]
