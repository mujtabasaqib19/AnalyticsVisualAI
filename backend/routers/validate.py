from fastapi import APIRouter, HTTPException
from models.dashboard import ValidationRequest, ValidationResult
from services.quality import validate_with_gemini
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/validate", response_model=ValidationResult)
async def validate_data(request: ValidationRequest):
    try:
        result = await validate_with_gemini(request.schema, request.sample_rows)
        return result
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(500, "Data validation failed. Please try again.")
