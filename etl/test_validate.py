"""Tests for seed CSV validation."""

import pytest
from validate import ValidationError, validate_file


def test_valid_file_passes():
    header = ["technician_id", "name", "region", "level", "hire_date", "bill_rate"]
    rows = [
        {"technician_id": "1", "name": "A", "region": "North", "level": "Lead",
         "hire_date": "2024-01-01", "bill_rate": "150"},
        {"technician_id": "2", "name": "B", "region": "South", "level": "Senior",
         "hire_date": "2024-02-01", "bill_rate": "120"},
    ]
    validate_file("technicians", rows, header)  # should not raise


def test_missing_column_fails():
    header = ["technician_id", "name"]  # missing several required columns
    with pytest.raises(ValidationError, match="missing required columns"):
        validate_file("technicians", [], header)


def test_duplicate_primary_key_fails():
    header = ["technician_id", "name", "region", "level", "hire_date", "bill_rate"]
    rows = [
        {"technician_id": "1", "name": "A", "region": "N", "level": "L",
         "hire_date": "2024-01-01", "bill_rate": "150"},
        {"technician_id": "1", "name": "B", "region": "S", "level": "S",
         "hire_date": "2024-02-01", "bill_rate": "120"},
    ]
    with pytest.raises(ValidationError, match="duplicate primary key"):
        validate_file("technicians", rows, header)


def test_empty_primary_key_fails():
    header = ["technician_id", "name", "region", "level", "hire_date", "bill_rate"]
    rows = [
        {"technician_id": "", "name": "A", "region": "N", "level": "L",
         "hire_date": "2024-01-01", "bill_rate": "150"},
    ]
    with pytest.raises(ValidationError, match="empty primary key"):
        validate_file("technicians", rows, header)
