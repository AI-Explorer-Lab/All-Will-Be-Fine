from __future__ import annotations


class BusinessException(Exception):
    code = "BUSINESS_ERROR"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class ValidationException(BusinessException):
    code = "VALIDATION_ERROR"


class NotFoundException(BusinessException):
    code = "NOT_FOUND"
