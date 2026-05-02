"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import base64
import uuid
from datetime import UTC, datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from models import BookingCreate
from models_response import (
    BookingAcceptResponse,
    BookingCreateResponse,
    BookingOut,
    BookingSignContractResponse,
    BookingTranslationResponse,
    MessageResponse,
)
from routes.deps import ROOT_DIR, db, logger, verify_token
from utils.email import (
    send_booking_confirmation_email,
    send_booking_notification_email,
    send_email,
)
from utils.files import extract_text_from_image, extract_text_from_pdf
from utils.saved_search import match_property_against_searches
from utils.translate import translate_text as _translate_text

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/bookings", response_model=BookingCreateResponse)
async def create_booking(booking_data: BookingCreate, payload: dict = Depends(verify_token)) -> dict:
    property_data = await db.properties.find_one({"id": booking_data.property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")

    # If this booking is tied to a sublease, route it to the sublessor and
    # use the sublease's price/dates for downstream calculations. The
    # underlying property owner is NOT notified.
    sublease_data: dict | None = None
    if booking_data.sublease_id:
        sublease_data = await db.subleases.find_one(
            {"id": booking_data.sublease_id}, {"_id": 0}
        )
        if not sublease_data:
            raise HTTPException(status_code=404, detail="Sublease not found")
        if not sublease_data.get("active", True):
            raise HTTPException(status_code=400, detail="This sublease is no longer active")

    # No contract signature required at booking time
    # Contract will be sent after owner accepts for long-term/short-term rentals

    # Reject overlapping bookings up front so we never end up with two
    # confirmed/pending bookings on the same property for the same dates.
    # Same overlap rule used by /properties search: start < new_end AND end > new_start.
    # For SUBLEASE bookings, we deliberately scope the overlap check to OTHER
    # bookings on the SAME sublease — the sublessor's own underlying long-term
    # booking covers the entire sublease window, so a global property-level
    # check would always reject (defeating the whole sublease feature).
    if booking_data.sublease_id:
        overlap_filter: dict = {
            "sublease_id": booking_data.sublease_id,
            "status": {"$in": ["pending", "confirmed"]},
            "start_date": {"$lt": booking_data.end_date},
            "end_date": {"$gt": booking_data.start_date},
        }
    else:
        overlap_filter = {
            "property_id": booking_data.property_id,
            # Ignore sublease-scoped bookings here — they live in a separate
            # logical calendar (the sublease window).
            "sublease_id": None,
            "status": {"$in": ["pending", "confirmed"]},
            "start_date": {"$lt": booking_data.end_date},
            "end_date": {"$gt": booking_data.start_date},
        }
    overlap = await db.bookings.find_one(
        overlap_filter,
        {"_id": 0, "id": 1, "start_date": 1, "end_date": 1},
    )
    if overlap:
        raise HTTPException(
            status_code=409,
            detail=(
                "These dates overlap an existing booking "
                f"({overlap['start_date']} → {overlap['end_date']}). "
                "Please pick dates outside that window."
            ),
        )

    booking_id = str(uuid.uuid4())
    booking_doc = booking_data.model_dump()
    booking_doc['id'] = booking_id
    booking_doc['renter_id'] = payload['user_id']
    # Route owner_id: sublessor for sublease bookings, property owner otherwise
    booking_doc['owner_id'] = (
        sublease_data['subleasor_id'] if sublease_data else property_data['owner_id']
    )

    # Auto-confirm for vacation rentals only. Sublease bookings now require
    # the sublessor to accept/deny just like long-term/short-term bookings —
    # the renter sends a request, the sublessor (the lister of the sublease)
    # gets a "booking_request" notification and confirms it from their dashboard.
    is_instant_confirm = property_data.get('rental_type') == 'vacation' and sublease_data is None
    if is_instant_confirm:
        booking_doc['status'] = 'confirmed'
        listing_title = property_data['title']
        notification_message = f"Your booking for {listing_title} is confirmed!"
        notification_type = "booking_confirmed"
        # Notify renter of confirmation
        renter_notification = {
            "id": str(uuid.uuid4()),
            "user_id": payload['user_id'],
            "type": notification_type,
            "property_id": booking_data.property_id,
            "booking_id": booking_id,
            "message": notification_message,
            "read": False,
            "created_at": datetime.now(UTC).isoformat()
        }
        await db.notifications.insert_one(renter_notification)
    else:
        booking_doc['status'] = 'pending'
        listing_title = (
            sublease_data.get('title') if sublease_data else property_data['title']
        )
        notification_message = f"New booking request for {listing_title}"
        notification_type = "booking_request"

    booking_doc['created_at'] = datetime.now(UTC).isoformat()
    await db.bookings.insert_one(booking_doc)

    # Notify the sublessor (sublease) or property owner (regular) of the new booking
    target_user_id = booking_doc['owner_id']
    target_listing_title = (
        sublease_data.get('title') if sublease_data else property_data['title']
    )
    owner_notification = {
        "id": str(uuid.uuid4()),
        "user_id": target_user_id,
        "type": notification_type,
        "property_id": booking_data.property_id,
        "booking_id": booking_id,
        "message": (
            notification_message
            if booking_doc['status'] == 'pending'
            else f"New booking for {target_listing_title}"
        ),
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(owner_notification)

    # --- Send transactional emails via Postmark (fire-and-forget) ---
    try:
        renter = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "email": 1, "name": 1})
        owner = await db.users.find_one({"id": target_user_id}, {"_id": 0, "email": 1, "name": 1})

        # Use sublease's currency/price/title when this is a sublease booking
        currency = (
            sublease_data.get('currency', 'ILS') if sublease_data
            else property_data.get('currency', 'ILS')
        )
        listing_title = target_listing_title
        listing_location = (
            sublease_data.get('area', '') if sublease_data
            else property_data.get('location', property_data.get('area', ''))
        )

        # Compute total
        total_price: float | None = None
        try:
            start = datetime.fromisoformat(booking_data.start_date.replace('Z', ''))
            end = datetime.fromisoformat(booking_data.end_date.replace('Z', ''))
            nights = max(1, (end - start).days)
        except Exception:
            nights = 1
        if sublease_data:
            if sublease_data.get('price_type') == 'per_night':
                total_price = float(sublease_data.get('price', 0)) * nights
            else:
                # Flat rate — one total
                total_price = float(sublease_data.get('price', 0))
        elif property_data.get('rental_type') == 'vacation' and property_data.get('nightly_price'):
            total_price = float(property_data['nightly_price']) * nights

        if renter and renter.get('email'):
            asyncio.create_task(send_booking_confirmation_email(
                to_email=renter['email'],
                guest_name=renter.get('name', ''),
                property_title=listing_title,
                property_location=listing_location,
                check_in=booking_data.start_date,
                check_out=booking_data.end_date,
                total_price=total_price,
                currency=currency,
                booking_id=booking_id,
                status=booking_doc['status'],
            ))

        if owner and owner.get('email'):
            asyncio.create_task(send_booking_notification_email(
                to_email=owner['email'],
                owner_name=owner.get('name', ''),
                guest_name=(renter or {}).get('name', 'A guest'),
                guest_email=(renter or {}).get('email', ''),
                property_title=listing_title,
                property_location=listing_location,
                check_in=booking_data.start_date,
                check_out=booking_data.end_date,
                total_price=total_price,
                currency=currency,
                booking_id=booking_id,
                is_pending=(booking_doc['status'] == 'pending'),
            ))
    except Exception as e:
        logger.warning(f"Failed to queue booking emails for booking {booking_id}: {e}")

    return {"id": booking_id, "status": booking_doc['status'], "message": "Booking confirmed!" if booking_doc['status'] == 'confirmed' else "Booking request sent successfully"}


@api_router.get("/bookings", response_model=list[BookingOut])
async def get_bookings(payload: dict = Depends(verify_token)) -> list[dict]:
    query: dict = {}
    if payload['role'] == 'renter':
        # Renters see bookings where they are the guest OR where they're
        # the sublessor (owner_id on a sublease booking points to them).
        query['$or'] = [
            {'renter_id': payload['user_id']},
            {'owner_id': payload['user_id']},
        ]
    elif payload['role'] == 'owner' or payload['role'] == 'manager':
        query['owner_id'] = payload['user_id']
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich bookings with property details (or sublease details when the
    # booking was for a sublease — sublessors should see the sublease title
    # in their dashboard, not the underlying property's).
    for booking in bookings:
        if booking.get('sublease_id'):
            sub = await db.subleases.find_one(
                {"id": booking['sublease_id']},
                {"_id": 0, "title": 1, "area": 1},
            )
            if sub:
                booking['property_title'] = sub.get('title', 'Sublease')
                booking['property_location'] = sub.get('area', '')
                booking['property_rental_type'] = 'sublease'
                continue

        property_data = await db.properties.find_one(
            {"id": booking['property_id']},
            {"_id": 0, "title": 1, "location": 1, "rental_type": 1},
        )
        if property_data:
            booking['property_title'] = property_data.get('title', 'Unknown Property')
            booking['property_location'] = property_data.get('location', '')
            booking['property_rental_type'] = property_data.get('rental_type', '')
    
    return bookings

# Booking Cancellation Endpoints


@api_router.post("/bookings/{booking_id}/accept", response_model=BookingAcceptResponse)
async def accept_booking(booking_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Owner/Manager accepts a pending booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Authorization: the booking's "owner" (listing owner OR sublessor) accepts.
    if booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if booking is pending
    if booking['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Only pending bookings can be accepted")
    
    # Get property details
    property_data = await db.properties.find_one({"id": booking['property_id']}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Update booking to confirmed
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "confirmed",
            "confirmed_at": datetime.now(UTC).isoformat()
        }}
    )

    # Send acceptance email to the renter (Postmark, fire-and-forget)
    try:
        renter = await db.users.find_one({"id": booking['renter_id']}, {"_id": 0, "email": 1, "name": 1})
        if renter and renter.get('email'):
            asyncio.create_task(send_booking_confirmation_email(
                to_email=renter['email'],
                guest_name=renter.get('name', ''),
                property_title=property_data.get('title', 'your rental'),
                property_location=property_data.get('location', property_data.get('area', '')),
                check_in=booking.get('start_date', ''),
                check_out=booking.get('end_date', ''),
                total_price=None,
                currency=property_data.get('currency', 'ILS'),
                booking_id=booking_id,
                status='confirmed',
            ))
    except Exception as e:
        logger.warning(f"Failed to queue acceptance email for booking {booking_id}: {e}")
    
    # Check if property has a contract (check both contract_path and contract_url)
    if property_data.get('contract_path') or property_data.get('contract_url'):
        # Create a contract signing request for the renter
        contract_sign_token = str(uuid.uuid4())
        
        # Store contract signing info in booking
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {
                "contract_sign_token": contract_sign_token,
                "contract_sent_at": datetime.now(UTC).isoformat(),
                "contract_signed": False
            }}
        )
        
        # Notify renter to sign the contract
        renter_notification = {
            "id": str(uuid.uuid4()),
            "user_id": booking['renter_id'],
            "type": "contract_pending",
            "booking_id": booking_id,
            "property_id": booking['property_id'],
            "message": f"Your booking for {property_data.get('title', 'the property')} was accepted! Please sign the rental contract to complete your booking.",
            "read": False,
            "created_at": datetime.now(UTC).isoformat()
        }
        await db.notifications.insert_one(renter_notification)
        
        # Notify owner that contract was sent
        owner_notification = {
            "id": str(uuid.uuid4()),
            "user_id": booking['owner_id'],
            "type": "contract_sent",
            "booking_id": booking_id,
            "property_id": booking['property_id'],
            "message": f"The rental contract for {property_data.get('title', 'your property')} has been automatically sent to the renter for signing.",
            "read": False,
            "created_at": datetime.now(UTC).isoformat()
        }
        await db.notifications.insert_one(owner_notification)
        
        return {
            "message": "Booking accepted and contract sent to renter for signing",
            "contract_sent": True
        }
    else:
        # No contract - just notify renter of acceptance
        renter_notification = {
            "id": str(uuid.uuid4()),
            "user_id": booking['renter_id'],
            "type": "booking_confirmed",
            "booking_id": booking_id,
            "property_id": booking['property_id'],
            "message": f"Your booking request for {property_data.get('title', 'the property')} has been accepted!",
            "read": False,
            "created_at": datetime.now(UTC).isoformat()
        }
        await db.notifications.insert_one(renter_notification)
        
        return {
            "message": "Booking accepted successfully",
            "contract_sent": False
        }


