"""Text-extraction helpers used by the contract/OCR pipeline."""
import logging

import pdfplumber
from docx import Document as DocxDocument

logger = logging.getLogger("server")


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF via pdfplumber. Returns '' on failure."""
    text_parts = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
    return "\n\n".join(text_parts)


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX file."""
    text_parts = []
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
