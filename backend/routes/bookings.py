"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import base64
import json as _json
import logging
import os
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import List, Optional

import bcrypt
import httpx
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from models import *
from routes.deps import db, logger, verify_token, create_token, EMERGENT_LLM_KEY, POSTMARK_WEBHOOK_SECRET, ROOT_DIR
from utils.email import (
    send_email,
    send_welcome_email,
    send_password_reset_email,
    send_booking_confirmation_email,
    send_booking_notification_email,
)
from utils.pdf import stamp_signature_on_document
from utils.saved_search import match_property_against_searches
from utils.helpers import get_usd_ils_rate, parse_ical_feed, sync_property_ical
from utils.files import extract_text_from_pdf, extract_text_from_docx, extract_text_from_image
from utils.translate import translate_text as _translate_text
from utils.contract_template import ensure_templates as ensure_contract_templates

from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/bookings")
async def create_booking(booking_data: BookingCreate, payload = Depends(verify_token)):
    property_data = await db.properties.find_one({"id": booking_data.property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # No contract signature required at booking time
    # Contract will be sent after owner accepts for long-term/short-term rentals
    
    booking_id = str(uuid.uuid4())
    booking_doc = booking_data.model_dump()
    booking_doc['id'] = booking_id
    booking_doc['renter_id'] = payload['user_id']
    booking_doc['owner_id'] = property_data['owner_id']
    
    # Auto-confirm for vacation rentals, pending for long-term and short-term
    if property_data.get('rental_type') == 'vacation':
        booking_doc['status'] = 'confirmed'
        notification_message = f"Your booking for {property_data['title']} is confirmed!"
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
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(renter_notification)
    else:
        booking_doc['status'] = 'pending'
        notification_message = f"New booking request for {property_data['title']}"
        notification_type = "booking_request"
    
    booking_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.bookings.insert_one(booking_doc)
    
    # Notify owner of booking request (or confirmation for vacation)
    owner_notification = {
        "id": str(uuid.uuid4()),
        "user_id": property_data['owner_id'],
        "type": notification_type,
        "property_id": booking_data.property_id,
        "booking_id": booking_id,
        "message": notification_message if booking_doc['status'] == 'pending' else f"New vacation rental booking for {property_data['title']}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(owner_notification)

    # --- Send transactional emails via Postmark (fire-and-forget) ---
    try:
        renter = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "email": 1, "name": 1})
        owner = await db.users.find_one({"id": property_data['owner_id']}, {"_id": 0, "email": 1, "name": 1})
        currency = property_data.get('currency', 'ILS')

        # Compute total for vacation rentals (nights * nightly_price)
        total_price = None
        if property_data.get('rental_type') == 'vacation' and property_data.get('nightly_price'):
            try:
                start = datetime.fromisoformat(booking_data.start_date.replace('Z', ''))
                end = datetime.fromisoformat(booking_data.end_date.replace('Z', ''))
                nights = max(1, (end - start).days)
                total_price = float(property_data['nightly_price']) * nights
            except Exception:
                total_price = None

        if renter and renter.get('email'):
            asyncio.create_task(send_booking_confirmation_email(
                to_email=renter['email'],
                guest_name=renter.get('name', ''),
                property_title=property_data.get('title', 'your rental'),
                property_location=property_data.get('location', property_data.get('area', '')),
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
                property_title=property_data.get('title', 'your property'),
                property_location=property_data.get('location', property_data.get('area', '')),
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


@api_router.get("/bookings")
async def get_bookings(payload = Depends(verify_token)):
    query = {}
    if payload['role'] == 'renter':
        query['renter_id'] = payload['user_id']
    elif payload['role'] == 'owner' or payload['role'] == 'manager':
        query['owner_id'] = payload['user_id']
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich bookings with property details
    for booking in bookings:
        property_data = await db.properties.find_one(
            {"id": booking['property_id']}, 
            {"_id": 0, "title": 1, "location": 1, "rental_type": 1}
        )
        if property_data:
            booking['property_title'] = property_data.get('title', 'Unknown Property')
            booking['property_location'] = property_data.get('location', '')
            booking['property_rental_type'] = property_data.get('rental_type', '')
    
    return bookings

# Booking Cancellation Endpoints


@api_router.post("/bookings/{booking_id}/accept")
async def accept_booking(booking_id: str, payload=Depends(verify_token)):
    """Owner/Manager accepts a pending booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is owner or manager
    if payload['role'] not in ['owner', 'manager'] or booking['owner_id'] != payload['user_id']:
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
            "confirmed_at": datetime.now(timezone.utc).isoformat()
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
                "contract_sent_at": datetime.now(timezone.utc).isoformat(),
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
            "created_at": datetime.now(timezone.utc).isoformat()
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
            "created_at": datetime.now(timezone.utc).isoformat()
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
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(renter_notification)
        
        return {
            "message": "Booking accepted successfully",
            "contract_sent": False
        }


@api_router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, reason: str = Body(..., embed=True), payload=Depends(verify_token)):
    """Owner/Manager direct cancellation"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is owner or manager
    if payload['role'] not in ['owner', 'manager'] or booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": payload['user_id'],
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancellation_reason": reason
        }}
    )
    
    # Notify renter
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "booking_cancelled",
        "booking_id": booking_id,
        "message": f"Your booking has been cancelled by the owner. Reason: {reason}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
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