@api_router.post("/bookings/{booking_id}/cancel", response_model=MessageResponse)
async def cancel_booking(booking_id: str, reason: str = Body(..., embed=True), payload: dict = Depends(verify_token)) -> dict:
    """Owner/Manager direct cancellation"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Authorization: the user identified by ``booking.owner_id`` may cancel —
    # this is the listing owner/manager for regular bookings, OR the sublessor
    # for sublease bookings (we re-write owner_id to the sublessor's id when
    # creating sublease bookings so they own the calendar).
    if booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": payload['user_id'],
            "cancelled_at": datetime.now(UTC).isoformat(),
            "cancellation_reason": reason
        }}
    )
    
    # The lister (owner or sublessor) is cancelling — notify the renter.
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "booking_cancelled",
        "booking_id": booking_id,
        "message": f"Your booking has been cancelled by the lister. Reason: {reason}",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)

    # Fire saved-search alerts — the freed-up dates might match pending alerts
    try:
        asyncio.create_task(match_property_against_searches(
            db, booking['property_id'], reason="booking_freed", send_email_fn=send_email,
        ))
    except Exception as e:
        logger.warning(f"saved-search trigger failed (cancel): {e}")

    return {"message": "Booking cancelled successfully"}


@api_router.post("/bookings/{booking_id}/request-cancel", response_model=MessageResponse)
async def request_cancel_booking(booking_id: str, reason: str = Body(..., embed=True), payload: dict = Depends(verify_token)) -> dict:
    """Renter requests cancellation"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is the renter
    if booking['renter_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save previous status before changing
    previous_status = booking.get('status', 'confirmed')
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancellation_requested",
            "previous_status": previous_status,
            "cancellation_reason": reason,
            "cancellation_requested_at": datetime.now(UTC).isoformat()
        }}
    )
    
    # Notify owner
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['owner_id'],
        "type": "cancellation_request",
        "booking_id": booking_id,
        "message": f"Renter has requested to cancel their booking. Reason: {reason}",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Cancellation request submitted"}


