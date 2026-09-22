"""Text-extraction helpers used by the contract/OCR pipeline.

LIMITS (security scan F15). The upload caps only the COMPRESSED size. A
DOCX is a zip and a PDF has compressed streams, and a few MB can inflate to
many GB in memory - one upload took a worker down. So a DOCX whose parts
add up to more than MAX_DOCX_UNCOMPRESSED, or that compresses more than
MAX_RATIO to one, is not parsed at all, and a PDF is read to MAX_PDF_PAGES
pages and MAX_CHARS characters. A real rental contract is a few pages and
a few hundred KB; these are far above that.
"""
import logging
import zipfile

import pdfplumber
from docx import Document as DocxDocument

logger = logging.getLogger("server")

MAX_DOCX_UNCOMPRESSED = 50 * 1024 * 1024
MAX_RATIO = 100
MAX_PDF_PAGES = 60
MAX_CHARS = 400_000


def docx_is_safe(file_path: str) -> bool:
    """False for a zip bomb: too big unpacked, or too compressed to be real."""
    try:
        with zipfile.ZipFile(file_path) as z:
            infos = z.infolist()
    except (zipfile.BadZipFile, OSError):
        return False
    unpacked = sum(i.file_size for i in infos)
    packed = sum(i.compress_size for i in infos) or 1
    return unpacked <= MAX_DOCX_UNCOMPRESSED and unpacked / packed <= MAX_RATIO


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF via pdfplumber. Returns '' on failure."""
    text_parts = []
    total = 0
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages[:MAX_PDF_PAGES]:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
                    total += len(page_text)
                    if total >= MAX_CHARS:
                        break
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
    return "\n\n".join(text_parts)


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX file."""
    text_parts = []
    if not docx_is_safe(file_path):
        logger.warning("DOCX refused for extraction: too large unpacked or too compressed")
        return ""
    try:
        doc = DocxDocument(file_path)
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text)
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
    return "\n\n".join(text_parts)


def extract_text_from_image(file_path: str) -> str:
    """Extract text from an image using pytesseract (Hebrew + English).
    Falls back to empty string if pytesseract isn't installed."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img, lang="heb+eng")
        return text.strip()
    except Exception as e:
        logger.warning(f"OCR extraction failed (pytesseract may not be installed): {e}")
        return ""
