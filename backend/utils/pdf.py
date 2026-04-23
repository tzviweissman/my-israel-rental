"""PDF manipulation utilities for contract signing"""
import base64
import logging
from io import BytesIO
from pathlib import Path

from PIL import Image
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)


async def stamp_signature_on_document(
    contract_path: Path,
    signature_data: str,
    signature_x: int,
    signature_y: int,
    signature_width: int,
    signature_height: int,
    output_path: Path
) -> bool:
    """
    Stamp a signature onto a contract document (PDF or image).
    
    Args:
        contract_path: Path to original contract
        signature_data: Base64 encoded signature image
        signature_x: X position for signature
        signature_y: Y position for signature  
        signature_width: Width of signature
        signature_height: Height of signature
        output_path: Path to save signed document
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Convert base64 signature to image
        signature_image_data = signature_data.split(',')[1] if ',' in signature_data else signature_data
        signature_bytes = base64.b64decode(signature_image_data)
        signature_img = Image.open(BytesIO(signature_bytes)).convert("RGBA")
        
        # Resize signature to specified dimensions
        signature_img = signature_img.resize((int(signature_width), int(signature_height)), Image.Resampling.LANCZOS)
        
        file_ext = contract_path.suffix.lower()
        
        if file_ext == '.pdf':
            return await _stamp_signature_on_pdf(
                contract_path, signature_img, signature_x, signature_y,
                signature_width, signature_height, output_path
            )
        else:
            return await _stamp_signature_on_image(
                contract_path, signature_img, signature_x, signature_y, output_path
            )
            
    except Exception as e:
        logger.error(f"Failed to stamp signature: {e}")
        return False


async def _stamp_signature_on_pdf(
    contract_path: Path,
    signature_img: Image.Image,
    signature_x: int,
    signature_y: int,
    signature_width: int,
    signature_height: int,
    output_path: Path
) -> bool:
    """Stamp signature on PDF document"""
    try:
        # Read original PDF
        reader = PdfReader(str(contract_path))
        writer = PdfWriter()
        
        # Get first page dimensions
        first_page = reader.pages[0]
        page_width = float(first_page.mediabox.width)
        page_height = float(first_page.mediabox.height)
        
        # Create signature overlay on first page
        signature_overlay = BytesIO()
        c = canvas.Canvas(signature_overlay, pagesize=(page_width, page_height))
        
        # Save signature as temp PNG for reportlab
        temp_sig_path = output_path.parent / f"temp_sig_{output_path.stem}.png"
        signature_img.save(str(temp_sig_path), "PNG")
        
        # Draw signature on PDF (convert y coordinate as PDF origin is bottom-left)
        pdf_y = page_height - signature_y - signature_height
        c.drawImage(str(temp_sig_path), signature_x, pdf_y, 
                   width=signature_width, height=signature_height, 
                   mask='auto', preserveAspectRatio=True)
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
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)
        
        # Clean up temp signature file
        temp_sig_path.unlink(missing_ok=True)
        
        logger.info(f"Successfully stamped signature on PDF: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to stamp signature on PDF: {e}")
        return False


async def _stamp_signature_on_image(
    contract_path: Path,
    signature_img: Image.Image,
    signature_x: int,
    signature_y: int,
    output_path: Path
) -> bool:
    """Stamp signature on image document"""
    try:
        # Open contract image
        contract_img = Image.open(contract_path).convert("RGBA")
        
        # Create a transparent layer for signature
        signature_layer = Image.new('RGBA', contract_img.size, (255, 255, 255, 0))
        signature_layer.paste(signature_img, (int(signature_x), int(signature_y)), signature_img)
        
        # Composite signature onto contract
        signed_image = Image.alpha_composite(contract_img, signature_layer)
        
        # Convert back to RGB if saving as JPEG
        file_ext = contract_path.suffix.lower()
        if file_ext in ['.jpg', '.jpeg']:
            signed_image = signed_image.convert('RGB')
        
        signed_image.save(output_path)
        
        logger.info(f"Successfully stamped signature on image: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to stamp signature on image: {e}")
        return False