@api_router.post("/bookings/{booking_id}/sign-contract", response_model=BookingSignContractResponse)
async def sign_booking_contract(booking_id: str, body: dict = Body(...), payload: dict = Depends(verify_token)) -> dict:
    """Renter signs the rental contract after owner acceptance"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is the renter
    if booking['renter_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if contract was sent
    if not booking.get('contract_sign_token'):
        raise HTTPException(status_code=400, detail="No contract to sign for this booking")
    
    # Check if already signed
    if booking.get('contract_signed'):
        raise HTTPException(status_code=400, detail="Contract already signed")
    
    signature_data = body.get('signature_data', '')
    signature_x = body.get('signature_x', 0)
    signature_y = body.get('signature_y', 0)
    signature_width = body.get('signature_width', 200)
    signature_height = body.get('signature_height', 100)
    # Displayed contract dimensions in the signing UI. Used to scale signature
    # coordinates from CSS pixels to the native image/PDF coordinate system.
    display_width = body.get('display_width')
    display_height = body.get('display_height')
    legal_name = (body.get('legal_name') or '').strip()

    if not signature_data:
        raise HTTPException(status_code=400, detail="Signature data is required")
    if not legal_name:
        raise HTTPException(status_code=400, detail="Full legal name is required")
    
    # Get property to retrieve contract
    property_data = await db.properties.find_one({"id": booking['property_id']}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    signed_contract_url = None
    
    # If property has a contract, stamp the signature onto it
    if property_data.get('contract_url'):
        try:
            # Get the original contract filename from URL
            contract_filename = property_data['contract_url'].split('/')[-1]
            contract_path = ROOT_DIR / "uploads" / contract_filename
            
            if not contract_path.exists():
                raise HTTPException(status_code=404, detail="Contract file not found")
            
            # Determine file type
            file_ext = contract_path.suffix.lower()
            
            # Generate signed contract filename
            signed_filename = f"signed_{booking_id}_{contract_filename}"
            signed_path = ROOT_DIR / "uploads" / signed_filename
            
            # Convert base64 signature to image
            from PIL import Image
            signature_image_data = signature_data.split(',')[1] if ',' in signature_data else signature_data
            signature_bytes = base64.b64decode(signature_image_data)
            signature_img = Image.open(BytesIO(signature_bytes)).convert("RGBA")

            if file_ext == '.pdf':
                # Handle PDF signing
                from PyPDF2 import PdfReader, PdfWriter
                from reportlab.pdfgen import canvas

                # Read original PDF
                reader = PdfReader(str(contract_path))
                writer = PdfWriter()

                # Get first page dimensions (in PDF points)
                first_page = reader.pages[0]
                page_width = float(first_page.mediabox.width)
                page_height = float(first_page.mediabox.height)

                # Scale signature coords from display pixels -> PDF points
                if display_width and display_height:
                    scale_x = page_width / float(display_width)
                    scale_y = page_height / float(display_height)
                else:
                    scale_x = scale_y = 1.0
                sig_x = signature_x * scale_x
                sig_y = signature_y * scale_y
                sig_w = signature_width * scale_x
                sig_h = signature_height * scale_y

                # Trim transparent margin off the signature so we anchor the
                # name to the actual visible scribble — when the user signs
                # in a tiny corner of a huge canvas, the bounding-box-based
                # name placement otherwise floats far away from the ink.
                bbox = signature_img.getbbox()
                if bbox is not None:
                    bx0, by0, bx1, by1 = bbox
                    iw, ih = signature_img.size
                    if iw > 0 and ih > 0 and (bx0 > 0 or by0 > 0 or bx1 < iw or by1 < ih):
                        signature_img = signature_img.crop(bbox)
                        # Shift the box's top-left to where the scribble starts,
                        # and shrink the box to the scribble's actual size.
                        sig_x = sig_x + (bx0 / iw) * sig_w
                        sig_y = sig_y + (by0 / ih) * sig_h
                        sig_w = ((bx1 - bx0) / iw) * sig_w
                        sig_h = ((by1 - by0) / ih) * sig_h

                # Resize signature image to specified (scaled) dimensions
                signature_img_scaled = signature_img.resize(
                    (max(1, int(sig_w)), max(1, int(sig_h))), Image.Resampling.LANCZOS
                )

                # Create signature overlay on first page
                signature_overlay = BytesIO()
                c = canvas.Canvas(signature_overlay, pagesize=(page_width, page_height))

                # Save signature as temp PNG for reportlab
                temp_sig_path = ROOT_DIR / "uploads" / f"temp_sig_{booking_id}.png"
                signature_img_scaled.save(str(temp_sig_path), "PNG")

                # Draw signature on PDF (convert y coordinate as PDF origin is bottom-left)
                pdf_y = page_height - sig_y - sig_h
                c.drawImage(str(temp_sig_path), sig_x, pdf_y,
                           width=sig_w, height=sig_h,
                           mask='auto', preserveAspectRatio=True)

                # Print the signer's legal name DIRECTLY BELOW the signature.
                # If there literally isn't a sliver of room, place it as low
                # as possible (clamped to the page) — never above, since that
                # caused the "northwest of the scribble" complaint.
                # Font scales with scribble height for a similar visual weight.
                name_font_size = max(32.0, min(80.0, sig_h * 1.1))
                pad = max(6.0, sig_h * 0.18)
                name_y_below = pdf_y - pad - name_font_size
                # Clamp to bottom of page; we never go above the signature.
                name_y_pdf = max(0.0, name_y_below)
                # Horizontally CENTER the "Name: <legal_name>" string under
                # the signature box. Starting at sig_x (the box's left edge)
                # makes the name look offset from the visible scribble
                # whenever the user drew it in the middle/right of the
                # signature canvas — exactly what was reported as the name
                # appearing "northwest" of the signature.
                c.setFillColorRGB(0.08, 0.08, 0.08)
                label = "Name: "
                label_width = c.stringWidth(label, "Helvetica-Bold", name_font_size)
                name_width = c.stringWidth(legal_name, "Helvetica", name_font_size)
                total_width = label_width + name_width
                # Center the combined label+name within the signature box.
                # Clamp to the page so very long names don't run off.
                name_x = sig_x + max(0.0, (sig_w - total_width) / 2.0)
                if name_x + total_width > page_width:
                    name_x = max(0.0, page_width - total_width - 4.0)
                c.setFont("Helvetica-Bold", name_font_size)
                c.drawString(name_x, name_y_pdf, label)
                c.setFont("Helvetica", name_font_size)
                c.drawString(name_x + label_width, name_y_pdf, legal_name)
                c.save()

                # Merge signature overlay with first page
                signature_overlay.seek(0)
                signature_pdf = PdfReader(signature_overlay)
                first_page.merge_page(signature_pdf.pages[0])
                writer.add_page(first_page)

                # Add remaining pages
                for page_num in range(1, len(reader.pages)):
                    writer.add_page(reader.pages[page_num])

                # Write signed PDF
                with open(signed_path, 'wb') as output_file:
                    writer.write(output_file)

                # Clean up temp signature file
                temp_sig_path.unlink(missing_ok=True)

            else:
                # Handle image signing (jpg, png, etc.)
                contract_img = Image.open(contract_path).convert("RGBA")
                native_w, native_h = contract_img.size

                # Scale signature coords from display pixels -> native image pixels
                if display_width and display_height:
                    scale_x = native_w / float(display_width)
                    scale_y = native_h / float(display_height)
                else:
                    scale_x = scale_y = 1.0
                sig_x = int(signature_x * scale_x)
                sig_y = int(signature_y * scale_y)
                sig_w = max(1, int(signature_width * scale_x))
                sig_h = max(1, int(signature_height * scale_y))

                # Trim transparent margin off the signature so we anchor the
                # name to the actual visible scribble (instead of the full
                # canvas box, which tends to be huge with a tiny scribble in
                # the corner).
                bbox = signature_img.getbbox()
                if bbox is not None:
                    bx0, by0, bx1, by1 = bbox
                    iw, ih = signature_img.size
                    if iw > 0 and ih > 0 and (bx0 > 0 or by0 > 0 or bx1 < iw or by1 < ih):
                        signature_img = signature_img.crop(bbox)
                        sig_x = sig_x + int((bx0 / iw) * sig_w)
                        sig_y = sig_y + int((by0 / ih) * sig_h)
                        sig_w = max(1, int(((bx1 - bx0) / iw) * sig_w))
                        sig_h = max(1, int(((by1 - by0) / ih) * sig_h))

                # Resize signature to scaled dimensions
                signature_img_scaled = signature_img.resize((sig_w, sig_h), Image.Resampling.LANCZOS)

                # Create a transparent layer for signature
                signature_layer = Image.new('RGBA', contract_img.size, (255, 255, 255, 0))
                signature_layer.paste(signature_img_scaled, (sig_x, sig_y), signature_img_scaled)

                # Draw the signer's legal name just below the signature, on the
                # same transparent layer so it composites cleanly.
                from PIL import ImageDraw, ImageFont
                draw = ImageDraw.Draw(signature_layer)
                # Font size scaled with TRIMMED signature height so the
                # printed name reads at a similar visual weight to the
                # actual handwritten scribble. Generous upper cap since
                # we now anchor on the real ink region.
                font_size = max(56, min(180, int(sig_h * 1.1)))
                font_reg: Any
                font_bold: Any
                try:
                    font_reg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
                    font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
                except Exception:
                    font_reg = font_bold = ImageFont.load_default()

                # Padding between signature box and printed name (larger on big contracts)
                pad = max(12, int(sig_h * 0.18))
                # Always render the legal name BELOW the signature (clamped
                # to the page bottom if needed). Never above — that caused
                # the "northwest of the scribble" complaint.
                name_y = min(sig_y + sig_h + pad, native_h - font_size - 4)
                if name_y < 0:
                    name_y = 0

                label = "Name: "
                name_val = legal_name
                # Horizontally center the "Name: <legal_name>" string under
                # the signature box for the same reason as the PDF path.
                if hasattr(draw, 'textlength'):
                    label_w = draw.textlength(label, font=font_bold)
                    name_w = draw.textlength(name_val, font=font_reg)
                else:
                    # Older Pillow fallback — approximate width
                    label_w = font_size * len(label) * 0.55
                    name_w = font_size * len(name_val) * 0.55
                total_w = label_w + name_w
                name_x_start = sig_x + max(0, int((sig_w - total_w) / 2))
                if name_x_start + int(total_w) > native_w:
                    name_x_start = max(0, native_w - int(total_w) - 4)
                # Draw "Name: " in bold, then the actual legal name in regular for clarity
                draw.text((name_x_start, name_y), label, fill=(20, 20, 20, 255), font=font_bold)
                draw.text((name_x_start + int(label_w), name_y), name_val, fill=(20, 20, 20, 255), font=font_reg)

                # Composite signature + legal-name onto contract
                signed_image = Image.alpha_composite(contract_img, signature_layer)

                # Convert back to RGB if saving as JPEG
                if file_ext in ['.jpg', '.jpeg']:
                    signed_image = signed_image.convert('RGB')

                signed_image.save(signed_path)

            signed_contract_url = f"/api/uploads/{signed_filename}"
            
        except Exception as e:
            logger.error(f"Failed to stamp signature on contract: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to process signature: {e}")
    
    # Update booking with signature and signed contract
    update_data = {
        "contract_signed": True,
        "signature_data": signature_data,
        "signature_position": {"x": signature_x, "y": signature_y, "width": signature_width, "height": signature_height},
        # Persist the signing-canvas dimensions so we can faithfully re-stamp
        # this contract later (e.g. when stamping logic improves) without
        # asking the renter to re-sign. Falls back to None on legacy clients
        # that don't pass these values.
        "signature_display": {"width": display_width, "height": display_height},
        "signer_legal_name": legal_name,
        "contract_signed_at": datetime.now(UTC).isoformat()
    }
    
    if signed_contract_url:
        update_data["signed_contract_url"] = signed_contract_url
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": update_data}
    )
    
    # Notify owner that contract was signed
    message = f"The rental contract for {property_data.get('title', 'your property')} has been signed by the renter. The booking is now fully confirmed!"
    if signed_contract_url:
        message += " View the signed contract in the booking details."
    
    owner_notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['owner_id'],
        "type": "contract_signed",
        "booking_id": booking_id,
        "property_id": booking['property_id'],
        "message": message,
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(owner_notification)
    
    return {
        "message": "Contract signed successfully",
        "booking_status": "confirmed",
        "signed_contract_url": signed_contract_url
    }


@api_router.post("/bookings/{booking_id}/approve-cancel", response_model=MessageResponse)
async def approve_cancel_request(booking_id: str, payload: dict = Depends(verify_token)) -> dict:
    """Owner approves cancellation request"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Authorization: the booking's "owner" (listing owner OR sublessor) approves.
    if booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking.get('status') != 'cancellation_requested':
        raise HTTPException(status_code=400, detail="No cancellation request pending")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": payload['user_id'],
            "cancelled_at": datetime.now(UTC).isoformat()
        }}
    )
    
    # Notify renter
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "cancellation_approved",
        "booking_id": booking_id,
        "message": "Your cancellation request has been approved",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)

    # Fire saved-search alerts — dates freed up
    try:
        asyncio.create_task(match_property_against_searches(
            db, booking['property_id'], reason="booking_freed", send_email_fn=send_email,
        ))
    except Exception as e:
        logger.warning(f"saved-search trigger failed (approve-cancel): {e}")

    return {"message": "Cancellation approved"}


