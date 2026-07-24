"""Document-type registry — register/get/all, same contract as
workflow.registry and automation.registry."""

from __future__ import annotations

import pytest
from periods.registry import (
    DocumentTypeDef,
    all_document_types,
    get_document_type,
    register_document_type,
)
from shared.exceptions import NotFoundError


def test_register_and_get_round_trip():
    definition = DocumentTypeDef(
        key="test.doc.one",
        label="Test one",
        folder_segment="Test Ones",
        is_library=False,
        module="test",
    )
    register_document_type(definition)

    fetched = get_document_type("test.doc.one")
    assert fetched.key == "test.doc.one"
    assert fetched.folder_segment == "Test Ones"


def test_get_unregistered_type_raises():
    with pytest.raises(NotFoundError):
        get_document_type("does.not.exist")


def test_register_is_idempotent_by_key():
    definition_v1 = DocumentTypeDef(
        key="test.doc.two",
        label="v1",
        folder_segment="A",
        is_library=False,
        module="test",
    )
    definition_v2 = DocumentTypeDef(
        key="test.doc.two",
        label="v2",
        folder_segment="B",
        is_library=False,
        module="test",
    )
    register_document_type(definition_v1)
    register_document_type(definition_v2)

    assert get_document_type("test.doc.two").label == "v2"
    assert [d.key for d in all_document_types()].count("test.doc.two") == 1