@api_router.post("/bookings/{booking_id}/request-cancel")
async def request_cancel_booking(booking_id: str, reason: str = Body(..., embed=True), payload=Depends(verify_token)):
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
            "cancellation_requested_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Cancellation request submitted"}


@api_router.post("/bookings/{booking_id}/sign-contract")
async def sign_booking_contract(booking_id: str, body: dict = Body(...), payload=Depends(verify_token)):
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
                from reportlab.lib.pagesizes import letter

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

                # Print the signer's legal name below the signature for legal clarity.
                # Font size scaled with signature width, but clamped to a readable range.
                name_font_size = max(10.0, min(16.0, sig_w / 20.0))
                pad = max(8.0, sig_h * 0.12)
                name_y_pdf = max(0, pdf_y - pad - name_font_size)
                # Draw "Name: " bold-ish via two chars then regular name
                c.setFillColorRGB(0.08, 0.08, 0.08)
                c.setFont("Helvetica-Bold", name_font_size)
                c.drawString(sig_x, name_y_pdf, "Name: ")
                label_width = c.stringWidth("Name: ", "Helvetica-Bold", name_font_size)
                c.setFont("Helvetica", name_font_size)
                c.drawString(sig_x + label_width, name_y_pdf, legal_name)
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

                # Resize signature to scaled dimensions
                signature_img_scaled = signature_img.resize((sig_w, sig_h), Image.Resampling.LANCZOS)

                # Create a transparent layer for signature
                signature_layer = Image.new('RGBA', contract_img.size, (255, 255, 255, 0))
                signature_layer.paste(signature_img_scaled, (sig_x, sig_y), signature_img_scaled)

                # Draw the signer's legal name just below the signature, on the
                # same transparent layer so it composites cleanly.
                from PIL import ImageDraw, ImageFont
                draw = ImageDraw.Draw(signature_layer)
                # Font size scaled with signature width; fall back to default if ttf missing
                font_size = max(14, min(32, int(sig_w / 16)))
                try:
                    font_reg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
                    font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
                except Exception:
                    font_reg = font_bold = ImageFont.load_default()

                # Padding between signature box and printed name (larger on big contracts)
                pad = max(12, int(sig_h * 0.12))
                name_y = sig_y + sig_h + pad
                # If we'd overflow the page, stack the name just above the signature instead
                if name_y + font_size + 4 > native_h:
                    name_y = max(0, sig_y - font_size - pad)

                label = "Name: "
                name_val = legal_name
                # Draw "Name: " in bold, then the actual legal name in regular for clarity
                label_w = draw.textlength(label, font=font_bold) if hasattr(draw, 'textlength') else font_size * len(label) * 0.55
                draw.text((sig_x, name_y), label, fill=(20, 20, 20, 255), font=font_bold)
                draw.text((sig_x + int(label_w), name_y), name_val, fill=(20, 20, 20, 255), font=font_reg)

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
        "signer_legal_name": legal_name,
        "contract_signed_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(owner_notification)
    
    return {
        "message": "Contract signed successfully",
        "booking_status": "confirmed",
        "signed_contract_url": signed_contract_url
    }


@api_router.post("/bookings/{booking_id}/approve-cancel")
async def approve_cancel_request(booking_id: str, payload=Depends(verify_token)):
    """Owner approves cancellation request"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is owner or manager
    if payload['role'] not in ['owner', 'manager'] or booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking.get('status') != 'cancellation_requested':
        raise HTTPException(status_code=400, detail="No cancellation request pending")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": payload['user_id'],
            "cancelled_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat()
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


@api_router.post("/bookings/{booking_id}/deny-cancel")
async def deny_cancel_request(booking_id: str, denial_reason: str = Body(..., embed=True), payload=Depends(verify_token)):
    """Owner denies cancellation request"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is owner or manager
    if payload['role'] not in ['owner', 'manager'] or booking['owner_id'] != payload['user_id']:
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
            "cancellation_denied_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Cancellation request denied"}


# --- Subleases ---


@api_router.post("/bookings/{booking_id}/translate-contract")
async def translate_booking_contract(booking_id: str, body: dict = Body(default={}), payload=Depends(verify_token)):
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
            "contract_translated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {
        "translated_text": translated,
        "original_text": text,
        "direction": direction,
        "status": "completed",
        "cached": False,
    }