@api_router.post("/bookings/{booking_id}/deny-cancel", response_model=MessageResponse)
async def deny_cancel_request(booking_id: str, denial_reason: str = Body(..., embed=True), payload: dict = Depends(verify_token)) -> dict:
    """Owner denies cancellation request"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Authorization: the booking's "owner" (listing owner OR sublessor) denies.
    if booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking.get('status') != 'cancellation_requested':
        raise HTTPException(status_code=400, detail="No cancellation request pending")
    
    # Revert to previous status (confirmed or pending)
    previous_status = booking.get('previous_status', 'confirmed')
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": previous_status,
            "cancellation_denied": True,
            "cancellation_denial_reason": denial_reason,
            "cancellation_denied_at": datetime.now(UTC).isoformat()
        },
         "$unset": {"cancellation_requested_at": ""}
        }
    )
    
    # Notify renter
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "cancellation_denied",
        "booking_id": booking_id,
        "message": f"Your cancellation request has been denied. Reason: {denial_reason}",
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Cancellation request denied"}


# --- Subleases ---


@api_router.post("/bookings/{booking_id}/translate-contract", response_model=BookingTranslationResponse)
async def translate_booking_contract(booking_id: str, body: dict = Body(default={}), payload: dict = Depends(verify_token)) -> dict:
    """Translate the property contract associated with a booking.

    Designed for RENTERS who receive a contract in a language they don't read.
    The translation is cached on the booking so repeat calls are free.
    Request body: { "direction": "he-en" | "en-he" }  (default "he-en")
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    # Renter (signing party) or the booking owner can request a translation
    if booking['renter_id'] != payload['user_id'] and booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")

    direction = (body.get('direction') or 'he-en').lower()

    # Return cached translation if direction matches
    if booking.get('contract_translated_text') and booking.get('contract_translation_direction') == direction:
        return {
            "translated_text": booking['contract_translated_text'],
            "direction": direction,
            "status": "completed",
            "cached": True,
        }

    property_data = await db.properties.find_one({"id": booking['property_id']}, {"_id": 0})
    if not property_data or not property_data.get('contract_url'):
        raise HTTPException(status_code=404, detail="No contract available for this booking")

    contract_filename = property_data['contract_url'].split('/')[-1]
    contract_path = ROOT_DIR / "uploads" / contract_filename
    if not contract_path.exists():
        raise HTTPException(status_code=404, detail="Contract file not found on server")

    ext = contract_path.suffix.lower()
    if ext == '.pdf':
        text = extract_text_from_pdf(str(contract_path))
    elif ext in ('.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'):
        text = extract_text_from_image(str(contract_path))
    else:
        raise HTTPException(status_code=400, detail="Unsupported contract format")

    if not text or len(text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Could not extract readable text from the contract. It may be a low-quality scan.")

    try:
        translated = await _translate_text(text, direction)
    except Exception as e:
        logger.error(f"Booking contract translation failed for {booking_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

    # Cache on booking to avoid repeated LLM calls
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "contract_original_text": text,
            "contract_translated_text": translated,
            "contract_translation_direction": direction,
            "contract_translated_at": datetime.now(UTC).isoformat(),
        }}
    )

    return {
        "translated_text": translated,
        "original_text": text,
        "direction": direction,
        "status": "completed",
        "cached": False,
    }
